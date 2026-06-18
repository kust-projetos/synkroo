import { getDb } from '@/lib/db/client';
import { actionLogs } from '@/lib/db/schema/audit';
import { dbLogger } from '@/lib/logger';

export interface ActionLogRecord {
  clinicId: string | null;
  principalType: string | null;
  actor: string;
  onBehalfOf?: string | null;
  actionName: string;
  module: string;
  inputRedacted: unknown;
  result: 'ok' | 'error';
  errorCode?: string | null;
}

export async function writeActionLog(rec: ActionLogRecord): Promise<void> {
  try {
    await getDb().insert(actionLogs).values({
      clinicId: rec.clinicId, principalType: rec.principalType, actor: rec.actor,
      onBehalfOf: rec.onBehalfOf ?? null, actionName: rec.actionName, module: rec.module,
      inputRedacted: rec.inputRedacted as any, result: rec.result, errorCode: rec.errorCode ?? null,
    });
  } catch (err) {
    dbLogger.error('failed to write action_log', err, { actionName: rec.actionName });
  }
}

// Mascara campos sensíveis do input antes de logar (LGPD).
export function redactInput(input: unknown, sensitive: string[]): unknown {
  if (!input || typeof input !== 'object') return input;
  const clone: Record<string, unknown> = { ...(input as Record<string, unknown>) };
  for (const key of sensitive) if (key in clone) clone[key] = '[REDACTED]';
  return clone;
}
