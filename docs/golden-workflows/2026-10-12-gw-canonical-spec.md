# Golden Workflows — Spec Canônica (GW-01..GW-10)

- **Versão:** 1.0.0-DRAFT
- **Data:** 2026-10-12
- **HEAD:** `d05de6f`
- **Status:** DRAFT
- **Issue:** #27
- **Branch:** `docs/golden-workflows-canonical`
- **Escopo:** definição canônica dos 10 golden workflows; sem implementação, sem E2E novo, sem dados reais.
- **Ambiente (todos os GW):** sintético e isolado — seed de teste em loopback (`scripts/seed-test-clinic.mjs` / `scripts/integration-run.mjs`), sem dados reais de pacientes, sem disparo externo (WhatsApp/Evolution desligado ou mockado), sem produção.

> Base: inventário auditado em 2026-10-12. Status por GW indica cobertura E2E atual + evidência (path). Critérios de aceite são verificáveis por teste E2E futuro ou inspeção determinística.

---

## GW-01 — Login → Dashboard

- **Objetivo:** usuário autentica e visualiza o dashboard operacional da clínica.
- **Pré-requisitos:** seed sintético com usuário + clínica; `/login` acessível; sessão JWT válida após login.
- **Passos:**
  1. Acessar `/login`.
  2. Submeter credenciais sintéticas válidas.
  3. Aguardar redirect para `/dashboard`.
  4. Carregar métricas do dashboard (cards, agenda do dia).
- **Critérios de aceite verificáveis:**
  1. Redirect para `/dashboard` em até 10s após submit válido.
  2. Nenhum erro de console bloqueante na carga do dashboard.
  3. Cards de métricas renderizam com valores do seed (não zeros por fallback silencioso).
  4. Credenciais inválidas exibem erro sem redirect.
- **Status atual:** COBERTO.
- **Evidência:** `e2e/auth/login.spec.ts`, `e2e/dashboard/overview.spec.ts`.

## GW-02 — Tenant switch (troca de clínica)

- **Objetivo:** usuário com acesso a múltiplas clínicas alterna o tenant ativo e todo o contexto (dados, permissões) acompanha.
- **Pré-requisitos:** usuário sintético membro de 2 clínicas (seed); sessão ativa.
- **Passos:**
  1. Com sessão ativa na clínica A, abrir seletor de clínica.
  2. Selecionar clínica B.
  3. Verificar dados do dashboard e permissões refletindo a clínica B.
- **Critérios de aceite verificáveis:**
  1. Após switch, `clinic_id` ativo = B (verificável via `/api/auth/session` ou equivalente).
  2. Dashboard recarrega dados escopados em B; nenhum dado de A vaza (cross-tenant negativo).
  3. Permissões re-resolvidas para B (rota negada em A e permitida em B comporta-se corretamente).
- **Status atual:** LACUNA (só cobertura unitária).
- **Evidência:** unit `use-clinic-switch` / `clinic-selector` (ex.: `src/components/clinic-selector.tsx`, `src/lib/auth/context.tsx`); sem spec E2E de switch.

## GW-03 — Lead → Paciente → Agendamento

- **Objetivo:** funil comercial completo: capturar lead, converter em paciente, criar agendamento.
- **Pré-requisitos:** clínica seedada; usuário com permissão comercial + operacional; slots de agenda disponíveis.
- **Passos:**
  1. Criar lead via `/api/leads` ou UI do pipeline.
  2. Qualificar/converter lead em paciente.
  3. Criar agendamento para o paciente convertido.
  4. Verificar agendamento na agenda do dia.
- **Critérios de aceite verificáveis:**
  1. Lead criado retorna id e aparece no pipeline.
  2. Conversão cria `patient_id` vinculado ao lead de origem (sem duplicata por dedup).
  3. Agendamento criado com status `scheduled` e visível no calendário/dia.
  4. Timeline do contato/paciente registra as 3 transições.
- **Status atual:** PARCIAL.
- **Evidência:** `e2e/journey-patient.spec.ts` (J-04 cobre o fluxo parcial); lacuna em asserts de dedup/estados intermediários.

## GW-04 — Reschedule → Waitlist (reagendamento com lista de espera)

- **Objetivo:** reagendar consulta liberando slot e ofertando-o à waitlist.
- **Pré-requisitos:** agendamento `scheduled` + entrada em waitlist compatível (mesmo procedimento/faixa).
- **Passos:**
  1. Reagendar consulta existente para nova data/hora (RescheduleDialog).
  2. Confirmar liberação do slot antigo.
  3. Verificar oferta/preenchimento via waitlist (`/api/waitlist/fill` ou UI).
- **Critérios de aceite verificáveis:**
  1. Agendamento reflete nova data/hora; log de status registra `rescheduled`.
  2. Invalidação de cache cobre coleção + detalhe + calendário + dashboard (helper `invalidateAppointmentChanged`).
  3. Slot liberado torna-se candidato a fill da waitlist; fill atribui ou registra tentativa.
  4. Sem duplo-booking do slot antigo ou novo.
- **Status atual:** PARCIAL (unit forte, E2E só smoke).
- **Evidência:** `src/components/calendar/RescheduleDialog.tsx`; specs E2E em `e2e/calendar/*`, `e2e/appointments/*`, `e2e/*waitlist*` (smoke).

## GW-05 — Conversa → Mensagem (atendimento)

- **Objetivo:** operador lista conversas, abre thread e troca mensagens com o paciente/lead.
- **Pré-requisitos:** conversa seedada com mensagens; usuário com acesso ao canal; Evolution mockado/desligado.
- **Passos:**
  1. Listar conversas (`/api/conversations` ou UI).
  2. Abrir thread e visualizar histórico.
  3. Enviar mensagem outbound.
  4. Simular inbound (webhook mock com `WEBHOOK_SECRET`) e verificar recebimento.
- **Critérios de aceite verificáveis:**
  1. Lista renderiza conversas do tenant; histórico ordenado por tempo.
  2. Send retorna id e persiste com `direction=outbound`.
  3. Inbound mock persiste com `direction=inbound` e aparece na thread sem refresh manual (ou após poll documentado).
  4. Tenant derivado via `channel_installations`; cross-tenant negado.
- **Status atual:** PARCIAL (list/render cobertos, sem send/receive E2E).
- **Evidência:** rotas `src/app/api/conversations/*`, `src/app/api/messages/*`; sem spec E2E de send/receive.

## GW-06 — Pipeline drag / conversão (kanban comercial)

- **Objetivo:** mover cards no funil (drag entre etapas) e converter oportunidade.
- **Pré-requisitos:** pipeline com etapas + leads seedados; hook `useKanban`.
- **Passos:**
  1. Abrir pipeline/kanban.
  2. Arrastar card de etapa A para B.
  3. Converter card em estágio final (ganho/paciente).
  4. Recarregar e confirmar persistência.
- **Critérios de aceite verificáveis:**
  1. Drop persiste `stage_id` novo via API (não só estado local).
  2. Após reload, card permanece na etapa destino.
  3. Conversão cria vínculo paciente/oportunidade sem perda de histórico.
  4. Movimento inválido (etapa fechada/inexistente) é rejeitado com feedback.
- **Status atual:** LACUNA.
- **Evidência:** `src/hooks/use-kanban.ts` e páginas de pipeline; sem spec E2E dedicada localizada.

## GW-07 — Campanha: segmento → disparo → métrica

- **Objetivo:** criar campanha, segmentar público, disparar e medir resultado.
- **Pré-requisitos:** base de contatos segmentável; provedor de disparo mockado; permissão de campanhas.
- **Passos:**
  1. Criar campanha com segmento (preview da audiência).
  2. Disparar para o segmento (job/outbox mockado).
  3. Coletar métricas (enviados/entregues/cliques — conforme contrato).
- **Critérios de aceite verificáveis:**
  1. Preview do segmento conta N contatos com critérios aplicados.
  2. Disparo enfileira/envia exatamente para o segmento (idempotente; sem duplicata em retry).
  3. Métricas da campanha refletem o disparo (endpoint `/api/campaigns/*`).
  4. Disparo real externo desligado em ambiente sintético (mock/oubox).
- **Status atual:** LACUNA.
- **Evidência:** `src/app/api/campaigns/*`; sem spec E2E de disparo/métrica.

## GW-08 — Cobrança / pagamento (financeiro)

- **Objetivo:** gerar cobrança de orçamento/parcela e registrar pagamento até quitação.
- **Pré-requisitos:** orçamento/parcelas seedados em centavos (bigint); gateway mockado; permissão financeira.
- **Passos:**
  1. Gerar cobrança (`dispatch-charge-job` ou UI financeira).
  2. Registrar pagamento (parcial e total).
  3. Verificar status (pendente → parcial → pago) e extrato.
- **Critérios de aceite verificáveis:**
  1. Valores em centavos, sem drift de float (seam `modules/financeiro/index`).
  2. Cobrança idempotente por fingerprint (`migrations 0032-0033`: `result_ref` em retry).
  3. Pagamento parcial atualiza saldo devedor; quitação marca `pago` com recibo/extrato consistente.
  4. Webhook de gateway mockado valida assinatura quando aplicável; sem bypass.
- **Status atual:** LACUNA.
- **Evidência:** `src/app/api/financeiro/*`, `src/modules/financeiro/*`; sem spec E2E de cobrança→pagamento.

## GW-09 — Follow-up / reativação (inativos)

- **Objetivo:** listar pacientes inativos/tratamentos incompletos e executar ação de reativação.
- **Pré-requisitos:** pacientes inativos + tratamentos incompletos seedados; fila de follow-up.
- **Passos:**
  1. Abrir `/dashboard/followup`.
  2. Listar candidatos (inativos / `incomplete-treatments`).
  3. Disparar ação de reativação (mensagem/campanha/tarefa).
  4. Verificar registro da ação e saída do candidato da fila (quando aplicável).
- **Critérios de aceite verificáveis:**
  1. Página lista candidatos do tenant com critério documentado (janela de inatividade).
  2. Ação cria tarefa/mensagem/campanha vinculada ao paciente.
  3. Reativado (novo agendamento) remove ou marca o item da fila.
  4. Sem ação em massa sem confirmação; sem disparo externo real.
- **Status atual:** LACUNA TOTAL (página stub).
- **Evidência:** `src/app/dashboard/followup/page.tsx` (stub); APIs `src/app/api/appointments/incomplete-treatments`, jobs de followup em `src/app/api/cron/*` (sem E2E de reativação).

## GW-10 — Analytics → export (relatórios)

- **Objetivo:** visualizar métricas analíticas e exportar relatório.
- **Pré-requisitos:** dados seedados suficientes para agregação (agendamentos, no-show, receita).
- **Passos:**
  1. Abrir analytics/relatórios.
  2. Aplicar filtro (período/unidade).
  3. Exportar (CSV/PDF conforme contrato do endpoint).
- **Critérios de aceite verificáveis:**
  1. Métricas conferem com o seed (spot-check de 2+ indicadores).
  2. Filtro altera o resultado de forma determinística.
  3. Export retorna arquivo íntegro (cabeçalho + N linhas do filtro) com status 200.
  4. Export de tenant A nunca inclui dados de tenant B.
- **Status atual:** PARCIAL.
- **Evidência:** `src/app/api/analytics/*`, `src/app/api/reports/*`; cobertura E2E de export ausente/parcial.

---

## Matriz resumo

| GW | Fluxo | Status | Evidência principal |
|---|---|---|---|
| GW-01 | login→dashboard | COBERTO | `e2e/auth/login.spec.ts`, `e2e/dashboard/overview.spec.ts` |
| GW-02 | tenant-switch | LACUNA | unit `clinic-selector`/`use-clinic-switch`, sem E2E |
| GW-03 | lead→paciente→agendamento | PARCIAL | `e2e/journey-patient.spec.ts` (J-04) |
| GW-04 | reschedule→waitlist | PARCIAL | `src/components/calendar/RescheduleDialog.tsx` + smoke `e2e/calendar/*`, `e2e/appointments/*`, `e2e/*waitlist*` |
| GW-05 | conversa→mensagem | PARCIAL | `src/app/api/conversations/*`, `src/app/api/messages/*`, sem E2E send/receive |
| GW-06 | pipeline drag/convert | LACUNA | `src/hooks/use-kanban.ts`, sem E2E |
| GW-07 | campanha segment→disparo→métrica | LACUNA | `src/app/api/campaigns/*`, sem E2E |
| GW-08 | cobrança/pagamento | LACUNA | `src/app/api/financeiro/*`, `src/modules/financeiro/*`, sem E2E |
| GW-09 | followup/reativação | LACUNA TOTAL | `src/app/dashboard/followup/page.tsx` (stub) |
| GW-10 | analytics→export | PARCIAL | `src/app/api/analytics/*`, `src/app/api/reports/*` |

## Notas de guarda

1. Nenhum GW usa dados reais; todo passo roda contra seed sintético isolado.
2. Disparos externos (WhatsApp/Evolution, gateway, e-mail) permanecem mockados ou desligados na execução dos GW.
3. Cada GW futuro deve ganhar spec E2E própria nomeada `e2e/gw-XX-*.spec.ts` com os critérios acima como asserts.
4. Esta spec é DRAFT e não altera comportamento; implementação e testes E2E ficam para issues filhas.
