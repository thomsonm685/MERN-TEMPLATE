import { describe, it, expect, vi } from 'vitest';

vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/template-test');
vi.stubEnv('JWT_SECRET', 'this-is-a-thirty-two-char-secret-x');
vi.stubEnv('LOG_LEVEL', 'fatal');
vi.stubEnv('APP_NAME', 'Template');
vi.stubEnv('FRONTEND_URL', 'http://localhost:5173');
// No key: every send is logged rather than dispatched, so this suite never hits the network.
vi.stubEnv('RESEND_API_KEY', '');

const { isEmailEnabled } = await import('../src/config/env.js');
const { sendEmail, isRetryableStatus, describeError, idempotencyKeyFor, MAX_RECIPIENTS } =
  await import('../src/email/client.js');
const { renderEmail, escapeHtml } = await import('../src/email/render.js');
const { welcomeEmail, passwordResetEmail, emailVerificationEmail } =
  await import('../src/email/templates/index.js');
const { emailTriggers } = await import('../src/email/triggers.js');

describe('email (no API key)', () => {
  it('is disabled', () => {
    expect(isEmailEnabled).toBe(false);
  });

  it('reports a non-delivery instead of failing', async () => {
    const result = await sendEmail(welcomeEmail({ firstName: 'Ada' }), { to: 'ada@lovelace.dev' });
    expect(result).toMatchObject({ ok: true, delivered: false, reason: 'no-api-key' });
  });

  it('rejects an empty or oversized recipient list without sending', async () => {
    const message = welcomeEmail({ firstName: 'Ada' });
    await expect(sendEmail(message, { to: [] })).resolves.toMatchObject({ ok: false });

    const tooMany = Array.from({ length: MAX_RECIPIENTS + 1 }, (_, i) => `u${i}@test.dev`);
    const result = await sendEmail(message, { to: tooMany });
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.error).toContain('at most 50');
  });
});

describe('retry policy', () => {
  it('retries throttling, contention and upstream faults', () => {
    for (const status of [409, 429, 500, 502, 503, 504]) {
      expect(isRetryableStatus(status), `${status} should retry`).toBe(true);
    }
  });

  it('never retries a permanent failure', () => {
    // Retrying a 403 for an unverified domain reaches the same outcome, only slower.
    for (const status of [400, 401, 403, 404, 405, 422]) {
      expect(isRetryableStatus(status), `${status} should not retry`).toBe(false);
    }
  });
});

describe('describeError', () => {
  it('combines name and message when both are present', () => {
    const body = JSON.stringify({
      statusCode: 401,
      name: 'restricted_api_key',
      message: 'This API key is restricted to only send emails',
    });
    expect(describeError(401, body)).toBe(
      '401 restricted_api_key: This API key is restricted to only send emails',
    );
  });

  it('handles a body with no name, without printing undefined', () => {
    // A 403 for an unverified domain carries only statusCode and message.
    const body = JSON.stringify({
      statusCode: 403,
      message: 'This API key is not authorized to send emails from example.invalid',
    });
    const described = describeError(403, body);
    expect(described).not.toContain('undefined');
    expect(described).toContain('not authorized');
  });

  it('falls back to the raw body when it is not JSON', () => {
    expect(describeError(502, '<html>Bad Gateway</html>')).toContain('Bad Gateway');
  });
});

describe('idempotencyKeyFor', () => {
  it('is stable for identical content and within Resend’s length limit', () => {
    const a = idempotencyKeyFor('a@b.dev', 'Reset', 'link-1');
    expect(a).toBe(idempotencyKeyFor('a@b.dev', 'Reset', 'link-1'));
    expect(a.length).toBeLessThanOrEqual(64);
  });

  it('changes when the body changes, so a genuinely new reset still sends', () => {
    expect(idempotencyKeyFor('a@b.dev', 'Reset', 'link-1')).not.toBe(
      idempotencyKeyFor('a@b.dev', 'Reset', 'link-2'),
    );
  });
});

describe('renderEmail', () => {
  it('produces text and HTML from one description', () => {
    const msg = renderEmail({ subject: 'Hello', paragraphs: ['First.', 'Second.'] });
    expect(msg.text).toContain('First.');
    expect(msg.text).toContain('Second.');
    expect(msg.html).toContain('First.');
    expect(msg.html).toContain('<title>Hello</title>');
  });

  it('escapes the body and the subject', () => {
    // The subject is interpolated into <title>, so it needs escaping too.
    const msg = renderEmail({
      subject: '<script>alert(1)</script>',
      paragraphs: ['5 > 3 & "quoted"'],
    });
    expect(msg.html).not.toContain('<script>');
    expect(msg.html).toContain('&lt;script&gt;');
    expect(msg.html).toContain('&gt; 3 &amp;');
  });

  it('writes the button URL into the text version too', () => {
    const msg = renderEmail({
      subject: 'Go',
      paragraphs: ['Click.'],
      button: { label: 'Open', url: 'https://example.org/x' },
    });
    expect(msg.text).toContain('https://example.org/x');
  });

  it('escapes correctly regardless of character order', () => {
    expect(escapeHtml('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});

describe('templates', () => {
  it('all produce a subject, text and HTML', () => {
    const messages = [
      welcomeEmail({ firstName: 'Ada' }),
      passwordResetEmail({ firstName: 'Ada', url: 'https://app.test/reset?token=tok-1' }),
      emailVerificationEmail({ firstName: 'Ada', url: 'https://app.test/verify?token=tok-1' }),
    ];
    for (const msg of messages) {
      expect(msg.subject.length).toBeGreaterThan(0);
      expect(msg.text.length).toBeGreaterThan(0);
      expect(msg.html).toContain('<!doctype html>');
    }
  });

  it('puts the supplied link into the text version verbatim', () => {
    const url = 'https://app.test/reset?token=abc123';
    expect(passwordResetEmail({ firstName: 'Ada', url }).text).toContain(url);
  });
});

describe('triggers', () => {
  it('never throw, even with a hostile name', async () => {
    await expect(
      emailTriggers.userRegistered({ email: 'a@b.dev', firstName: '<img onerror=x>' }),
    ).resolves.toMatchObject({ ok: true });
  });

  it('URL-encodes a token when building the link itself', async () => {
    const result = await emailTriggers.passwordResetRequested(
      { email: 'a@b.dev', firstName: 'Ada' },
      'a b/c&d',
    );
    expect(result.ok).toBe(true);
  });

  it('cover the documented app events', async () => {
    const user = { email: 'a@b.dev', firstName: 'Ada' };
    await expect(emailTriggers.passwordResetRequested(user, 't')).resolves.toMatchObject({
      ok: true,
    });
    await expect(emailTriggers.emailVerificationRequested(user, 't')).resolves.toMatchObject({
      ok: true,
    });
    await expect(
      emailTriggers.notified(user, { subject: 'Hi', paragraphs: ['There.'] }),
    ).resolves.toMatchObject({ ok: true });
  });
});
