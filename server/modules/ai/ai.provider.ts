import { generateText } from 'ai';
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

/** True when a key is configured, regardless of the circuit breaker. */
export function isAiConfigured(): boolean {
  if (process.env.AI_DISABLED === 'true') return false;
  return aiProviderName() === 'google'
    ? Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
    : Boolean(process.env.OPENAI_API_KEY);
}

/* ---------- Quota circuit breaker ----------
 * Free-tier keys hit per-minute / per-day quotas. When a provider call fails we stop
 * calling it for a cooldown window and every feature serves the rule engine instead,
 * then we retry the cloud model automatically once the window has passed.
 */
const COOLDOWN_MS = Number(process.env.AI_COOLDOWN_MS ?? 5 * 60_000);
const PROBE_TTL_MS = 60_000;
let cooldownUntil = 0;
let lastFailureReason: string | null = null;
let lastProbeAt = 0;
let lastProbeOk = false;

export function isQuotaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as { statusCode?: number } | null)?.statusCode;
  return (
    status === 429 ||
    status === 401 ||
    status === 403 ||
    /quota|rate.?limit|exhausted|too many requests|resource_exhausted|api key|billing|permission/i.test(
      message,
    )
  );
}

/** Opens the breaker: the cloud model is skipped until the cooldown expires. */
export function markAiFailure(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  // Quota/auth errors wait the full window; transient errors (timeout, 5xx) retry sooner.
  const wait = isQuotaError(error) ? COOLDOWN_MS : Math.min(COOLDOWN_MS, 30_000);
  cooldownUntil = Date.now() + wait;
  lastFailureReason = message.slice(0, 160);
  lastProbeOk = false;
  lastProbeAt = Date.now();
  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      `[ai] provider unavailable, serving rule engine for ${Math.round(wait / 1000)}s: ${lastFailureReason}`,
    );
  }
}

export function aiBreakerStatus() {
  const remainingMs = Math.max(0, cooldownUntil - Date.now());
  return { coolingDown: remainingMs > 0, remainingMs, lastFailureReason };
}

/** True when a key is configured and the breaker is closed — otherwise features fall back to rules. */
export function isAiEnabled(): boolean {
  return isAiConfigured() && Date.now() >= cooldownUntil;
}

/**
 * For streaming routes: a stream that fails after the response has started cannot fall
 * back, so we confirm the provider answers (cached for 60s) before opening the stream.
 */
export async function isAiAvailable(): Promise<boolean> {
  if (!isAiEnabled()) return false;
  if (Date.now() - lastProbeAt < PROBE_TTL_MS) return lastProbeOk;
  try {
    await generateText({
      model: aiModel(),
      prompt: 'Reply with OK',
      maxOutputTokens: 5,
      abortSignal: AbortSignal.timeout(6_000),
    });
    lastProbeOk = true;
  } catch (error) {
    markAiFailure(error);
  }
  lastProbeAt = Date.now();
  return lastProbeOk;
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
