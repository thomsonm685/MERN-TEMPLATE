import type Anthropic from '@anthropic-ai/sdk';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { getClaude } from './client.js';

export interface AskOptions {
  messages: Anthropic.Beta.BetaMessageParam[];
  system?: string;
  maxTokens?: number;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

export interface AskResult {
  text: string;
  model: string;
  stopReason: string | null;
  /** Populated only when stopReason is 'refusal'. */
  refusal: { category: string | null; explanation: string | null } | null;
  usage: { inputTokens: number; outputTokens: number };
}

function resolve(options: AskOptions) {
  return {
    model: env.ANTHROPIC_MODEL,
    max_tokens: options.maxTokens ?? env.ANTHROPIC_MAX_TOKENS,
    system: options.system ?? env.ANTHROPIC_SYSTEM_PROMPT,
    // Adaptive thinking: Claude decides how much to think per request. The older
    // fixed `budget_tokens` form is rejected outright by current models.
    thinking: { type: 'adaptive' as const },
    output_config: { effort: options.effort ?? env.ANTHROPIC_EFFORT },
    messages: options.messages,
  };
}

/**
 * Opting into the server-side refusal fallback. Without it a safety decline simply stops;
 * with it the API re-runs the request on another model inside the same call. The beta flag
 * and the `fallbacks` form must match — `"default"` pairs with the -07-01 header.
 */
const fallbackParams = env.ANTHROPIC_REFUSAL_FALLBACK
  ? { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const }
  : { betas: [] as string[] };

/** Concatenates the text blocks of a response; content is a union, so narrow before reading. */
function textOf(content: Anthropic.Beta.BetaContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('');
}

/**
 * One request, one response.
 *
 * Always check `stopReason` before trusting `text`: a safety decline returns HTTP 200 with
 * `stop_reason: 'refusal'` and no useful content, rather than throwing.
 */
export async function ask(options: AskOptions): Promise<AskResult> {
  const { model, max_tokens, system, thinking, output_config, messages } = resolve(options);

  const response = await getClaude().beta.messages.create({
    model,
    max_tokens,
    ...(system && { system }),
    thinking,
    output_config,
    messages,
    ...fallbackParams,
  });

  const refused = response.stop_reason === 'refusal';
  if (refused) {
    logger.warn({ stopDetails: response.stop_details }, 'Claude declined the request');
  }

  return {
    text: textOf(response.content),
    model: response.model,
    stopReason: response.stop_reason,
    refusal: refused
      ? {
          category: response.stop_details?.category ?? null,
          explanation: response.stop_details?.explanation ?? null,
        }
      : null,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

/**
 * Streams the reply, calling `onText` for each delta.
 *
 * Streaming is the right default for anything long: it sidesteps the SDK's HTTP timeout on
 * large `max_tokens`, and it is what a chat UI needs. Resolves with the assembled result
 * once the stream finishes.
 */
export async function askStream(
  options: AskOptions,
  onText: (delta: string) => void,
): Promise<AskResult> {
  const { model, max_tokens, system, thinking, output_config, messages } = resolve(options);

  const stream = getClaude().beta.messages.stream({
    model,
    max_tokens,
    ...(system && { system }),
    thinking,
    output_config,
    messages,
    ...fallbackParams,
  });

  stream.on('text', onText);

  // The SDK assembles the final message for us — no need to accumulate deltas by hand.
  const response = await stream.finalMessage();
  const refused = response.stop_reason === 'refusal';

  return {
    text: textOf(response.content),
    model: response.model,
    stopReason: response.stop_reason,
    refusal: refused
      ? {
          category: response.stop_details?.category ?? null,
          explanation: response.stop_details?.explanation ?? null,
        }
      : null,
    usage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}
