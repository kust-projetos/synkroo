/**
 * LGPD contributions registry — decouples Operacional LGPD orchestration from
 * direct cross-module schema imports. Each owning module registers tenant-safe
 * export/anonymize contributions at composition root (bootstrap). Operacional
 * lgpd-service only imports this registry, never the foreign schemas directly.
 */

export type LGPDExportResult = Record<string, unknown[]>;

export type LGPDExportContribution = (
  clinicId: string,
  patientId: string,
  tx: any,
) => Promise<LGPDExportResult>;

export type LGPDAnonymizeContribution = (
  clinicId: string,
  patientId: string,
  tx: any,
) => Promise<void>;

type Contribution = {
  moduleId: string;
  exportData: LGPDExportContribution;
  anonymizeData: LGPDAnonymizeContribution;
};

const registry = new Map<string, Contribution>();

export function registerLGPDContribution(contribution: Contribution): void {
  if (registry.has(contribution.moduleId)) {
    throw new Error(`duplicate LGPD contribution: ${contribution.moduleId}`);
  }
  registry.set(contribution.moduleId, contribution);
}

export function replaceLGPDContributions(entries: Contribution[]): void {
  const next = new Map<string, Contribution>();
  for (const entry of entries) {
    if (!entry.moduleId || typeof entry.exportData !== 'function' || typeof entry.anonymizeData !== 'function') {
      throw new Error(`invalid LGPD contribution: ${entry.moduleId}`);
    }
    if (next.has(entry.moduleId)) {
      throw new Error(`duplicate LGPD contribution: ${entry.moduleId}`);
    }
    next.set(entry.moduleId, entry);
  }
  registry.clear();
  for (const [k, v] of next) registry.set(k, v);
}

export function clearLGPDContributionsForTests(): void {
  registry.clear();
}

export function getLGPDContributions(): Contribution[] {
  return [...registry.values()];
}

export function getLGPDContribution(moduleId: string): Contribution | undefined {
  return registry.get(moduleId);
}
