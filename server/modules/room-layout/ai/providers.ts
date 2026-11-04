import type { LayoutAiConfig } from './ai.config';

export interface ChatPrompt {
  system: string;
  user: string;
}

/** Short, key-free error text for the UI ("Ollama failed: …"). */
function describe(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'TimeoutError') return 'timed out';
    // undici reports any refused/unknown host as a bare "fetch failed".
    if (error.message === 'fetch failed') return 'not reachable (is it running?)';
    return error.message.slice(0, 160);
  }
  return 'unknown error';
}

export class ProviderError extends Error {}

async function postJson(url: string, body: unknown, timeoutMs: number, headers = {}) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new ProviderError(describe(error));
  }
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    const apiError = data?.error;
    const message =
      typeof apiError === 'string'
        ? apiError
        : typeof (apiError as { message?: unknown })?.message === 'string'
          ? (apiError as { message: string }).message
          : `HTTP ${response.status}`;
    throw new ProviderError(message.slice(0, 160));
  }
  return data ?? {};
}

/** Local Ollama: /api/chat with a JSON-schema `format` (structured output). */
export async function askOllama(
  config: LayoutAiConfig,
  prompt: ChatPrompt,
  jsonSchema: Record<string, unknown>,
): Promise<string> {
  const data = await postJson(
    `${config.OLLAMA_BASE_URL}/api/chat`,
    {
      model: config.OLLAMA_MODEL,
      stream: false,
      think: false,
      format: jsonSchema,
      options: { temperature: 0.2 },
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    },
    config.OLLAMA_TIMEOUT_MS,
  );
  const content = (data.message as { content?: unknown } | undefined)?.content;
  if (typeof content !== 'string' || !content) throw new ProviderError('empty answer');
  return content;
}

/** Groq (OpenAI-compatible) with strict JSON-schema structured output. */
export async function askGroq(
  config: LayoutAiConfig,
  prompt: ChatPrompt,
  jsonSchema: Record<string, unknown>,
): Promise<string> {
  const data = await postJson(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: config.GROQ_MODEL,
      temperature: 0.2,
      reasoning_effort: 'low',
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'room_layout', strict: true, schema: jsonSchema },
      },
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
    },
    config.GROQ_TIMEOUT_MS,
    { authorization: `Bearer ${config.GROQ_API_KEY}` },
  );
  const choices = data.choices as { message?: { content?: unknown } }[] | undefined;
  const content = choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content) throw new ProviderError('empty answer');
  return content;
}
