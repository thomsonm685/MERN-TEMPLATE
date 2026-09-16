import { createHash } from 'node:crypto';
import { env, isEmailEnabled } from '../config/env.js';
import { logger } from '../config/logger.js';
import type { EmailMessage } from './render.js';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** Resend accepts at most 50 recipients per send. */
export const MAX_RECIPIENTS = 50;

/**
 * Statuses worth trying again. Everything else is permanent — retrying a 403 for an
 * unverified domain just reaches the same outcome three times more slowly.
 *
 * 429 rate/quota · 409 concurrent idempotent request or locked resource · 5xx upstream.
 */
const RETRYABLE_STATUSES = new Set([409, 429, 500, 502, 503, 504]);

export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUSES.has(status);
}

export interface SendOptions {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  replyTo?: string;
  /** ISO 8601 or natural language, e.g. "in 1 hour". */
  scheduledAt?: string;
  tags?: { name: string; value: string }[];
  /** Overrides the derived content hash. Held by Resend for 24 hours. */
  idempotencyKey?: string;
}

export type SendResult =
  | { ok: true; id: string; delivered: true }
  | { ok: true; id: null; delivered: false; reason: 'no-api-key' | 'dry-run' }
  | { ok: false; error: string; status?: number; attempts: number };

/**
 * An idempotency key derived from the message itself.
 *
 * Content-derived rather than random, so a double-submitted "reset my password" sends one
 * email, while a genuinely new reset carries a new link → different text → different key →
 * it sends. Our own retries reuse the key, which is the case it exists for.
 */
export function idempotencyKeyFor(to: string, subject: string, text: string): string {
  return createHash('sha256').update(`${to} ${subject} ${text}`).digest('base64url').slice(0, 64);
}

/**
 * Resend's error body is `{ statusCode, name?, message }` — but `name` is absent on some
 * failures (a 403 for an unverified domain has only statusCode and message). Reading it
 * unconditionally prints "undefined:" into your own logs, so fall back to the raw body.
 */
export function describeError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body) as { name?: string; message?: string };
    const label = [parsed.name, parsed.message].filter(Boolean).join(': ');
    if (label) return `${status} ${label}`;
  } catch {
    // Not JSON — fall through to the raw body.
  }
  return `${status} ${body.slice(0, 300)}`;
}

/** Honour Resend's `retry-after` (seconds) over our own backoff — it knows when the window reopens. */
function retryDelayMs(response: Response, attempt: number): number {
  const header = response.headers.get('retry-after');
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  }
  return Math.min(2 ** (attempt - 1) * 500, 8000);
}

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Sends one message, and never throws.
 *
 * A failed send must not become a 500: by the time mail goes out the caller has usually
 * already committed its work, and telling someone "something went wrong" *after* their
 * password was reset is worse than a missing email. Callers get a result to inspect.
 *
 * With no API key the message is logged in full instead — password reset stays usable on a
 * laptop with no Resend account, and the test suite stays off the network.
 */
export async function sendEmail(message: EmailMessage, options: SendOptions): Promise<SendResult> {
  const recipients = Array.isArray(options.to) ? options.to : [options.to];

  if (recipients.length === 0) {
    return { ok: false, error: 'No recipients', attempts: 0 };
  }
  if (recipients.length > MAX_RECIPIENTS) {
    return {
      ok: false,
      error: `Too many recipients (${recipients.length}); Resend accepts at most ${MAX_RECIPIENTS} per send`,
      attempts: 0,
    };
  }

  if (!isEmailEnabled) {
    logger.info(
      { to: recipients, subject: message.subject, text: message.text },
      env.RESEND_API_KEY ? 'Email not sent (EMAIL_DRY_RUN)' : 'Email not sent (no RESEND_API_KEY)',
    );
    return {
      ok: true,
      id: null,
      delivered: false,
      reason: env.RESEND_API_KEY ? 'dry-run' : 'no-api-key',
    };
  }

  const replyTo = options.replyTo ?? env.EMAIL_REPLY_TO;
  const payload = {
    from: env.EMAIL_FROM,
    to: recipients,
    subject: message.subject,
    html: message.html,
    text: message.text,
    // snake_case: the raw API ignores `replyTo` silently. Only the SDK converts it.
    ...(replyTo && { reply_to: replyTo }),
    ...(options.cc?.length && { cc: options.cc }),
    ...(options.bcc?.length && { bcc: options.bcc }),
    ...(options.scheduledAt && { scheduled_at: options.scheduledAt }),
    ...(options.tags?.length && { tags: options.tags }),
  };

  const idempotencyKey =
    options.idempotencyKey ??
    idempotencyKeyFor(recipients.join(','), message.subject, message.text);

  let lastError = 'Unknown error';
  let lastStatus: number | undefined;
  let attemptsMade = 0;

  for (let attempt = 1; attempt <= env.EMAIL_MAX_ATTEMPTS; attempt++) {
    attemptsMade = attempt;
    let response: Response;
    try {
      response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          'content-type': 'application/json',
          'user-agent': `${env.APP_NAME}/1.0`,
          // Reused across our retries — that is exactly what it is for.
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(env.EMAIL_TIMEOUT_MS),
      });
    } catch (err) {
      // Network failure or timeout — worth another try.
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < env.EMAIL_MAX_ATTEMPTS) {
        await wait(Math.min(2 ** (attempt - 1) * 500, 8000));
        continue;
      }
      break;
    }

    if (response.ok) {
      const { id } = (await response.json()) as { id: string };
      logger.info({ id, to: recipients, subject: message.subject, attempt }, 'Email sent');
      return { ok: true, id, delivered: true };
    }

    const body = await response.text();
    lastStatus = response.status;
    lastError = describeError(response.status, body);

    if (!isRetryableStatus(response.status) || attempt === env.EMAIL_MAX_ATTEMPTS) break;

    await wait(retryDelayMs(response, attempt));
  }

  logger.error(
    { err: lastError, status: lastStatus, to: recipients, subject: message.subject },
    'Email send failed',
  );
  return { ok: false, error: lastError, status: lastStatus, attempts: attemptsMade };
}
