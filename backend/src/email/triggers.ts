import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { sendEmail, type SendOptions, type SendResult } from './client.js';
import {
  welcomeEmail,
  passwordResetEmail,
  emailVerificationEmail,
  notificationEmail,
  type NotificationData,
} from './templates/index.js';

/** The app events that produce an email. Add a case here rather than sending ad hoc. */
export type EmailTrigger =
  | 'user.registered'
  | 'user.passwordResetRequested'
  | 'user.emailVerificationRequested'
  | 'user.notified';

interface Recipient {
  email: string;
  firstName: string;
}

/**
 * Runs a trigger without ever throwing.
 *
 * Triggers fire from controllers that have already committed their work — the user row is
 * written, the token is stored. A mail failure must not turn that into a 500, so everything
 * is caught and logged here. Inspect the returned result when a caller genuinely needs to
 * know; ignore it (the common case) and failures are still recorded in the logs.
 */
async function fire(trigger: EmailTrigger, send: () => Promise<SendResult>): Promise<SendResult> {
  try {
    const result = await send();
    if (!result.ok) logger.warn({ trigger, err: result.error }, 'Email trigger failed');
    return result;
  } catch (err) {
    // sendEmail is written not to throw; this guards against a template throwing instead.
    logger.error({ err, trigger }, 'Email trigger threw');
    return { ok: false, error: err instanceof Error ? err.message : String(err), attempts: 0 };
  }
}

const tag = (trigger: EmailTrigger): SendOptions['tags'] => [
  // Tag values must be ASCII; dots are fine, so the trigger name passes through as-is.
  { name: 'trigger', value: trigger },
];

export const emailTriggers = {
  /** Fired after a successful signup. */
  userRegistered(user: Recipient): Promise<SendResult> {
    return fire('user.registered', () =>
      sendEmail(welcomeEmail({ firstName: user.firstName }), {
        to: user.email,
        tags: tag('user.registered'),
      }),
    );
  },

  /**
   * Fired when a reset is requested, given a ready-made link. Better Auth builds the URL
   * itself and passes it here.
   *
   * The link is part of the message body, so each new request produces a different
   * idempotency key and genuinely sends, while a double-submitted form carrying the same
   * link sends once.
   */
  passwordResetLink(user: Recipient, url: string, expiresIn?: string): Promise<SendResult> {
    return fire('user.passwordResetRequested', () =>
      sendEmail(passwordResetEmail({ firstName: user.firstName, url, expiresIn }), {
        to: user.email,
        tags: tag('user.passwordResetRequested'),
      }),
    );
  },

  /** The same, given a bare token — the shape the legacy JWT flow produces. */
  passwordResetRequested(user: Recipient, token: string, expiresIn?: string): Promise<SendResult> {
    const url = `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
    return this.passwordResetLink(user, url, expiresIn);
  },

  emailVerificationLink(user: Recipient, url: string): Promise<SendResult> {
    return fire('user.emailVerificationRequested', () =>
      sendEmail(emailVerificationEmail({ firstName: user.firstName, url }), {
        to: user.email,
        tags: tag('user.emailVerificationRequested'),
      }),
    );
  },

  emailVerificationRequested(user: Recipient, token: string): Promise<SendResult> {
    const url = `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(token)}`;
    return this.emailVerificationLink(user, url);
  },

  /** One-off notice. Prefer a dedicated template and trigger once a message repeats. */
  notified(user: Recipient, content: NotificationData): Promise<SendResult> {
    return fire('user.notified', () =>
      sendEmail(notificationEmail(content), {
        to: user.email,
        tags: tag('user.notified'),
      }),
    );
  },
};
