/**
 * P8 Slice 1 — painel de atividade IA (read-only).
 *
 * Tipos + labels puros (sem JSX, sem I/O) compartilhados entre o endpoint
 * server-side (`services/api-handlers/dashboard/activity.ts`) e o painel
 * client (`components/dashboard/ia-activity-panel.tsx`).
 *
 * Allowlist de exposição (critério 5): só os campos destes tipos chegam ao
 * cliente. NUNCA `payload`, `result`, `sources`, `subject_id`, `error_code`
 * ou qualquer outro campo fora desta lista.
 */

/** Limite fixo de recentes (endpoint + painel). */
export const IA_ACTIVITY_RECENT_LIMIT = 20 as const;

export type IaActivityItemKind = 'run' | 'journey';

export interface IaActivityRecentItem {
  /** Chave estável e opaca (`run:<uuid>` | `journey:<uuid>`) — sem PII. */
  key: string;
  kind: IaActivityItemKind;
  /** Literal do banco (`observed` | `queued` | `failed` | journey state). */
  status: string;
  /** Rótulo pt-BR derivado do status (ex.: `proposta observada`). */
  label: string;
  /** Runs: `business_events.type`; journeys: `journey_kind`; senão null. */
  eventType: string | null;
  /** Runs: `business_events.occurred_at`; journeys: null. ISO string. */
  occurredAt: string | null;
  /** ISO string (ordenação desc da lista). */
  createdAt: string;
  /** Journeys terminais: `outcome`; senão null. */
  detail: string | null;
}

export interface IaActivityCounts {
  runs: Record<string, number>;
  goals: Record<string, number>;
  journeys: Record<string, number>;
  total: number;
}

export interface IaActivity {
  counts: IaActivityCounts;
  recent: IaActivityRecentItem[];
}

/**
 * Rótulo pt-BR de run P4 OBSERVE. O literal `observed` mapeia para
 * `proposta observada`; status desconhecido cai no próprio literal
 * (nunca string vazia — o painel sempre tem o que exibir).
 */
export function runStatusLabel(status: string): string {
  switch (status) {
    case 'observed':
      return 'proposta observada';
    case 'queued':
      return 'em observação';
    case 'failed':
      return 'falha na observação';
    default:
      return status;
  }
}

/** Rótulo pt-BR de journey P7 (state machine S1). Fallback: literal. */
export function journeyStateLabel(state: string): string {
  switch (state) {
    case 'waiting_due':
      return 'aguardando acompanhamento';
    case 'recommended':
      return 'recomendação gerada';
    case 'waiting_feedback':
      return 'aguardando retorno';
    case 'completed':
      return 'acompanhamento concluído';
    case 'expired':
      return 'acompanhamento expirado';
    case 'stopped':
      return 'acompanhamento interrompido';
    default:
      return state;
  }
}
