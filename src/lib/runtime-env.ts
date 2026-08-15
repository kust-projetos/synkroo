import { z } from 'zod'

export type RuntimeName = 'app' | 'bridge' | 'agent' | 'sidecar'

const appSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  AUTH_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(16),
  DATABASE_URL: z.string().url().optional(),
  HYPERDRIVE: z.unknown().optional(),
}).superRefine((value, ctx) => {
  if (!value.DATABASE_URL && !value.HYPERDRIVE) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['DATABASE_URL', 'HYPERDRIVE'], message: 'database transport required' })
  }
})

const bridgeSchema = z.object({
  HANDLE_SECRET: z.string().min(32),
  IA_SEEN: z.unknown().refine(Boolean, 'IA_SEEN binding required'),
})

const agentSchema = z.object({
  OPENCODE_ZEN_API_KEY: z.string().min(1),
  IA_LLM_MODEL: z.string().min(1),
  IA_LLM_BASE_URL: z.string().url(),
  APP: z.unknown().refine(Boolean, 'APP binding required'),
})

const sidecarSchema = z.object({
  SIDECAR_SHARED_SECRET: z.string().min(32),
  SIDECAR_EGRESS_ALLOWLIST: z.string().min(1),
  SIDECAR_DEFAULT_OFF: z.literal('true'),
})

const schemas: Record<RuntimeName, z.ZodTypeAny> = {
  app: appSchema,
  bridge: bridgeSchema,
  agent: agentSchema,
  sidecar: sidecarSchema,
}

export function parseRuntimeEnv(runtime: RuntimeName, input: Record<string, unknown>): unknown {
  const schema = schemas[runtime]
  if (!schema) throw new Error(`[ENV:${runtime}] unsupported runtime`)
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const fields = result.error.issues.map((issue) => issue.path.join('.') || 'root').join(', ')
  throw new Error(`[ENV:${runtime}] invalid required fields: ${fields}`)
}
