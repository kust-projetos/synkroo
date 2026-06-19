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
  for (const a of actions) {
    if (registry.has(a.name)) throw new Error(`duplicate action name: ${a.name}`);
    registry.set(a.name, a);
  }
}

export function getActions(): ActionDefinition<any, any>[] {
  return [...registry.values()];
}

export function getAction(name: string): ActionDefinition<any, any> | undefined {
  return registry.get(name);
}

// Apenas para testes.
export function clearRegistry(): void {
  registry.clear();
}
