import type { RequestHandler } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../config/logger.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { ask, askStream } from '../ai/service.js';

interface AskBody {
  messages: Anthropic.Beta.BetaMessageParam[];
  system?: string;
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

/**
 * Maps an SDK error onto the template's envelope.
 *
 * Checked most specific first: a single broad catch would lose the distinction between a
 * bad request (never retry) and a rate limit (retry later), which is exactly what the
 * caller needs to know.
 */
function describe(err: unknown): { status: number; message: string; code: string } {
  if (err instanceof Anthropic.BadRequestError) {
    return { status: 400, message: err.message, code: 'AI_BAD_REQUEST' };
  }
  if (err instanceof Anthropic.AuthenticationError) {
    // The key is wrong or revoked — the caller can do nothing about it.
    return {
      status: 500,
      message: 'The AI service is not configured correctly.',
      code: 'AI_AUTH_ERROR',
    };
  }
  if (err instanceof Anthropic.RateLimitError) {
    return {
      status: 429,
      message: 'The AI service is busy. Try again shortly.',
      code: 'AI_RATE_LIMITED',
    };
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return { status: 503, message: 'Could not reach the AI service.', code: 'AI_UNAVAILABLE' };
  }
  if (err instanceof Anthropic.APIError) {
    return { status: err.status ?? 502, message: err.message, code: 'AI_ERROR' };
  }
  return {
    status: 500,
    message: 'Something went wrong talking to the AI service.',
    code: 'AI_ERROR',
  };
}

/** POST /api/ai/message — one request, one JSON response. */
export const postMessage: RequestHandler = async (req, res) => {
  const { messages, system, maxTokens, effort } = req.body as AskBody;

  try {
    const result = await ask({ messages, system, maxTokens, effort });

    if (result.stopReason === 'refusal') {
      res
        .status(422)
        .json(
          errorResponse('The AI declined to answer that request.', 'AI_REFUSED', result.refusal),
        );
      return;
    }

    res.status(200).json(successResponse(result, 'Response generated'));
  } catch (err) {
    const { status, message, code } = describe(err);
    logger.error({ err, userId: req.authUser?.id }, 'AI request failed');
    res.status(status).json(errorResponse(message, code));
  }
};

/**
 * POST /api/ai/stream — the same call as Server-Sent Events.
 *
 * Emits `delta` events as text arrives, then one `done` event carrying the assembled result.
 * Errors after the stream has started cannot use a status code, so they arrive as an
 * `error` event instead.
 */
export const postMessageStream: RequestHandler = async (req, res) => {
  const { messages, system, maxTokens, effort } = req.body as AskBody;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Stops nginx from buffering the stream into a single response.
    'X-Accel-Buffering': 'no',
  });

  const send = (event: string, data: unknown): void => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // If the client hangs up mid-answer, stop paying for tokens nobody will read.
  const aborted = new AbortController();
  req.on('close', () => aborted.abort());

  try {
    const result = await askStream({ messages, system, maxTokens, effort }, (delta) => {
      if (!aborted.signal.aborted) send('delta', { text: delta });
    });

    send(result.stopReason === 'refusal' ? 'refused' : 'done', result);
  } catch (err) {
    const { message, code } = describe(err);
    logger.error({ err, userId: req.authUser?.id }, 'AI stream failed');
    send('error', { message, code });
  } finally {
    res.end();
  }
};
