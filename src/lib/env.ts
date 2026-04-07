/**
 * Environment Variable Validation
 * Validates all required env vars at module load time.
 * App refuses to start if critical vars are missing.
 */
import { z } from 'zod'

const envSchema = z.object({
  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Supabase (required)
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Auth (required)
  JWT_SECRET: z.string().min(16),

  // LLM (required for AI features)
  MINIMAX_API_KEY: z.string().min(1),

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
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    JWT_SECRET: process.env.JWT_SECRET,
    MINIMAX_API_KEY: process.env.MINIMAX_API_KEY,
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
  })

  if (!result.success) {
    const missing = result.error.issues
      .map((i) => i.path.join('.'))
      .join(', ')

    // In development, warn instead of crash
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `[ENV] Missing or invalid env vars: ${missing}. ` +
        `Some features may not work. Fix your .env.local file.`
      )
      // Return partial with defaults for dev
      _env = {
        NODE_ENV: 'development',
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        JWT_SECRET: process.env.JWT_SECRET || '',
        MINIMAX_API_KEY: process.env.MINIMAX_API_KEY || '',
        WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN || 'dev-only-token',
        WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET || 'dev-only-secret',
        EVOLUTION_INSTANCE_NAME: 'synkroo',
      } as Env
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
