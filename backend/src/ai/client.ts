import Anthropic from '@anthropic-ai/sdk';
import { env, isAiEnabled } from '../config/env.js';
import { logger } from '../config/logger.js';

let client: Anthropic | null = null;

/**
 * The Anthropic client, built on first use.
 *
 * The key is passed explicitly rather than letting the SDK resolve it: on a server the
 * credential is an API key from the environment, never an interactive `ant auth login`
 * profile, and gating on one variable is what keeps the AI routes off until you opt in.
 */
export function getClaude(): Anthropic {
  if (!isAiEnabled) {
    throw new Error('AI is not configured. Set ANTHROPIC_API_KEY to enable the /api/ai routes.');
  }
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

export function isAiConnected(): boolean {
  return client !== null;
}

/** Logs whether the AI routes are live. No network call — the first request proves the key. */
export function reportAiStatus(): void {
  if (!isAiEnabled) {
    logger.debug('AI not configured — skipping (set ANTHROPIC_API_KEY to enable /api/ai)');
    return;
  }
  logger.info(
    { model: env.ANTHROPIC_MODEL, effort: env.ANTHROPIC_EFFORT },
    'AI routes enabled at /api/ai',
  );
}

/** Test seam. */
export function resetClaude(): void {
  client = null;
}
