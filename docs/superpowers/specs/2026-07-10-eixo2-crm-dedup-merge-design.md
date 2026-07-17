# Eixo 2 — CRM/Contatos (E-04) — Slice C: Dedup/Merge Assistido — Design

> **Tipo:** Spec de slice complementar do E-04.
> **Data:** 2026-07-10
> **Status:** Escrito após review do desenho; pendente revisão do usuário antes de qualquer plano.
> **Base:** `docs/superpowers/specs/2026-07-05-eixo2-crm-modulo-design.md`
> **Escopo:** detectar duplicados intra-owner, revisar sugestões e executar merge manual confirmado.
> **Dependências:** E-04 MVP A como base; E-02 Operacional e E-05 Comercial como owners de `patients` e `leads`.

---

## 0. Contexto

O MVP A do CRM fechou lista/detalhe/timeline/notas/tags como lente unificada sem ownership de contatos. Este slice C adiciona **deduplicação e merge assistido** sem transformar CRM em owner de `patients` ou `leads`.

Decisão central: o CRM passa a own **somente** a persistência de sugestões/review de duplicidade. O merge real continua sendo executado pelos módulos owners.

---

## 1. Escopo e não-escopo

| Área | Decisão | Motivo |
|---|---|---|
| `lead↔lead` | Escopo | Comercial owns lead lifecycle |
| `patient↔patient` | Escopo | Operacional owns patient lifecycle |
| `lead↔patient` | Fora | cross-owner aumenta risco e muda modelo |
| Detecção de duplicados | Escopo | fila de revisão precisa candidatos persistidos |
| Merge manual confirmado | Escopo | entrega valor sem auto-corrupção |
| Auto-merge | Fora | risco alto |
| Undo/reversão | Fora | MVP; auditoria + soft-merge bastam |
| Merge de lead convertido | Fora | evita ambiguidade com conversão para patient |
| Merge cross-clinic | Fora | LGPD/multitenancy |
| Nova tabela `contacts` | Fora | E-04 segue sem entidade unificada materializada |

---

## 2. Requisitos EARS

| ID | EARS |
|---|---|
| REQ-CRM-MRG-01 | When a patient or lead is created or updated, the CRM duplicate detection flow shall recalculate candidate duplicates for the same clinic and same owner type. |
| REQ-CRM-MRG-02 | When duplicate score is below 70, the CRM module shall not persist a review suggestion. |
| REQ-CRM-MRG-03 | When duplicate score is between 70 and 84, the CRM module shall persist a medium-confidence suggestion for manual review. |
| REQ-CRM-MRG-04 | When duplicate score is 85 or higher, the CRM module shall persist a high-confidence suggestion for manual review and shall never auto-merge it. |
| REQ-CRM-MRG-05 | When a user opens the duplicate queue or duplicate detail tab, the CRM module shall show score, signals, winner suggestion, and snapshots for both records. |
| REQ-CRM-MRG-06 | When a user approves a suggestion, the CRM module shall transition it using compare-and-set from `pending` to `approved`, or from `failed` to `approved` only as an explicit manual retry, and only if the latest lightweight refresh still supports review. |
| REQ-CRM-MRG-07 | When a user executes merge for an approved suggestion, the CRM module shall perform one final lightweight refresh, shall transition it from `approved` to `executing` exactly once only if still eligible, and then shall call the owner merge action. |
| REQ-CRM-MRG-08 | If owner merge succeeds, then the CRM module shall mark the suggestion `merged` and shall dismiss sibling suggestions involving the winner or loser with reason `stale_after_merge`. |
| REQ-CRM-MRG-09 | If owner merge fails, then the CRM module shall mark the suggestion `failed`, preserve audit evidence, and shall allow retry only from `failed`. |
| REQ-CRM-MRG-10 | If compared records have divergent non-empty document identifiers, then the CRM module shall block merge execution and require dismissal or future manual flow. |
| REQ-CRM-MRG-11 | While a loser record is soft-merged, owner default lists shall hide it and owner detail flows may resolve it only through explicit compatibility handling. |
| REQ-CRM-MRG-12 | Where duplicate review is enabled, the CRM module shall expose both a global duplicate queue and a duplicate tab inside contact detail. |

---

## 3. Ownership e arquitetura

```
CRM slice C
├── owns: duplicate suggestions + review state
├── reads: candidate signals via read-model/repositories
├── coordinates: approval/execution/audit
└── calls owner actions:
    ├── operacional.mesclarPacientes
    └── comercial.mesclarLeads
```

Boundary rules:
1. CRM **não** escreve em tabelas owner de `patients` ou `leads`.
2. CRM pode own uma tabela de sugestões de duplicidade e usar `action_logs` para auditoria MVP.
3. Merge real roda **somente** em owner actions.
4. Sugerir duplicado e executar merge são fluxos distintos; score nunca executa merge sozinho.
5. Tudo é escopado por `clinicId` e `ownerType`.

---

## 4. Persistência CRM

Tabela principal proposta: `crm_duplicate_suggestions`

```ts
type DuplicateOwnerType = 'patient' | 'lead';
type DuplicateStatus = 'pending' | 'approved' | 'executing' | 'merged' | 'failed' | 'dismissed';
type DuplicateConfidence = 'medium' | 'high';
```

Campos:

| Campo | Tipo | Regra |
|---|---|---|
| `id` | uuid | PK |
| `clinic_id` | uuid | escopo obrigatório |
| `owner_type` | enum | `patient` ou `lead` |
| `left_id` | uuid | registro A |
| `right_id` | uuid | registro B |
| `status` | enum | lifecycle da revisão |
| `confidence` | enum | `medium`/`high` |
| `duplicate_score` | int | 0–100 |
| `winner_suggested_id` | uuid nullable | heurística default |
| `winner_confirmed_id` | uuid nullable | escolhido no merge |
| `signals` | jsonb | telefone/email/nome/doc + pesos + match reason |
| `left_snapshot` | jsonb | resumo persistido na detecção |
| `right_snapshot` | jsonb | resumo persistido na detecção |
| `dismiss_reason` | text nullable | ex. `false_positive`, `stale_after_merge` |
| `merge_operation_key` | text nullable unique | 1 por tentativa atual de execução; cada transição `approved -> executing` gera nova key e keys antigas ficam só em `action_logs` |
| `failure_reason` | text nullable | erro último de execução |
| `detected_at` | timestamptz | primeira detecção |
| `refreshed_at` | timestamptz | última atualização leve |
| `reviewed_by` | uuid nullable | último reviewer |
| `reviewed_at` | timestamptz nullable | última revisão |
| `executed_by` | uuid nullable | executor |
| `executed_at` | timestamptz nullable | execução final |
| `created_at` | timestamptz | default now |
| `updated_at` | timestamptz | default now |

Restrições:
- unique canônico por par ordenado: `(clinic_id, owner_type, least(left_id,right_id), greatest(left_id,right_id))`
- `left_id != right_id`
- `status='executing'|'merged'` exige `winner_confirmed_id`

Snapshot resumido mínimo:
- `id`, `name`, `phone`, `email`, `document`, `status`, `tags`
- `createdAt`, `updatedAt`
- contadores do owner relevantes (`appointmentsCount`, `activitiesCount`, `tasksCount`)
- flags de completude/conversão

Auditoria MVP:
- eventos importantes em `action_logs`
- razões operacionais transitórias como `refresh_required` ficam só em `action_logs` neste MVP; não haverá coluna dedicada de `status_reason`
- não criar tabela extra de eventos neste slice

---

## 5. Permissões e actions

Permissões novas:
- `crm:review_duplicates`
- `crm:merge_patients`
- `crm:merge_leads`

Actions CRM:

| Action | Permissão | Tipo | Observação |
|---|---|---|---|
| `crm.listarSugestoesDuplicidade` | `crm:review_duplicates` | read | fila global |
| `crm.obterSugestaoDuplicidade` | `crm:review_duplicates` | read | detalhe + refresh leve |
| `crm.dispensarSugestaoDuplicidade` | `crm:review_duplicates` | write | `pending/approved/failed -> dismissed` |
| `crm.aprovarSugestaoDuplicidade` | `crm:review_duplicates` | write | `pending -> approved` ou `failed -> approved` em retry manual, sempre após refresh leve |
| `crm.executarMergeLead` | `crm:merge_leads` | write coordinator | faz refresh leve final, valida elegibilidade e chama internal-only `comercial.mesclarLeads` |
| `crm.executarMergePatient` | `crm:merge_patients` | write coordinator | faz refresh leve final, valida elegibilidade e chama internal-only `operacional.mesclarPacientes` |
| `crm.reprocessarSugestoesDuplicidade` | system/job | write | job periódico |

Owner actions novas:

| Owner | Action | Papel |
|---|---|---|
| Operacional | `operacional.mesclarPacientes` | merge real de patient; internal-only/coordinator-only |
| Comercial | `comercial.mesclarLeads` | merge real de lead; internal-only/coordinator-only |

Modelo de autorização:
- autorização do usuário acontece somente na action CRM coordenadora;
- `crm.executarMergePatient` exige `crm:merge_patients`;
- `crm.executarMergeLead` exige `crm:merge_leads`;
- owner actions de merge não ficam expostas por rota/UI/agent tools neste slice.

---

## 6. Detecção e scoring

Sinais do score composto:
- telefone normalizado
- email normalizado
- nome parecido
- documento

Thresholds MVP:
- `>= 85` → `high`
- `70–84` → `medium`
- `< 70` → não persiste sugestão

Heurística de vencedor sugerido:
- score ponderado por:
  - completude do cadastro
  - quantidade/qualidade de vínculos owner
  - atividade recente
  - status/conversão relevante ao owner

Regra de detecção:
1. recalcular no create/update do owner
2. reprocessar periodicamente por job CRM
3. nunca comparar registros de clínicas diferentes
4. nunca comparar `patient` com `lead`
5. `lead` convertido fica fora deste slice

---

## 7. Freshness e review

Problema: snapshot envelhece.

Regra MVP:
1. `crm.obterSugestaoDuplicidade` faz **refresh leve** antes de responder:
   - recarrega sinais mínimos
   - recalcula score rápido
   - atualiza snapshots resumidos
2. Se o score cair abaixo de 70, a sugestão volta para `dismissed` com razão `score_below_threshold_after_refresh`.
3. Se houver drift material sem invalidar a sugestão, atualizar `refreshed_at` e manter `pending`.
4. `crm.aprovarSugestaoDuplicidade` só aprova se a sugestão ainda estiver válida depois do refresh leve.
5. `crm.executarMergeLead` e `crm.executarMergePatient` fazem **refresh leve final** antes de tentar `approved -> executing`.
6. Se o score cair abaixo de 70 nesse refresh final, a sugestão vira `dismissed` com razão `score_below_threshold_before_execution`.
7. Se houver drift material nesse refresh final, mas o score ainda estiver elegível, a sugestão volta para `pending` com razão operacional `refresh_required`, auditada em `action_logs`, e exige nova revisão.

---

## 8. Concorrência, idempotência e lifecycle

State machine:

| De | Para | Regra |
|---|---|---|
| `pending` | `approved` | compare-and-set |
| `failed` | `approved` | retry manual explícito |
| `pending` | `dismissed` | review manual |
| `approved` | `executing` | compare-and-set + `merge_operation_key` único + refresh leve final válido |
| `approved` | `pending` | drift material no refresh final; exige nova revisão |
| `approved` | `dismissed` | score `<70` no refresh final |
| `executing` | `merged` | owner success |
| `executing` | `failed` | owner failure |
| `approved/failed/pending` | `dismissed` | permitido |

Idempotência:
- execução só `approved -> executing`
- gerar `merge_operation_key` único por sugestão/execução
- mesma sugestão não pode executar 2x com sucesso
- retry só é permitido se status atual for `failed`

Sugestões irmãs:
- após merge bem-sucedido, toda sugestão do mesmo `clinicId`/`ownerType` envolvendo `winner` ou `loser` vira `dismissed`
- `dismiss_reason = 'stale_after_merge'`
- isso evita review/merge em cima de registro já consolidado
- o job de reprocesso pode reabrir ou recriar sugestão stale somente se ela ainda envolver um `winner` ativo e outro registro ativo elegível
- sugestões que envolvam o `loser` soft-merged não reabrem

Timeout operacional:
- se execução falhar por erro técnico, sugestão vira `failed`
- sem watchdog extra neste MVP; recovery manual via retry

---

## 9. Contrato de soft-merge no owner

Os owners devem expor/registrar estes campos equivalentes no loser:
- `merge_status = 'merged'`
- `merged_into_id`
- `merged_at`

Regras:
1. loser não é deletado fisicamente
2. listas padrão do owner ocultam loser por default
3. lookups de compatibilidade podem redirecionar loser para winner quando explicitamente necessário
4. loser permanece auditável

Se o owner ainda não tiver esses campos, a implementação do slice deve introduzir o equivalente mínimo necessário no contexto do owner.

---

## 10. Política de conflito de campos

Regras MVP:
1. winner mantém campos primários existentes
2. loser só preenche lacunas vazias do winner
3. tags = união com trim + dedup case-insensitive
4. notas/atividades/observações sempre agregam
5. conflito forte de documento (dois docs não vazios e diferentes) **bloqueia merge**
6. conflito de telefone/email **não** bloqueia por si só; ficam preservados no snapshot/auditoria, e winner mantém primário

---

## 11. Escopo exato do merge por owner

### 11.1 Patients (`operacional.mesclarPacientes`)

Incluir:
- observações de paciente
- tags
- preferências compatíveis
- appointments e referências operacionais apontando para o loser
- `patientObservations`, `appointments`, `patientPreferences`, `patientRiskScores`, `patientFeedback` quando existirem no owner schema
- contadores/flags derivados necessários para manter integridade operacional

Regras:
- winner preserva dados primários
- loser preenche lacunas vazias
- appointments do loser passam a apontar para winner
- preferências conflitantes usam winner como fonte primária
- regra geral: todo FK owner-side em Operacional que aponta para `patients.id` deve passar a apontar para o winner, salvo exclusões explícitas neste spec
- documento divergente bloqueia merge antes da execução

Não incluir neste slice:
- fusão semântica avançada de feedback/risk score além de manter vínculo útil ao winner
- reconciliar manualmente histórico clínico contraditório via UX especial

### 11.2 Leads (`comercial.mesclarLeads`)

Incluir:
- lead activities
- tasks abertas e fechadas
- tags
- pipeline/stage/status conforme política abaixo

Regras:
- leads convertidos ficam fora do slice
- winner preserva stage/status primários
- activities/tasks do loser migram para winner
- loser vira soft-merged com `merge_status = 'merged'`, `merged_into_id`, `merged_at`, `status = 'lost'`, `lost_reason = 'merged_duplicate'`, `phoneNormalized = null`
- documento divergente bloqueia merge antes da execução

Policy stage/status:
- winner mantém stage/status atuais
- loser não sobrescreve stage/status do winner
- se loser tiver metadados úteis ausentes no winner, preencher lacunas não críticas

---

## 12. UX

### 12.1 Fila global

Tela/área canônica no CRM:
- lista sugestões por score/status/data
- filtros: owner type, status, confidence, score mínimo, período
- colunas mínimas: owner type, registros comparados, score, confidence, detectedAt, status, winner sugerido
- ações: ver, aprovar, dispensar, executar merge

### 12.2 Aba “Duplicados” no detalhe

No detalhe do contato:
- listar sugestões ligadas ao registro atual
- mostrar comparação A/B
- mostrar sinais usados e snapshots resumidos
- permitir trocar vencedor antes de executar merge

### 12.3 UX rules
- nunca oferecer auto-merge
- se doc divergir, CTA de merge fica bloqueado com razão explícita
- sugestões `dismissed` podem ser exibidas via filtro, não por default

---

## 13. Segurança e auditoria

| Caso | Regra |
|---|---|
| outra clínica | `404`/`not_found` |
| sem permissão de review | `403` |
| sem permissão CRM de merge (`crm:merge_patients` / `crm:merge_leads`) | `403` |
| tentativa de chamar owner merge action fora do coordinator | `403`/internal-only |
| tentativa de merge em status inválido | `409` |
| documento divergente | `409` com erro explícito |
| lead convertido | `409`/`invalid_state` |
| pair já obsoleto | `409` ou dismiss refresh |

Regras adicionais:
- mascarar telefone/email em logs quando possível
- não expor dados cross-clinic em score/snapshot
- `action_logs` registram approval, dismissal, execution, failure e stale invalidation

---

## 14. Testes

**Tests:**
- Unit (Jest, RED first): scoring, thresholds, winner suggestion, conflict policy, state transitions, sibling invalidation.
- Integration (Jest + DB local): CAS `approved->executing`, idempotência por `merge_operation_key`, stale-after-merge, soft-merge owner fields, pointer updates owner-side.
- Contract (auto): `crm.executarMergePatient` ↔ `operacional.mesclarPacientes`; `crm.executarMergeLead` ↔ `comercial.mesclarLeads`.
- Snapshot (auto if UI touched): fila global e aba Duplicados em empty/loading/error/blocked-doc-conflict.
- Mutation (Stryker, ≥70%): scoring/lifecycle/conflict policy.
- Coverage ratchet: ≥80% new code.

Matriz mínima:

| Cenário | Esperado |
|---|---|
| score 69 | não persiste |
| score 72 | persiste `medium` |
| score 90 | persiste `high` |
| open suggestion refresh drops below 70 | dismiss por threshold refresh |
| approve stale record | não aprova |
| merge same suggestion twice | 1 execução só |
| merge success | `merged` + siblings `dismissed:stale_after_merge` |
| owner failure | `failed` |
| retry from `failed` | permitido |
| retry from `merged` | bloqueado |
| drift material antes da execução | volta para `pending` |
| score `<70` antes da execução | `dismissed` |
| divergent document | merge bloqueado |
| converted lead | fora/merge bloqueado |
| patient loser hidden from default list | sim |
| lead loser hidden from default list | sim |
| lead loser final | `lost` + `merged_duplicate` + `phoneNormalized = null` |

---

## 15. Definition of Done

- [ ] Spec do slice C aprovado.
- [ ] CRM owns one duplicate-suggestion table and uses `action_logs` for audit.
- [ ] New permissions exist: `crm:review_duplicates`, `crm:merge_patients`, `crm:merge_leads`.
- [ ] CRM exposes queue/detail/review/execute/reprocess actions for duplicate suggestions.
- [ ] Operacional exposes `operacional.mesclarPacientes`.
- [ ] Comercial exposes `comercial.mesclarLeads`.
- [ ] Execution is idempotent and guarded by CAS + `merge_operation_key`.
- [ ] Sibling suggestions are invalidated after successful merge.
- [ ] Soft-merge contract is explicit and default lists hide losers.
- [ ] Divergent non-empty document blocks merge.
- [ ] Converted lead remains outside this slice.
- [ ] Queue + detail-tab UX are covered in the design.
- [ ] Focused tests are defined.

---

## 16. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| merge duplo por clique/retry | CAS + `merge_operation_key` |
| sugestão envelhecida | refresh leve ao abrir/aprovar |
| múltiplas sugestões sobre mesmo registro | dismiss `stale_after_merge` |
| corrupção por cross-owner | slice intra-owner only |
| conflito de identidade forte | bloquear por documento divergente |
| perda de rastreabilidade | soft-merge + `action_logs` |

---

## 17. Referências

| Documento/arquivo | Papel |
|---|---|
| `docs/superpowers/specs/2026-07-05-eixo2-crm-modulo-design.md` | base do E-04 MVP A |
| `docs/superpowers/specs/2026-07-04-eixo2-comercial-modulo-design.md` | ownership e lifecycle de leads |
| `docs/superpowers/specs/2026-06-22-eixo2-operacional-modulo-design.md` | ownership e lifecycle de patients/appointments |

---

## 18. Non-goals explícitos

- Implementar merge `lead↔patient`.
- Implementar undo/reversão.
- Implementar auto-merge.
- Criar entidade materializada `contacts`.
- Reabrir o modelo de conversão de lead para patient.
- Resolver limpeza histórica avançada fora do owner context.
