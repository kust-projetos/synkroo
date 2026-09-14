/**
 * B2 — telemetria mínima edge-safe para a cadeia IA.
 *
 * Propositalmente SEM dependências: não importa `src/lib/logger` (acoplado a
 * `process.env`) para rodar no runtime Cloudflare (workers ia-agent/ia-bridge
 * e DO). Saída em JSON estruturado via console; sink injetável para testes.
 */

export type TelemetryStatus = 'ok' | 'error' | 'fallback';

export interface TelemetryUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface TelemetryEvent {
  /** Correlation id ponta a ponta (x-request-id da rota). */
  correlationId?: string;
  /** Clínica quando conhecida no ponto de emissão (nunca PII). */
  clinicId?: string;
  /** ex.: run_turn | execute_action | provider_call | invoke_agent */
  operation: string;
  durationMs?: number;
  status: TelemetryStatus;
  /**
   * Código estruturado de allowlist sintática (normalizeCode). NUNCA texto
   * derivado de exceção, resposta de provider ou payload — só códigos
   * gerados pelo próprio código (RpcError, LlmError.code, mapa abaixo).
   */
  code?: string;
  /** Tentativa da chamada de provider (1-based). */
  attempt?: number;
  provider?: string;
  model?: string;
  usage?: TelemetryUsage;
  /**
   * Descrição ESTÁTICA resolvida de CODE_DESCRIPTIONS (texto fixo por código,
   * preenchida pelo logger — emitentes nunca escrevem texto livre aqui).
   */
  description?: string;
}

export type TelemetrySink = (event: TelemetryEvent) => void;

/** Extrai correlationId de input não confiável (borda RPC) sem quebrar. */
export function extractCorrelationId(input: unknown): string | undefined {
  if (input === null || typeof input !== 'object') return undefined;
  const v = (input as { correlationId?: unknown }).correlationId;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

/**
 * Descrições ESTÁTICAS por código — único texto humano legível nos logs.
 * Nenhum valor aqui deriva de input externo, exceção ou resposta de provider.
 */
const CODE_DESCRIPTIONS: Record<string, string> = {
  contract_version_mismatch: 'versão de contrato RPC incompatível',
  empty_completion: 'provider retornou conclusão vazia',
  max_iterations_exhausted: 'limite de iterações do turno atingido',
  confirmed: 'ação confirmada e executada',
  provider_error: 'falha genérica de provider',
  timeout: 'chamada ao provider excedeu o timeout',
  http_4xx: 'provider respondeu erro cliente',
  http_5xx: 'provider respondeu erro servidor',
  http_unparseable: 'provider respondeu corpo fora do formato esperado',
  rate_limited: 'provider aplicou rate limit',
  unauthorized: 'falha de autenticação no provider',
  invalid_response: 'resposta inválida do provider',
  provider_down: 'provider indisponível ou falha de rede',
  needs_identity: 'ação exige verificação de identidade',
  needs_confirmation: 'ação exige confirmação',
  escalate_human: 'encaminhado para atendente humano',
  forbidden: 'ação negada por permissão',
  duplicate: 'operação duplicada (idempotência)',
  unknown_tool: 'ferramenta desconhecida ou fora da allowlist',
  invalid_signature: 'assinatura do handle inválida',
  expired: 'handle expirado',
  malformed: 'handle malformado',
  conversation_mismatch: 'handle de outra conversa',
  replayed: 'handle reutilizado indevidamente',
  invoke_failed: 'falha ao acionar o agente',
  rpc_timeout: 'timeout da chamada RPC completa',
  internal: 'erro interno no worker',
};

/** Allowlist sintática de códigos: minúsculas, dígitos e underscore, até 64 chars. */
const CODE_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;

/**
 * Normaliza código vindo de fronteira (bridge RPC, erro de provider) para a
 * allowlist sintática; fora do padrão, cai para o fallback fechado.
 */
export function normalizeCode(raw: unknown, fallback = 'provider_error'): string {
  return typeof raw === 'string' && CODE_PATTERN.test(raw) ? raw : fallback;
}

/** Descrição estática do código (nunca ecoa input externo). */
export function describeCode(code: string | undefined): string {
  if (!code) return 'evento sem código';
  return CODE_DESCRIPTIONS[code] ?? 'erro operacional (ver código)';
}

export function createTelemetryLogger(
  service: string,
  sink?: TelemetrySink,
): TelemetrySink {
  if (sink) return sink;
  return (event: TelemetryEvent) => {
    const entry = {
      ts: new Date().toISOString(),
      level: event.status === 'error' ? 'error' : 'info',
      service,
      ...event,
      description: describeCode(event.code),
    };
    const line = JSON.stringify(entry);
    // eslint-disable-next-line no-console
    if (event.status === 'error') console.error(line);
    // eslint-disable-next-line no-console
    else console.log(line);
  };
}

/** Sink neutro para caminhos onde o caller não quer emitir (ex.: unit tests legados). */
export const noopTelemetry: TelemetrySink = () => {};
