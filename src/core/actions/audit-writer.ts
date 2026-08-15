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

const SENSITIVE_AUDIT_KEYS = new Set([
  'address', 'authorization', 'birthdate', 'cpf', 'document', 'email', 'healthnotes',
  'medicalhistory', 'name', 'password', 'patient', 'patientname', 'phone', 'secret',
  'token', 'access_token', 'refresh_token',
]);

function redactAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactAuditValue).filter((item) => item !== undefined);
  }
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !SENSITIVE_AUDIT_KEYS.has(key.toLowerCase()))
      .map(([key, nested]) => [key, redactAuditValue(nested)])
      .filter(([, nested]) => nested !== undefined),
  );
}

export function allowlistInput(input: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  return Object.fromEntries(
    allowed
      .filter((key) => key in source)
      .map((key) => [key, redactAuditValue(source[key])]),
  );
}
