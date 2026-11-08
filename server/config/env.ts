import { z } from 'zod';

/** Treats quoted/empty env values (KEY=) as "not configured". */
function emptyToUndefined(value: unknown): unknown {
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
}

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
  // Web3 is optional: the app still boots without it, but contract endpoints
  // return a clear "not configured" error until these are set.
  NEXT_PUBLIC_CHAIN_ID: z.preprocess(
    emptyToUndefined,
    z.coerce.number().int().positive().optional(),
  ),
  NEXT_PUBLIC_RPC_URL: z.preprocess(
    emptyToUndefined,
    z.string().url().optional(),
  ),
  NEXT_PUBLIC_CONTRACT_ADDRESS: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/, 'NEXT_PUBLIC_CONTRACT_ADDRESS must be a 20-byte hex address')
      .optional(),
  ),
  // System wallet that pays the gas for contract anchoring. It is not an app
  // user: HR and employees only produce free EIP-712 signatures, this key is
  // the only account that ever sends (and pays for) a transaction.
  CONTRACT_ADMIN_PRIVATE_KEY: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^0x[a-fA-F0-9]{64}$/, 'CONTRACT_ADMIN_PRIVATE_KEY must be a 32-byte hex private key')
      .optional(),
  ),
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
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
    NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL,
    NEXT_PUBLIC_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
    CONTRACT_ADMIN_PRIVATE_KEY: process.env.CONTRACT_ADMIN_PRIVATE_KEY,
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
