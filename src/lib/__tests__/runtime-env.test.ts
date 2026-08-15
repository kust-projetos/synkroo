import { parseRuntimeEnv } from '../runtime-env'

const secret = (length: number) => 'x'.repeat(length)

describe('runtime environment schemas', () => {
  it('requires app auth secrets and a database transport', () => {
    expect(() => parseRuntimeEnv('app', { AUTH_SECRET: 'short' })).toThrow(/AUTH_SECRET|JWT_SECRET|DATABASE_URL|HYPERDRIVE/)
    expect(() => parseRuntimeEnv('app', {
      AUTH_SECRET: secret(32),
      JWT_SECRET: secret(16),
      HYPERDRIVE: {},
    })).not.toThrow()
  })

  it('requires bridge and agent bindings', () => {
    expect(() => parseRuntimeEnv('bridge', {})).toThrow(/HANDLE_SECRET|IA_SEEN/)
    expect(() => parseRuntimeEnv('bridge', {
      HANDLE_SECRET: secret(32),
      IA_SEEN: {},
      HYPERDRIVE: { connectionString: 'hyperdrive-placeholder' },
    })).not.toThrow()
    expect(() => parseRuntimeEnv('agent', {
      OPENCODE_ZEN_API_KEY: 'configured',
      IA_LLM_MODEL: 'model',
      IA_LLM_BASE_URL: 'https://llm.example.test',
      APP: {},
    })).not.toThrow()
  })

  it('requires sidecar security settings and explicit off default', () => {
    expect(() => parseRuntimeEnv('sidecar', { SIDECAR_DEFAULT_OFF: 'false' })).toThrow(/SIDECAR/)
    expect(() => parseRuntimeEnv('sidecar', {
      SIDECAR_SHARED_SECRET: secret(32),
      SIDECAR_EGRESS_ALLOWLIST: 'https://playwright.example.test',
      SIDECAR_DEFAULT_OFF: 'true',
    })).not.toThrow()
  })
})
