import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 30),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DB_NAME: z.string().min(1).default('moveup'),
  /** Time a mover has to answer an offer before it moves on (spec 9.3). */
  OFFER_TTL_MINUTES: z.coerce.number().int().positive().default(120),
  /** Private folder for mover uploads until the S3 storage driver is connected. */
  UPLOAD_DIR: z.string().min(1).default('.uploads'),
  /** Defaults to on in production. The offline build turns it off to work over http://localhost. */
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Validated, lazily-cached environment configuration. Throws on boot with invalid env. */
export function env(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    JWT_SECRET: process.env.JWT_SECRET,
    ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL,
    REFRESH_TOKEN_TTL: process.env.REFRESH_TOKEN_TTL,
    MONGODB_URI: process.env.MONGODB_URI,
    MONGODB_DB_NAME: process.env.MONGODB_DB_NAME || undefined,
    OFFER_TTL_MINUTES: process.env.OFFER_TTL_MINUTES || undefined,
    UPLOAD_DIR: process.env.UPLOAD_DIR || undefined,
    COOKIE_SECURE: process.env.COOKIE_SECURE || undefined,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid environment configuration:\n${parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
        .join('\n')}`,
    );
  }

  cached = parsed.data;
  return cached;
}
