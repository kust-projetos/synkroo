# F7.03 — Recipient Phone Resolver & Pre-Dispatch Validation

**Data:** 2026-08-24  
**Branch:** main  
**Status:** PARTIAL — Resolução assíncrona de telefone de destinatário, validação pré-dispatch, normalização E.164, checagem de DDD brasileiro e rejeição de números fictícios/inválidos implementados e verificados via testes; live provider queue dispatch permanece para Gate O3-X04  
**Wave:** W7 (O3-G09) — Follow-up & Messaging Job Consumers

---

## Resumo

- **Requisito F7.03:** Resolver recipient phone antes de dispatch em fluxos de mensagens, follow-ups e campanhas.
- **Implementações:**
  1. **Módulo Central de Resolução e Validação de Telefones (`src/modules/followup/services/phone-resolver.ts`):**
     - **Validação Síncrona (`validateAndFormatPhone`):**
       - Normalização para dígitos puros e formatos E.164 (`+55...`).
       - Validação de números de celular brasileiros (11 dígitos, DDD válido de 11 a 99, primeiro dígito do número `9`).
       - Validação de números fixos brasileiros (10 dígitos, DDD válido).
       - Validação de números internacionais (formato E.164 entre 8 e 15 dígitos).
       - Rejeição de sequências fictícias/repetitivas (`00000000`, `11111111`, etc.) e DDDs inexistentes (`00`, `01`, `10`).
     - **Resolução Assíncrona com Fallback (`resolveRecipientPhone`):**
       - Validação prioritária do telefone direto fornecido.
       - Fallback com isolamento multi-tenant (`patientId` + `clinicId`) para buscar e validar o telefone cadastrado na tabela de pacientes (`patients`).
       - Retorno fortemente tipado com `source: 'direct' | 'patient_record'` ou códigos de erro descritivos (`missing_phone`, `invalid_ddd`, `invalid_mobile_digit`, `dummy_number`, `patient_not_found`).
  2. **Integração com Outbox & Dispatch de Campanhas (`src/services/followup/dispatch-campaign-recipient.ts`):**
     - A validação e resolução do telefone do paciente são executadas **antes** da chamada de envio ou enfileiramento externo.
     - Destinatários com números inválidos ou ausentes são suprimidos de forma segura (`invalid-phone:${error}`) com atualização dos contadores da campanha, prevenindo falhas de execução e retentativas inúteis.
  3. **Integração no Serviço de Follow-up (`src/services/followup/followup.service.ts`):**
     - `sendFollowUpMessage` valida e formata o telefone do destinatário antes de qualquer chamada HTTP, registrando avisos estruturados em caso de número inválido.

---

## Arquivos Criados / Modificados

| Arquivo | Tipo | Descrição |
|---|---|---|
| `src/modules/followup/services/phone-resolver.ts` | NEW | Resolvedor e validador de telefones de destinatários |
| `src/modules/followup/services/__tests__/phone-resolver.test.ts` | NEW | 8 testes unitários e de contrato cobrindo celulares, fixos, DDI, DDD, números inválidos e fallback |
| `src/services/followup/dispatch-campaign-recipient.ts` | MOD | Validação e resolução de telefone pré-dispatch no job outbox |
| `src/services/followup/followup.service.ts` | MOD | Validação de telefone no envio de mensagens de pós-consulta e retorno |
| `src/modules/followup/index.ts` | MOD | Exportação pública do resolvedor de telefone |
| `docs/superpowers/audits/2026-08-24-f7-03-phone-resolver.md` | NEW | Este relatório de auditoria |

---

## Testes Executados

| Suite / Comando | Resultado | Detalhes |
|---|---|---|
| `npx jest src/modules/followup/services/__tests__/phone-resolver.test.ts` | **PASS** | 1 suite, 8 testes verdes |
| `npx jest src/services/followup/__tests__/` | **PASS** | 6 suites, 53 testes verdes (campaigns, budget follow-up, inactive patients, segmentation, return reminders) |
| `npx jest src/modules/followup/actions/__tests__/` | **PASS** | 3 suites, 11 testes verdes |
| `npm run typecheck` (`tsc --noEmit`) | **PASS** | 0 erros de tipagem TypeScript |
| `npm run lint` (`eslint . --max-warnings=0`) | **PASS** | 0 warnings / 0 erros |
| `npm run roadmap:check` | **PASS** | 143 itens consistentes |
