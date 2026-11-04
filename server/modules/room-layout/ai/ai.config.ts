import { z } from 'zod';

/**
 * Layout AI settings, read here so the shared server/config/env.ts stays untouched.
 * An empty OLLAMA_MODEL or GROQ_API_KEY simply skips that provider.
 */
const schema = z.object({
  OLLAMA_BASE_URL: z.string().url().default('http://localhost:11434'),
  OLLAMA_MODEL: z.string().trim().default(''),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
  GROQ_API_KEY: z.string().trim().default(''),
  GROQ_MODEL: z.string().trim().default('openai/gpt-oss-120b'),
  GROQ_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
});

export type LayoutAiConfig = z.infer<typeof schema>;

export function layoutAiConfig(): LayoutAiConfig {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid layout AI configuration: ${parsed.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  }
  return parsed.data;
}
