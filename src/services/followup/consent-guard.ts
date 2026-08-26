/**
 * F7.08 — consent versionado antes de dispatch não transacional.
 * Verifica se consent version do payload bate com o armazenado.
 */
export interface ConsentRecord {
  patientId: string;
  version: number;
  optOutMarketing: boolean;
}

export function assertConsentVersion(
  stored: ConsentRecord | null,
  payloadVersion: number,
): void {
  if (!stored) throw new Error('consent missing');
  if (stored.optOutMarketing) throw new Error('consent opted-out');
  if (stored.version !== payloadVersion) throw new Error('consent stale');
}
