# Eixo 2 — Sequenciamento do Catálogo de Módulos

> **Tipo:** Documento de planejamento (alto nível). Resolve a decisão aberta §215 do roadmap-mestre ("Priorização do Eixo 2 — ordem de detalhamento — a definir antes de iniciar os módulos").
> **Data:** 2026-06-21
> **Status:** Aprovado. Define a ordem; cada módulo recebe depois seu próprio ciclo `spec → plano → implementação`.
> **Escopo:** apenas planejamento/documentação. Não é spec de implementação de nenhum módulo.

---

## 0. Como ler este documento

Este doc **ordena** o trabalho do Eixo 2. Não detalha módulos — cada módulo terá sua própria spec, derivada do roadmap-mestre e dos docs-fonte (§1 do roadmap), seguindo o template (§6) e a Action Layer (§5).

A ordem separa o que é **forçado por dependência** (não-negociável) do que é **escolha de valor** (revisável). Comprometimento firme só com **Core + Onda 1**; o resto é backlog provisório, deliberadamente não-travado.

**Fonte de verdade superior:** `docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md` (roadmap-mestre). Este doc é subordinado a ele.

---

## 1. Estado de entrada (Eixo 1 fechado)

Verificado em 2026-06-21 (evidência em `docs/superpowers/plans/2026-06-19-revisao-fechamento-eixo1.md` + checagem de código):

- `npm run typecheck` → **0 erros**; suíte unit verde; integração da Action Layer verde (5/5).
- **Blocker de fundação resolvido:** signup semeia RBAC + concede acesso Owner na mesma transação (`src/repositories/auth/index.ts:166-175`); guarda **anti-lockout** em `assign-user-access.ts`; órfão `clinic-provisioning.ts` removido.
- **W4 runtime Cloudflare:** Gate B Workerd GO (`postgres.js`, `database.status: ok`).
- **W5 agente:** só a remoção dos ~8k LOC legados foi feita; o build do orquestrador 4+1 é **workstream do Eixo 2** (fechamento, Decisão A).

Pendências médias deferidas legítimas do Eixo 1 — **absorvidas pela Onda 0 (Core)** abaixo: menu com RBAC real, seletores de usuário/perfil (W3.5), gates plugados (`withModuleRoute`/`assertModuleForJob`), integração do manifesto ponta-a-ponta, resolução de `contatos`, lint de fronteira `warn`→`error`.

---

## 2. Backbone — forçado por dependências (não-negociável)

A ordem abaixo é imposta por dependências técnicas/de domínio; não é preferência.

1. **Core antes de todo módulo.** Manifesto de módulos, RBAC granular, Action Layer e o template `src/modules/<modulo>/` são pré-requisito de qualquer outro módulo.
2. **Agente IA depois de Core + runtime validado.** Já satisfeito (runtime GO). É um **piso** (não pode antes), não um teto ("por último"). O agente também depende das **Actions dos módulos** que vai operar — quanto mais módulos no template, mais tools de graça.
3. **CRM (E-04) depois de Operacional (E-02, pacientes) + Comercial (E-05, leads).** Por §9.1 do roadmap, o CRM é camada ampla que referencia ambos os bounded contexts; eles precisam existir primeiro.

Tudo o que não está nestes três pontos é **escolha de valor** (revisável), organizada em ondas abaixo.

---

## 3. Onda 0 — Core *(compromisso firme)*

Fundação modular completa. Estabelece o **exemplo canônico** de `app → action → service → repository → Drizzle` e fecha as pendências deferidas do Eixo 1.

Escopo (a detalhar no spec do Core):

- **Template canônico §6** materializado e documentado como referência para os demais módulos.
- **Menu + rotas dirigidos por manifesto + RBAC real** — substituir `can = () => true` (`sidebar.tsx`) pela resolução real (`buildUserContext` + `buildMenu`/`filterMenuByAccess`). Requer plumbing de contexto server→client (o dashboard é 100% `'use client'`).
- **Painel admin sem jargão (W3.5)** — trocar entrada de UUID cru por seletores reais de usuário/perfil (`UserAccessForm.tsx`).
- **Gates plugados** — `withModuleRoute` em `/api/*` de módulos contratáveis; `assertModuleForJob` nos crons.
- **`contatos`** resolvido (redirect ou remoção do menu).
- **Lint de fronteira** `warn` → `error` no CI, para bloquear regressão de dependência entre módulos.
- **Anti-lockout** repetido ao criar `removeUserAccess`/desativação de usuário (nota do fechamento).

> O Core é o único módulo cuja base já está parcialmente implementada (Action Layer + RBAC + manifesto existem em `src/core/*` e `src/modules/core/*`). A Onda 0 é, em grande parte, **integração e acabamento** do que foi construído no Eixo 1, não greenfield.

---

## 4. Onda 1 — Slice WhatsApp→agenda ponta-a-ponta *(compromisso firme)*

A fatia de maior valor de negócio (WhatsApp-first, P2) e que **valida a fundação inteira** em produção: runtime Workers + Action Layer + primeiro agente real.

| Ordem | Módulo | Estado | Razão da posição |
|---|---|---|---|
| 1 | **E-02 Operacional** (agendamento) | maduro → refatorar | Produz as Actions centrais (agendar / remarcar / confirmar) que E-01 e o agente consomem |
| 2 | **E-01 Atendimento + Canais** | maduro → refatorar | Trilho conversacional WhatsApp-first — *intercambiável com E-02* (Canais já é maduro; nada em E-02 depende de E-01) |
| 3 | **E-03 Follow-up** | maduro → refatorar | Retenção / lembretes sobre a base agendada |
| 4 | **Agente IA 4+1** | greenfield (W5 Tasks 2–5) | Orquestra E-01/E-02/E-03 via Action Layer — entra por último na onda para nascer com o **toolset máximo** já migrado |

**Decisão registrada — posição do Agente:** fica **após** os três módulos maduros, não adiantado. Os três são refator mecânico/baixo risco; cada um migrado vira tool grátis para o agente. Adiantá-lo só se justificaria com **deadline de demo específico** — que não existe nesta data. Consistente com a Decisão A do fechamento (agente após Core+runtime é piso, não "último do roadmap inteiro").

**Decisão registrada — E-02 antes de E-01:** E-02 produz as Actions que os outros consomem; nada que E-02 precisa vem de E-01. Ordem intercambiável, sem mais ciclos de discussão.

**Critério de "Onda 1 concluída":** um paciente manda WhatsApp → agente entende → agenda/remarca/confirma → registra → dispara follow-up, tudo rodando no runtime Cloudflare via Action Layer, com RBAC/entitlement aplicados.

---

## 5. Onda 2+ — Backlog provisório *(revisitar após a Onda 1 rodar)*

Ordem **deliberadamente não-travada**. Prioridades vão mudar depois do primeiro cliente real, e cada módulo re-especifica de qualquer forma. Não manufaturar precisão que será descartada.

Ordem sugerida inicial (a confirmar quando chegar a vez):

1. **E-05 Comercial** (Leads/Pipeline) — maduro → refatorar.
2. **E-04 CRM/Contatos** — redesenhar (§9.1: modelo de domínio Leads ↔ Pacientes ↔ Contatos; proposta + mockup no spec). Depende de E-02 + E-05.
3. **Financeiro & Cobrança** (transversal) — expandir (orçamentos, parcelas, pagamentos, PIX, inadimplência).
4. **E-08 Dashboard/BI + Inteligência Preditiva** (transversal) — refatorar/expandir; consome dados dos módulos anteriores.
5. **Greenfields / diferenciais avançados:**
   - **E-06 Marketing e Redes Sociais** — greenfield.
   - **E-07 Call Center com IA (voz)** — greenfield; depende do agente maduro.
   - **Escritório / Documentos** — greenfield.
   - **Operações Especiais Odonto** (odontograma, proposta visual) — expandir.
   - **Integrações de terceiros (camada P3)** — transversal, conforme demanda de cliente.
   - **Gestão do Agente de IA** (config, auditoria de decisões, ações pendentes) — expandir, após o agente no ar.

---

## 6. Regras transversais (todo módulo)

- Ciclo obrigatório: **`spec → plano → implementação`** (implementação por outro agente). Documentos derivados são **auto-suficientes para o agente implementador** e referenciam o roadmap-mestre + os docs-fonte (não duplicam).
- Todo módulo segue o **template §6** e expõe operações **só** via **Action Layer §5** (sem tools paralelas para o agente).
- **`.planning/research/PITFALLS.md`** consultado ao escrever cada plano de implementação.
- Habilitar um módulo (manifesto) expõe suas Actions ao agente automaticamente; cada Action carrega `module` (entitlement) + `requires` (RBAC).
- Operacional e Comercial funcionam **sem** o módulo CRM (princípio §9.1).

---

## 7. Próximo passo

Iniciar o ciclo do **Core (Onda 0)**: `spec → plano`. Este doc de sequenciamento é o contexto de ordem; o spec do Core puxará o detalhe das pendências deferidas (§3) e do template (§6 do roadmap).

---

## 8. Referências

| Documento | Papel |
|---|---|
| `docs/superpowers/specs/2026-06-17-produto-base-modular-cloudflare-roadmap-design.md` | Roadmap-mestre (fonte de verdade superior) |
| `docs/superpowers/plans/2026-06-19-revisao-fechamento-eixo1.md` | Estado de fechamento do Eixo 1 + pendências deferidas |
| `docs/superpowers/plans/2026-06-19-fechamento-fundacao-rbac.md` | Plano que fechou o blocker de RBAC |
| `docs/planning/epics.md` | Vocabulário canônico E-01..E-08 |
| `docs/planning/product-brief.md` · `improvements-proposal.md` · `technical-research.md` | Detalhe de produto/domínio puxado pelos specs de módulo |
