/**
 * AI subsystem — Claude via the official Anthropic SDK.
 *
 *   ask({ messages })              one request, one response
 *   askStream({ messages }, onText) the same, streamed
 *
 * Inert without ANTHROPIC_API_KEY: the /api/ai routes are not mounted and `getClaude()`
 * throws if something calls it anyway.
 */
export { ask, askStream, type AskOptions, type AskResult } from './service.js';
export { getClaude, isAiConnected, reportAiStatus, resetClaude } from './client.js';
