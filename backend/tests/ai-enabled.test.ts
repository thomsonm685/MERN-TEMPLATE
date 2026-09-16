import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

/**
 * Exercises the real route → controller → service → Anthropic SDK path against a local
 * stand-in for api.anthropic.com. Nothing leaves the machine and no real key is used, but
 * every layer under test is the production one.
 */

/** Canned reply for the next request, plus a record of what the SDK actually sent. */
let nextReply: { status: number; body: unknown; sse?: string } = {
  status: 200,
  body: {},
};
let lastRequest: { path: string; headers: Record<string, unknown>; body: Record<string, unknown> };

const mock: Server = createServer((req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', (c: Buffer) => chunks.push(c));
  req.on('end', () => {
    lastRequest = {
      path: req.url ?? '',
      headers: req.headers as Record<string, unknown>,
      body: JSON.parse(Buffer.concat(chunks).toString() || '{}') as Record<string, unknown>,
    };

    if (nextReply.sse) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream' });
      res.end(nextReply.sse);
      return;
    }
    res.writeHead(nextReply.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(nextReply.body));
  });
});

await new Promise<void>((resolve) => mock.listen(0, '127.0.0.1', resolve));
const mockPort = (mock.address() as AddressInfo).port;

vi.stubEnv('NODE_ENV', 'test');
vi.stubEnv('JWT_SECRET', 'this-is-a-thirty-two-char-secret-x');
vi.stubEnv('LOG_LEVEL', 'fatal');
vi.stubEnv('AUTH_PROVIDER', 'jwt');
vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test-not-real');
vi.stubEnv('ANTHROPIC_BASE_URL', `http://127.0.0.1:${mockPort}`);

const { MongoMemoryServer } = await import('mongodb-memory-server-core');
const mongo = await MongoMemoryServer.create();
vi.stubEnv('MONGODB_URI', mongo.getUri('ai-test'));

const request = (await import('supertest')).default;
const mongoose = (await import('mongoose')).default;
const { createApp } = await import('../src/app.js');

let app: Express;
let token = '';

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg_1',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5',
    content: [{ type: 'text', text: 'Hello from Claude.' }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
    ...overrides,
  };
}

beforeAll(async () => {
  await mongoose.connect(mongo.getUri('ai-test'));
  app = createApp();
  const signup = await request(app).post('/api/auth/signup').send({
    email: 'ai@tester.dev',
    password: 'correct-horse-battery',
    firstName: 'Ai',
    lastName: 'Tester',
  });
  token = signup.body.data.token as string;
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
  await new Promise<void>((resolve) => mock.close(() => resolve()));
});

const auth = () => ({ Authorization: `Bearer ${token}` });
const ONE = { messages: [{ role: 'user', content: 'Hi' }] };

describe('mounting and access control', () => {
  it('mounts /api/ai when a key is present', async () => {
    nextReply = { status: 200, body: message() };
    const res = await request(app).post('/api/ai/message').set(auth()).send(ONE);
    expect(res.status).toBe(200);
  });

  it('rejects an unauthenticated request', async () => {
    const res = await request(app).post('/api/ai/message').send(ONE);
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } });
  });

  it('rejects a malformed body before spending a token', async () => {
    const res = await request(app).post('/api/ai/message').set(auth()).send({ messages: [] });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
  });
});

describe('request shape sent to Anthropic', () => {
  it('uses the configured model with adaptive thinking and effort', async () => {
    nextReply = { status: 200, body: message() };
    await request(app).post('/api/ai/message').set(auth()).send(ONE);

    expect(lastRequest.path).toContain('/v1/messages');
    expect(lastRequest.body).toMatchObject({
      model: 'claude-opus-5',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'high' },
    });
    // budget_tokens is rejected by current models — it must never be sent.
    expect(lastRequest.body.thinking).not.toHaveProperty('budget_tokens');
  });

  it('opts into the server-side refusal fallback with the matching beta flag', async () => {
    nextReply = { status: 200, body: message() };
    await request(app).post('/api/ai/message').set(auth()).send(ONE);

    expect(lastRequest.body.fallbacks).toBe('default');
    expect(String(lastRequest.headers['anthropic-beta'])).toContain(
      'server-side-fallback-2026-07-01',
    );
  });

  it('honours a per-request effort override', async () => {
    nextReply = { status: 200, body: message() };
    await request(app)
      .post('/api/ai/message')
      .set(auth())
      .send({ ...ONE, effort: 'low' });

    expect(lastRequest.body).toMatchObject({ output_config: { effort: 'low' } });
  });
});

describe('responses', () => {
  it('returns text and usage in the template envelope', async () => {
    nextReply = { status: 200, body: message() };
    const res = await request(app).post('/api/ai/message').set(auth()).send(ONE);

    expect(res.body).toMatchObject({
      success: true,
      data: {
        text: 'Hello from Claude.',
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 5 },
      },
    });
  });

  it('surfaces a refusal as 422 rather than empty text', async () => {
    nextReply = {
      status: 200,
      body: message({
        content: [],
        stop_reason: 'refusal',
        stop_details: { type: 'refusal', category: 'cyber', explanation: 'Declined.' },
      }),
    };
    const res = await request(app).post('/api/ai/message').set(auth()).send(ONE);

    // HTTP 200 from Anthropic, but there is no answer — it must not look like success.
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({
      success: false,
      error: { code: 'AI_REFUSED', details: { category: 'cyber' } },
    });
  });

  it('maps an SDK error onto the envelope instead of a 500 stack', async () => {
    nextReply = {
      status: 400,
      body: { type: 'error', error: { type: 'invalid_request_error', message: 'bad input' } },
    };
    const res = await request(app).post('/api/ai/message').set(auth()).send(ONE);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: { code: 'AI_BAD_REQUEST' } });
  });
});

describe('streaming', () => {
  it('streams deltas then a done event', async () => {
    const sse = [
      `event: message_start\ndata: ${JSON.stringify({ type: 'message_start', message: message({ content: [], stop_reason: null, usage: { input_tokens: 10, output_tokens: 0 } }) })}\n\n`,
      `event: content_block_start\ndata: ${JSON.stringify({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })}\n\n`,
      `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello ' } })}\n\n`,
      `event: content_block_delta\ndata: ${JSON.stringify({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'world' } })}\n\n`,
      `event: content_block_stop\ndata: ${JSON.stringify({ type: 'content_block_stop', index: 0 })}\n\n`,
      `event: message_delta\ndata: ${JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 2 } })}\n\n`,
      `event: message_stop\ndata: ${JSON.stringify({ type: 'message_stop' })}\n\n`,
    ].join('');

    nextReply = { status: 200, body: {}, sse };
    const res = await request(app).post('/api/ai/stream').set(auth()).send(ONE);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('event: delta');
    expect(res.text).toContain('Hello ');
    expect(res.text).toContain('world');
    expect(res.text).toContain('event: done');
  });
});
