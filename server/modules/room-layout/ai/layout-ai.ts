import { DomainError } from '../../../shared/database/errors';
import { layoutAiConfig } from './ai.config';
import {
  AI_LAYOUT_JSON_SCHEMA,
  AiLayoutSchema,
  buildLayoutMessages,
  type AiLayout,
  type PlannerRoom,
  type PlannerUnit,
} from './layout-prompt';
import { askGroq, askOllama, ProviderError } from './providers';

export type AiProvider = 'ollama' | 'groq';

export interface AiAttempt {
  provider: AiProvider;
  model: string;
  ok: boolean;
  ms: number;
  error?: string;
}

export interface AiPlanResult {
  layout: AiLayout;
  provider: AiProvider;
  model: string;
  attempts: AiAttempt[];
}

/**
 * Ollama first, Groq if Ollama is missing, slow, down or answers badly.
 * Every attempt is recorded so the client can see who answered and why.
 */
export async function planWithAi(
  rooms: PlannerRoom[],
  units: PlannerUnit[],
): Promise<AiPlanResult> {
  const config = layoutAiConfig();
  const prompt = buildLayoutMessages(rooms, units);
  const attempts: AiAttempt[] = [];

  const providers = [
    { provider: 'ollama' as const, model: config.OLLAMA_MODEL, ask: askOllama },
    { provider: 'groq' as const, model: config.GROQ_MODEL, ask: askGroq },
  ];

  for (const { provider, model, ask } of providers) {
    const configured = provider === 'ollama' ? Boolean(model) : Boolean(config.GROQ_API_KEY);
    if (!configured) {
      attempts.push({ provider, model, ok: false, ms: 0, error: 'not configured' });
      continue;
    }
    const started = Date.now();
    try {
      const raw = await ask(config, prompt, AI_LAYOUT_JSON_SCHEMA);
      const layout = AiLayoutSchema.parse(JSON.parse(raw));
      attempts.push({ provider, model, ok: true, ms: Date.now() - started });
      return { layout, provider, model, attempts };
    } catch (error) {
      const message =
        error instanceof ProviderError
          ? error.message
          : error instanceof SyntaxError
            ? 'answer was not valid JSON'
            : 'answer did not match the layout format';
      attempts.push({ provider, model, ok: false, ms: Date.now() - started, error: message });
    }
  }

  throw new DomainError(
    `The layout assistant is unavailable right now (${attempts
      .map((attempt) => `${attempt.provider}: ${attempt.error}`)
      .join('; ')}). Try again in a minute.`,
    503,
    'LAYOUT_AI_UNAVAILABLE',
  );
}
