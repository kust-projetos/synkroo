/**
 * Environment Variable Validation
 * Validates all required env vars at module load time.
 * App refuses to start if critical vars are missing.
 */
import { z } from 'zod'

const envSchema = z.object({
  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // PostgreSQL / Drizzle (new stack)
  DATABASE_URL: z.string().url().optional(),
  POSTGRES_HOST: z.string().min(1).optional(),
  POSTGRES_PORT: z.coerce.number().int().positive().optional(),
  POSTGRES_DB: z.string().min(1).optional(),
  POSTGRES_USER: z.string().min(1).optional(),
  POSTGRES_PASSWORD: z.string().min(1).optional(),

  // Auth (required)
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(16),


  // WhatsApp (required for WhatsApp integration)
  WHATSAPP_VERIFY_TOKEN: z.string().min(8),
  WHATSAPP_APP_SECRET: z.string().min(8),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),

  // Instagram (optional - only required if using Instagram)
  INSTAGRAM_VERIFY_TOKEN: z.string().min(8).optional(),
  INSTAGRAM_ACCESS_TOKEN: z.string().min(1).optional(),
  INSTAGRAM_ACCOUNT_ID: z.string().min(1).optional(),

  // Evolution API (optional)
  EVOLUTION_API_URL: z.string().url().optional(),
  EVOLUTION_API_KEY: z.string().min(1).optional(),
  EVOLUTION_INSTANCE_NAME: z.string().min(1).default('synkroo'),

  // Embeddings (at least one provider)
  JINA_API_KEY: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  HUGGINGFACE_API_KEY: z.string().min(1).optional(),
  OLLAMA_HOST: z.string().url().optional(),

  // Cron
  CRON_SECRET: z.string().min(1).optional(),

  // Development mocks (client-side flag — NEXT_PUBLIC_ is exposed to browser)
  NEXT_PUBLIC_USE_MOCKS: z.string().optional(),
})

export type Env = z.infer<typeof envSchema>

let _env: Env | null = null

/**
 * Validate and return environment variables.
 * Caches result after first call.
 * Throws at module load if critical vars are missing.
 */
export function getEnv(): Env {
  if (_env) return _env

  const result = envSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    POSTGRES_HOST: process.env.POSTGRES_HOST,
    POSTGRES_PORT: process.env.POSTGRES_PORT,
    POSTGRES_DB: process.env.POSTGRES_DB,
    POSTGRES_USER: process.env.POSTGRES_USER,
    POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
    AUTH_SECRET: process.env.AUTH_SECRET,
    AUTH_URL: process.env.AUTH_URL,
    JWT_SECRET: process.env.JWT_SECRET,
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    INSTAGRAM_VERIFY_TOKEN: process.env.INSTAGRAM_VERIFY_TOKEN,
    INSTAGRAM_ACCESS_TOKEN: process.env.INSTAGRAM_ACCESS_TOKEN,
    INSTAGRAM_ACCOUNT_ID: process.env.INSTAGRAM_ACCOUNT_ID,
    EVOLUTION_API_URL: process.env.EVOLUTION_API_URL,
    EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY,
    EVOLUTION_INSTANCE_NAME: process.env.EVOLUTION_INSTANCE_NAME,
    JINA_API_KEY: process.env.JINA_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    HUGGINGFACE_API_KEY: process.env.HUGGINGFACE_API_KEY,
    OLLAMA_HOST: process.env.OLLAMA_HOST,
    CRON_SECRET: process.env.CRON_SECRET,
    NEXT_PUBLIC_USE_MOCKS: process.env.NEXT_PUBLIC_USE_MOCKS,
  })

  if (!result.success) {
    const missing = result.error.issues
      .map((i) => i.path.join('.'))
      .join(', ')

    // Warn in development but still throw for critical vars
    const criticalVars = ['JWT_SECRET']
    const hasCriticalMissing = criticalVars.some(c =>
      result.error.issues.some(i => i.path.join('.') === c && i.message.includes('string'))
    )

    if (process.env.NODE_ENV === 'development' && !hasCriticalMissing) {
      console.warn(
        `[ENV] Missing or invalid env vars: ${missing}. ` +
        `Some features may not work. Fix your .env.local file.`
      )
      // In dev, allow app to start with missing optional vars but NOT critical ones
      // Merge validated data with env vars (using actual values, not empty defaults)
      const partial = {
        NODE_ENV: (process.env.NODE_ENV || 'development') as Env['NODE_ENV'],
        DATABASE_URL: process.env.DATABASE_URL,
        POSTGRES_HOST: process.env.POSTGRES_HOST,
        POSTGRES_PORT: process.env.POSTGRES_PORT ? Number(process.env.POSTGRES_PORT) : undefined,
        POSTGRES_DB: process.env.POSTGRES_DB,
        POSTGRES_USER: process.env.POSTGRES_USER,
        POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
        AUTH_SECRET: process.env.AUTH_SECRET,
        AUTH_URL: process.env.AUTH_URL,
        JWT_SECRET: process.env.JWT_SECRET || '',
        WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || '',
        WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET || '',
        EVOLUTION_INSTANCE_NAME: 'synkroo',
        NEXT_PUBLIC_USE_MOCKS: process.env.NEXT_PUBLIC_USE_MOCKS,
      }
      _env = partial as Env
      return _env
    }

    throw new Error(
      `[ENV] Invalid environment configuration: ${missing}. ` +
      `Application cannot start. Check your .env file.`
    )
  }

  _env = result.data
  return _env
}

/**
 * Check if WhatsApp integration is configured
 */
export function isWhatsAppConfigured(): boolean {
  const env = getEnv()
  return !!(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_VERIFY_TOKEN && env.WHATSAPP_APP_SECRET)
}

/**
 * Check if Instagram integration is configured
 */
export function isInstagramConfigured(): boolean {
  const env = getEnv()
  return !!(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_ACCOUNT_ID && env.INSTAGRAM_VERIFY_TOKEN)
}
