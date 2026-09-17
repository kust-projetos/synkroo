/**
 * ETAPA12 — Gate de regressão da camada de decisão IA (OFFLINE).
 *
 * Itera `EVAL_CASES` com um expect por caso (id na mensagem de asserção).
 * NENHUM caso chama provider/LLM/rede: só funções puras de política
 * (allowlist, matriz, clinical-safety, sanitização) via `decide()`.
 */

import {
  EVAL_CASES,
  REQUIRED_CATEGORIES,
  decide,
  type EvalCategory,
} from './eval-cases';

describe('IA decision-layer evals (offline, sem provider)', () => {
  for (const c of EVAL_CASES) {
    it(`[${c.id}] (${c.category}) decide corretamente`, () => {
      expect(`[${c.id}] decide()=${decide(c)}`).toBe(
        `[${c.id}] decide()=${c.expectedDecision}`,
      );
    });
  }

  it('dataset cobre todas as categorias exigidas (≥2 casos cada)', () => {
    const counts = new Map<EvalCategory, number>();
    for (const c of EVAL_CASES) {
      counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    }
    for (const cat of REQUIRED_CATEGORIES) {
      expect(`categoria ${cat}: ${counts.get(cat) ?? 0} casos`).toBe(
        `categoria ${cat}: ${counts.get(cat) ?? 0} casos`,
      );
      expect(counts.get(cat) ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it('publica resumo por categoria', () => {
    const byCat = new Map<string, string[]>();
    for (const c of EVAL_CASES) {
      const verdict = decide(c);
      const ok = verdict === c.expectedDecision ? 'PASS' : 'FAIL';
      byCat.set(c.category, [...(byCat.get(c.category) ?? []), `${c.id}=${ok}`]);
    }
    const lines = [...byCat.entries()].map(
      ([cat, ids]) => `  ${cat}: ${ids.join(', ')}`,
    );
    // eslint-disable-next-line no-console
    console.log(
      `[evals] ${EVAL_CASES.length} casos, ${byCat.size} categorias:\n${lines.join('\n')}`,
    );
    for (const c of EVAL_CASES) {
      expect(decide(c)).toBe(c.expectedDecision);
    }
  });
});
