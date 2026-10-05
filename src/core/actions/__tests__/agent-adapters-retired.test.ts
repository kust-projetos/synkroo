import { existsSync } from 'node:fs';
import { join } from 'node:path';
import * as actionsBarrel from '../index';

/**
 * Guarda de regressão do allowlist hardening (2026-10-05).
 *
 * `toAgentTool`/`agentToolsFor` adaptavam uma Action para um tool com `run()`
 * chamando `runAction` direto — sem handle verificado, sem matriz de confirmação/
 * identidade e sem anti-replay. A execução da IA tem um único caminho owned pelo
 * agent-bridge (`executeActionLogic` → allowlist → matriz → runAction).
 *
 * Estes testes existem para falhar se alguém reintroduzir o adaptador neste layer.
 */
describe('adaptadores executáveis de tool do agente — removidos', () => {
  it('o módulo src/core/actions/agent.ts não existe mais', () => {
    expect(existsSync(join(__dirname, '..', 'agent.ts'))).toBe(false);
  });

  it('o barrel de actions não exporta adaptadores de tool', () => {
    const exported = Object.keys(actionsBarrel);
    expect(exported).not.toContain('toAgentTool');
    expect(exported).not.toContain('agentToolsFor');
    expect(exported).not.toContain('AgentTool');
  });

  it('nenhuma tool exposta carrega capacidade de execução', () => {
    // O barrel só expõe metadata/registry do core; nada que ligue uma Action a
    // um callback executável para consumo pela IA. A allowlist da IA e a
    // execução ficam no agent-bridge (tool-policy / bridge-service) — o core
    // não importa a policy da bridge em nenhum ponto.
    for (const name of Object.keys(actionsBarrel)) {
      expect(['runAction', 'run', 'execute', 'handler']).not.toContain(name);
    }
  });
});
