import { z } from 'zod';
import { ServiceUnavailableError } from '../database/errors';

/**
 * Local LLM through Ollama (`ollama serve`). No data leaves the machine.
 * Config is read lazily so the app boots without Ollama; calls surface a 503.
 */
const aiEnvSchema = z.object({
  OLLAMA_URL: z.string().url('OLLAMA_URL must be a URL').default('http://localhost:11434'),
  /** Text-only requests. */
  OLLAMA_MODEL: z.string().min(1).default('qwen2.5-coder:7b'),
  /** Requests with images; must be a vision model. */
  OLLAMA_VISION_MODEL: z.string().min(1).default('qwen2.5vl:7b'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(120_000),
});

export type AiEnv = z.infer<typeof aiEnvSchema>;

let cachedEnv: AiEnv | null = null;

export function aiEnv(): AiEnv {
  if (cachedEnv) return cachedEnv;
  const parsed = aiEnvSchema.safeParse({
    OLLAMA_URL: process.env.OLLAMA_URL || undefined,
    OLLAMA_MODEL: process.env.OLLAMA_MODEL || undefined,
    OLLAMA_VISION_MODEL: process.env.OLLAMA_VISION_MODEL || undefined,
    OLLAMA_TIMEOUT_MS: process.env.OLLAMA_TIMEOUT_MS || undefined,
  });
  if (!parsed.success) {
    throw new ServiceUnavailableError(
      `AI is not configured: ${parsed.error.issues.map((issue) => issue.message).join(', ')}`,
    );
  }
  cachedEnv = parsed.data;
  return cachedEnv;
}

export interface ChatJsonInput {
  system: string;
  prompt: string;
  /** Base64-encoded images (no data: prefix), for vision models. */
  images?: string[];
  /** JSON schema the reply must follow (Ollama structured outputs). */
  schema: Record<string, unknown>;
}

/**
 * One non-streaming chat turn constrained to a JSON schema. Returns the parsed
 * JSON; the caller still validates it, since a schema is a hint, not a proof.
 */
export async function chatJson(input: ChatJsonInput): Promise<{ data: unknown; model: string }> {
  const env = aiEnv();
  const model = input.images?.length ? env.OLLAMA_VISION_MODEL : env.OLLAMA_MODEL;
  let response: Response;
  try {
    response = await fetch(new URL('/api/chat', env.OLLAMA_URL), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(env.OLLAMA_TIMEOUT_MS),
      body: JSON.stringify({
        model,
        stream: false,
        format: input.schema,
        options: { temperature: 0 },
        messages: [
          { role: 'system', content: input.system },
          {
            role: 'user',
            content: input.prompt,
            ...(input.images?.length ? { images: input.images } : {}),
          },
        ],
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new ServiceUnavailableError('The AI assistant took too long to answer');
    }
    throw new ServiceUnavailableError('The AI assistant is offline');
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    if (response.status === 404) {
      throw new ServiceUnavailableError(`AI model ${model} is not installed`);
    }
    throw new ServiceUnavailableError(
      `The AI assistant failed (${response.status}) ${detail}`.trim(),
    );
  }

  const body = (await response.json().catch(() => null)) as {
    message?: { content?: string };
  } | null;
  const content = body?.message?.content;
  if (!content) throw new ServiceUnavailableError('The AI assistant returned an empty answer');

  try {
    return { data: JSON.parse(content), model };
  } catch {
    throw new ServiceUnavailableError('The AI assistant returned malformed JSON');
  }
}
