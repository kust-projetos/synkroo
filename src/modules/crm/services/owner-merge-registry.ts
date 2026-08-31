/**
 * owner-merge-registry.ts — Leaf registry for owner-merge dispatchers.
 *
 * Intentionally imports nothing from other modules. The composition root is
 * the only production writer; module imports must leave this registry empty.
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
  if (ownerMergeRegistry.has(ownerType)) throw new Error(`duplicate owner merge adapter: ${ownerType}`);
  ownerMergeRegistry.set(ownerType, dispatcher);
}

export function replaceOwnerMergeAdapters(entries: Array<{
  ownerType: 'patient' | 'lead';
  dispatcher: OwnerMergeDispatcher;
}>): void {
  const next = new Map<string, OwnerMergeDispatcher>();
  for (const entry of entries) {
    if (typeof entry.dispatcher !== 'function') {
      throw new Error(`invalid owner merge adapter: ${entry.ownerType}`);
    }
    if (next.has(entry.ownerType)) {
      throw new Error(`duplicate owner merge adapter: ${entry.ownerType}`);
    }
    next.set(entry.ownerType, entry.dispatcher);
  }
  ownerMergeRegistry.clear();
  for (const [ownerType, dispatcher] of next) {
    ownerMergeRegistry.set(ownerType, dispatcher);
  }
}

export function clearOwnerMergeRegistryForTests(): void {
  ownerMergeRegistry.clear();
}

export function getRegisteredOwnerMergeTypes(): Array<'patient' | 'lead'> {
  return [...ownerMergeRegistry.keys()] as Array<'patient' | 'lead'>;
}

export function getOwnerMergeDispatcher(
  ownerType: 'patient' | 'lead',
): OwnerMergeDispatcher | undefined {
  return ownerMergeRegistry.get(ownerType);
}
