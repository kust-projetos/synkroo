import type { z } from 'zod';
import type { ActionDefinition } from './types';

const registry = new Map<string, ActionDefinition<any, any>>();

// Apenas constrói/tipa a Action. NÃO registra (sem side-effect — §2.3).
export function defineAction<I extends z.ZodTypeAny, O>(
  def: ActionDefinition<I, O>,
): ActionDefinition<I, O> {
  return def;
}

// Registro determinístico, chamado no bootstrap central.
export function registerActions(actions: ActionDefinition<any, any>[]): void {
  const pending = new Set<string>();
  for (const a of actions) {
    if (registry.has(a.name) || pending.has(a.name)) throw new Error(`duplicate action name: ${a.name}`);
    pending.add(a.name);
  }
  for (const a of actions) {
    registry.set(a.name, a);
  }
}

/** Replace the complete registry after the composition root has validated it. */
export function replaceRegistry(actions: ActionDefinition<any, any>[]): void {
  const next = new Map<string, ActionDefinition<any, any>>();
  for (const a of actions) {
    if (!a?.name) throw new Error('action registry: action sem nome');
    if (next.has(a.name)) throw new Error(`duplicate action name: ${a.name}`);
    next.set(a.name, a);
  }
  registry.clear();
  for (const [name, action] of next) registry.set(name, action);
}

export function getActions(): ActionDefinition<any, any>[] {
  return [...registry.values()];
}

export function getAction(name: string): ActionDefinition<any, any> | undefined {
  return registry.get(name);
}

// Apenas para testes — limpa registry e permite re-bootstrap.
export function clearRegistry(): void {
  registry.clear();
}
export function clearRegistryForTests(): void {
  registry.clear();
}
