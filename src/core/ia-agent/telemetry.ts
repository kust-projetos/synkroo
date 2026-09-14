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
  /** Código estruturado (RpcError, LlmError.code, contract_version_mismatch…). */
  code?: string;
  /** Tentativa da chamada de provider (1-based). */
  attempt?: number;
  provider?: string;
  model?: string;
  usage?: TelemetryUsage;
  /** Detalhe sem PII (mensagem sanitizada, nunca userMessage). */
  detail?: string;
}

export type TelemetrySink = (event: TelemetryEvent) => void;

/** Extrai correlationId de input não confiável (borda RPC) sem quebrar. */
export function extractCorrelationId(input: unknown): string | undefined {
  if (input === null || typeof input !== 'object') return undefined;
  const v = (input as { correlationId?: unknown }).correlationId;
  return typeof v === 'string' && v.length > 0 ? v : undefined;
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
