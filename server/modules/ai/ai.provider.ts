import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';

/**
 * Single place that knows which LLM we talk to (course ch.6 — "Zéro lock-in").
 * Every feature asks for `aiModel()`; switching OpenAI ↔ Gemini is one env var.
 * Keys are read by the providers from OPENAI_API_KEY / GOOGLE_GENERATIVE_AI_API_KEY,
 * server-side only (never NEXT_PUBLIC_*).
 */
export type AiProviderName = 'openai' | 'google';

const DEFAULT_MODELS: Record<AiProviderName, string> = {
  openai: 'gpt-4o-mini',
  google: 'gemini-2.5-flash',
};

export function aiProviderName(): AiProviderName {
  return process.env.AI_PROVIDER === 'google' ? 'google' : 'openai';
}

export function aiModelId(): string {
  return process.env.AI_MODEL || DEFAULT_MODELS[aiProviderName()];
}

/** True when the configured provider has a key — otherwise features fall back to rules. */
export function isAiEnabled(): boolean {
  if (process.env.AI_DISABLED === 'true') return false;
  return aiProviderName() === 'google'
    ? Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
    : Boolean(process.env.OPENAI_API_KEY);
}

export function aiModel() {
  const id = aiModelId();
  return aiProviderName() === 'google' ? google(id) : openai(id);
}

/** Production guardrails (course ch.6 "maxTokens & Timeout"). */
export const AI_LIMITS = {
  /** Hard ceiling on generated tokens per call. */
  maxOutputTokens: 700,
  /** Abort the provider call after this many ms and fall back / show an error. */
  timeoutMs: 25_000,
  /** Chat messages per user per rolling hour. */
  chatPerHour: Number(process.env.AI_RATE_LIMIT_PER_HOUR ?? 30),
  /** Only the latest N chat messages are sent back to the model (cost + context). */
  historyWindow: 12,
} as const;
