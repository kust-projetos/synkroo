/**
 * owner-merge-registry.ts — Leaf registry for owner-merge dispatchers.
 *
 * Intentionally imports nothing from other modules (pure leaf) so it can be
 * loaded safely during the CRM ↔ operacional/comercial module-init cycle:
 * mesclar-pacientes / mesclar-leads import registerOwnerMerge from CRM, and
 * CRM now re-exports it from this leaf, avoiding the previous TDZ on
 * ownerMergeRegistry.
 */

export type OwnerMergeDispatcher = (
  winnerId: string,
  loserId: string,
  clinicId: string,
) => Promise<boolean>;

const ownerMergeRegistry = new Map<string, OwnerMergeDispatcher>();

export function registerOwnerMerge(
  ownerType: 'patient' | 'lead',
  dispatcher: OwnerMergeDispatcher,
): void {
  ownerMergeRegistry.set(ownerType, dispatcher);
}

export function getOwnerMergeDispatcher(
  ownerType: 'patient' | 'lead',
): OwnerMergeDispatcher | undefined {
  return ownerMergeRegistry.get(ownerType);
}
