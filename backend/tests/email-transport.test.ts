import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('MONGODB_URI', 'mongodb://localhost:27017/template-test');
vi.stubEnv('JWT_SECRET', 'this-is-a-thirty-two-char-secret-x');
vi.stubEnv('LOG_LEVEL', 'fatal');
vi.stubEnv('APP_NAME', 'Template');
// A key is present here so the real request path runs; `fetch` is stubbed, so nothing
// leaves the machine. Two attempts keeps the backoff short.
vi.stubEnv('RESEND_API_KEY', 're_test_key_not_real');
vi.stubEnv('EMAIL_FROM', 'Template <no-reply@test.dev>');
vi.stubEnv('EMAIL_MAX_ATTEMPTS', '2');

const { sendEmail } = await import('../src/email/client.js');
const { renderEmail } = await import('../src/email/render.js');

const message = renderEmail({ subject: 'Reset your password', paragraphs: ['Link inside.'] });

interface Call {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

let calls: Call[] = [];

/** Queues canned responses; each call shifts one off. */
function stubResend(
  responses: { status: number; body: unknown; headers?: Record<string, string> }[],
): void {
  calls = [];
  const queue = [...responses];
  vi.stubGlobal('fetch', (url: string, init: RequestInit) => {
    calls.push({
      url,
      headers: init.headers as Record<string, string>,
      body: JSON.parse(init.body as string) as Record<string, unknown>,
    });
    const next = queue.shift() ?? { status: 500, body: {} };
    return Promise.resolve(
      new Response(JSON.stringify(next.body), { status: next.status, headers: next.headers }),
    );
  });
}

beforeEach(() => {
  calls = [];
});
afterAll(() => {
  vi.unstubAllGlobals();
});

describe('successful send', () => {
  it('returns the Resend id', async () => {
    stubResend([{ status: 200, body: { id: 'abc-123' } }]);
    const result = await sendEmail(message, { to: 'ada@lovelace.dev' });
    expect(result).toMatchObject({ ok: true, delivered: true, id: 'abc-123' });
    expect(calls).toHaveLength(1);
  });

  it('posts to the emails endpoint with auth, user-agent and an idempotency key', async () => {
    stubResend([{ status: 200, body: { id: 'x' } }]);
    await sendEmail(message, { to: 'ada@lovelace.dev' });

    const [call] = calls;
    expect(call!.url).toBe('https://api.resend.com/emails');
    expect(call!.headers.authorization).toBe('Bearer re_test_key_not_real');
    expect(call!.headers['user-agent']).toBe('Template/1.0');
    expect(call!.headers['idempotency-key']).toMatch(/^[\w-]{1,64}$/);
  });

  it('sends reply_to in snake_case', async () => {
    stubResend([{ status: 200, body: { id: 'x' } }]);
    await sendEmail(message, { to: 'ada@lovelace.dev', replyTo: 'support@test.dev' });

    // camelCase `replyTo` is silently ignored by the raw API — the bug this guards against.
    expect(calls[0]!.body).toHaveProperty('reply_to', 'support@test.dev');
    expect(calls[0]!.body).not.toHaveProperty('replyTo');
  });

  it('always sends both text and html', async () => {
    stubResend([{ status: 200, body: { id: 'x' } }]);
    await sendEmail(message, { to: 'ada@lovelace.dev' });
    expect(calls[0]!.body.text).toBeTruthy();
    expect(calls[0]!.body.html).toBeTruthy();
  });
});

describe('permanent failures', () => {
  it('does not retry a 403 for an unverified domain', async () => {
    stubResend([
      {
        status: 403,
        body: { statusCode: 403, message: 'This API key is not authorized to send emails from x' },
      },
    ]);
    const result = await sendEmail(message, { to: 'ada@lovelace.dev' });

    expect(result).toMatchObject({ ok: false, status: 403, attempts: 1 });
    expect(calls).toHaveLength(1);
    if (!result.ok) expect(result.error).not.toContain('undefined');
  });

  it('does not retry a 422 validation error', async () => {
    stubResend([{ status: 422, body: { statusCode: 422, name: 'validation_error' } }]);
    const result = await sendEmail(message, { to: 'ada@lovelace.dev' });
    expect(result).toMatchObject({ ok: false, attempts: 1 });
    expect(calls).toHaveLength(1);
  });
});

describe('retryable failures', () => {
  it('retries a 429 and succeeds on the next attempt', async () => {
    stubResend([
      {
        status: 429,
        body: { statusCode: 429, name: 'rate_limit_exceeded' },
        headers: { 'retry-after': '0' },
      },
      { status: 200, body: { id: 'after-retry' } },
    ]);
    const result = await sendEmail(message, { to: 'ada@lovelace.dev' });

    expect(result).toMatchObject({ ok: true, id: 'after-retry' });
    expect(calls).toHaveLength(2);
  });

  it('reuses one idempotency key across retries', async () => {
    stubResend([
      { status: 429, body: {}, headers: { 'retry-after': '0' } },
      { status: 200, body: { id: 'x' } },
    ]);
    await sendEmail(message, { to: 'ada@lovelace.dev' });

    expect(calls).toHaveLength(2);
    expect(calls[0]!.headers['idempotency-key']).toBe(calls[1]!.headers['idempotency-key']);
  });

  it('gives up after EMAIL_MAX_ATTEMPTS on repeated 5xx', async () => {
    stubResend([
      { status: 503, body: {}, headers: { 'retry-after': '0' } },
      { status: 503, body: {}, headers: { 'retry-after': '0' } },
      { status: 503, body: {}, headers: { 'retry-after': '0' } },
    ]);
    const result = await sendEmail(message, { to: 'ada@lovelace.dev' });

    expect(result).toMatchObject({ ok: false, status: 503, attempts: 2 });
    expect(calls).toHaveLength(2);
  });

  it('retries a network failure without turning it into a throw', async () => {
    let n = 0;
    vi.stubGlobal('fetch', () => {
      n += 1;
      return n === 1
        ? Promise.reject(new Error('ECONNRESET'))
        : Promise.resolve(new Response(JSON.stringify({ id: 'recovered' }), { status: 200 }));
    });

    await expect(sendEmail(message, { to: 'ada@lovelace.dev' })).resolves.toMatchObject({
      ok: true,
      id: 'recovered',
    });
    expect(n).toBe(2);
  });
});
