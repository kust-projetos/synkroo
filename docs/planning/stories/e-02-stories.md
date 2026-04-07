# Stories - Epic E-02: Gestão de Agendamentos

---
epic: E-02
epic_name: Gestão de Agendamentos
created_date: 2026-03-27
methodology: BMAD v6.2.2
total_stories: 10
total_story_points: 21
sprint: 2-3
---

## Visão do Epic

**Como** clínica odontológica
**Quero** um sistema de agendamento automatizado inteligente
**Para que** meus pacientes possam agendar, confirmar e cancelar consultas sem intervenção humana

---

## Story E-02-S01: Agendamento via Conversa Natural

### User Story

**Como** paciente
**Quero** agendar consultas através de conversa natural
**Para que** eu não precise navegar em menus complexos

### Prioridade: P0 | Estimativa: 8 SP

### Critérios de Aceitação

```gherkin
Scenario: Agendamento com data e hora
  Given um paciente envia "Quero marcar para quinta às 10h"
  When o sistema processa a mensagem
  Then deve verificar disponibilidade
  And deve apresentar opções disponíveis
  And deve permitir confirmação

Scenario: Agendamento com apenas data
  Given um paciente envia "Quero marcar para sexta"
  When o sistema processa
  Then deve perguntar horário preferido
  And deve mostrar horários disponíveis

Scenario: Agendamento com procedimento
  Given um paciente envia "Quero fazer uma limpeza"
  When o sistema processa
  Then deve identificar procedimento
  And deve perguntar data preferida
  And deve verificar duração do procedimento

Scenario: Agendamento completo em uma mensagem
  Given um paciente envia "Quero marcar limpeza com Dra. Maria para quinta às 14h"
  When o sistema processa
  Then deve extrair: procedimento, profissional, data, hora
  And deve verificar disponibilidade
  And deve solicitar confirmação
```

### Dependências

- E-01: Processamento de mensagens
- E-04-S02: Cadastro via conversa
- Story E-02-S02: Verificação de disponibilidade

### Tarefas Técnicas

- [x] Criar fluxo de agendamento conversacional (/api/agent/schedule-flow)
- [x] Integrar com extração de entidades
- [x] Implementar máquina de estados
- [x] Validar regras de negócio
- [x] Criar confirmação visual
- [x] Implementar timeout de sessão
- [x] Testar com diferentes padrões de linguagem

### Fluxo de Agendamento

```
1. Paciente: "Quero marcar uma consulta"
2. Sistema: "Claro! Qual procedimento você deseja?"
3. Paciente: "Limpeza"
4. Sistema: "Perfeito! Qual dia você prefere?"
5. Paciente: "Quinta-feira"
6. Sistema: "Tenho horários às 9h, 10h e 14h na quinta. Qual prefere?"
7. Paciente: "10h"
8. Sistema: "Confirmando: Limpeza na quinta (15/03) às 10h com Dra. Maria. Posso confirmar?"
9. Paciente: "Sim"
10. Sistema: "✅ Agendamento confirmado! Enviarei um lembrete 24h antes."
```

---

## Story E-02-S02: Verificação de Disponibilidade

### User Story

**Como** sistema
**Quero** verificar disponibilidade de horários em tempo real
**Para que** eu não agende horários indisponíveis

### Prioridade: P0 | Estimativa: 3 SP

### Critérios de Aceitação

```gherkin
Scenario: Verificar horário disponível
  Given um horário está livre
  When o sistema verifica disponibilidade
  Then deve retornar disponível
  And deve permitir agendamento

Scenario: Horário ocupado
  Given um horário já tem agendamento
  When o sistema verifica disponibilidade
  Then deve retornar indisponível
  And deve sugerir horários próximos

Scenario: Horário fora do expediente
  Given um horário é 22h
  When o sistema verifica disponibilidade
  Then deve retornar fora do expediente
  And deve mostrar horário de funcionamento

Scenario: Bloqueio de agenda
  Given um profissional bloqueou a agenda
  When o sistema verifica disponibilidade
  Then deve respeitar o bloqueio
  And deve mostrar motivo se definido
```

### Dependências

- Tabela de profissionais
- Tabela de agendamentos
- Configuração de horários

### Tarefas Técnicas

- [x] Criar tabela de agendamentos (appointments)
- [x] Criar tabela de bloqueios (schedule_blocks)
- [x] Implementar query de disponibilidade
- [x] Configurar horários de expediente
- [x] Implementar cache de disponibilidade
- [x] Criar índices para performance

### Schema de Agendamento

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | ID único |
| patient_id | UUID | FK paciente |
| professional_id | UUID | FK profissional |
| procedure_id | UUID | FK procedimento |
| date | Date | Data do agendamento |
| start_time | Time | Horário início |
| end_time | Time | Horário fim (calculado) |
| status | Enum | pending/confirmed/completed/cancelled |
| notes | Text | Observações |

---

## Story E-02-S03: Múltiplos Profissionais/Agendas

### User Story

**Como** clínica com múltiplos dentistas
**Quero** gerenciar agendas separadas
**Para que** cada profissional tenha seus horários

### Prioridade: P0 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Selecionar profissional
  Given a clínica tem 3 dentistas
  When um paciente quer agendar
  Then deve poder escolher o profissional
  And deve ver disponibilidade específica

Scenario: Profissional padrão
  Given a clínica definiu Dr. João como padrão
  When paciente não especifica profissional
  Then deve agendar com Dr. João

Scenario: Agendar com específico
  Given paciente pede "Quero marcar com Dra. Maria"
  When o sistema processa
  Then deve agendar com Dra. Maria
```

### Dependências

- Tabela de profissionais
- Story E-02-S02 (Disponibilidade)

### Tarefas Técnicas

- [x] Criar tabela de profissionais (dentists)
- [x] Associar agendamentos a profissionais
- [x] Configurar horários por profissional (working_hours)
- [x] Implementar seleção de profissional
- [x] Criar página de gestão de profissionais (/dashboard/dentistas)

---

## Story E-02-S04: Reagendamento via Conversa

### User Story

**Como** paciente
**Quero** reagendar minha consulta através de conversa
**Para que** eu não precise ligar para a clínica

### Prioridade: P0 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Solicitar reagendamento
  Given tenho uma consulta agendada
  When envio "Preciso remarcar minha consulta"
  Then o sistema deve identificar meu agendamento
  And deve perguntar nova data/hora

Scenario: Reagendamento com nova data
  Given quero remarcar
  When informo "Para sexta às 15h"
  Then deve verificar disponibilidade
  And deve confirmar alteração
  And deve cancelar horário antigo

Scenario: Confirmar reagendamento
  Given o novo horário está disponível
  When confirmo a alteração
  Then deve atualizar o agendamento
  And deve notificar a clínica
```

### Dependências

- Story E-02-S01 (Agendamento)
- Story E-02-S02 (Disponibilidade)

### Tarefas Técnicas

- [x] Implementar fluxo de reagendamento (PUT /api/appointments/[id]/reschedule)
- [x] Atualizar status do agendamento antigo
- [x] Criar novo agendamento
- [x] Registrar histórico de alterações
- [x] Notificar profissional

---

## Story E-02-S05: Cancelamento via Conversa

### User Story

**Como** paciente
**Quero** cancelar minha consulta através de conversa
**Para que** eu possa liberar o horário

### Prioridade: P0 | Estimativa: 1 SP

### Critérios de Aceitação

```gherkin
Scenario: Solicitar cancelamento
  Given tenho uma consulta agendada
  When envio "Preciso cancelar minha consulta"
  Then o sistema deve pedir confirmação
  And deve mostrar detalhes da consulta

Scenario: Confirmar cancelamento
  Given solicitei cancelamento
  When confirmo
  Then deve atualizar status para cancelado
  And deve liberar o horário
  And deve confirmar com o paciente

Scenario: Perguntar motivo
  Given paciente cancelou
  When o sistema pergunta motivo
  Then deve registrar o motivo
  And deve usar para analytics
```

### Dependências

- Story E-02-S01 (Agendamento)

### Tarefas Técnicas

- [x] Implementar fluxo de cancelamento (PUT /api/appointments/[id]/cancel)
- [x] Registrar motivo de cancelamento
- [x] Liberar horário automaticamente
- [x] Notificar clínica
- [x] Atualizar métricas de no-show

---

## Story E-02-S06: Sugestão de Horários Alternativos

### User Story

**Como** paciente
**Quero** receber sugestões de horários quando o desejado não está disponível
**Para que** eu possa escolher outra opção

### Prioridade: P1 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Horário indisponível
  Given o horário solicitado está ocupado
  When o sistema verifica disponibilidade
  Then deve sugerir 3 horários próximos
  And deve priorizar mesmo dia

Scenario: Dia indisponível
  Given não há horários no dia solicitado
  When o sistema verifica
  Then deve sugerir dias próximos
  And deve manter mesmo horário preferido

Scenario: Aceitar sugestão
  Given sistema sugeriu "Sexta às 14h"
  When paciente aceita
  Then deve confirmar o agendamento
```

### Dependências

- Story E-02-S02 (Disponibilidade)

### Tarefas Técnicas

- [x] Implementar algoritmo de sugestão
- [x] Buscar horários próximos
- [x] Considerar preferências do paciente
- [x] Limitar sugestões a 3-5 opções

---

## Story E-02-S07: Prevenção de Overbooking

### User Story

**Como** sistema
**Quero** prevenir overbooking mesmo com requisições simultâneas
**Para que** não haja conflitos de horário

### Prioridade: P0 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Duas requisições simultâneas
  Given um horário tem 1 vaga
  When dois pacientes tentam agendar ao mesmo tempo
  Then apenas um deve conseguir
  And o outro deve receber sugestão alternativa

Scenario: Lock durante confirmação
  Given paciente está confirmando agendamento
  When outro paciente tenta mesmo horário
  Then deve aguardar confirmação
  And deve mostrar como indisponível se confirmado
```

### Dependências

- Story E-02-S02 (Disponibilidade)

### Tarefas Técnicas

- [x] Implementar lock otimista no banco
- [x] Usar transações atômicas (Supabase transactions)
- [x] Implementar fila de processamento
- [x] Criar testes de concorrência
- [x] Monitorar deadlocks

---

## Story E-02-S08: Confirmação Automática 24h

### User Story

**Como** sistema
**Quero** enviar confirmação automática 24h antes da consulta
**Para que** o paciente confirme ou cancele

### Prioridade: P0 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Enviar confirmação
  Given uma consulta está agendada para amanhã
  When faltam 24 horas
  Then deve enviar mensagem de confirmação
  And deve incluir botões Sim/Não
  And deve registrar envio

Scenario: Paciente confirma
  Given recebeu confirmação
  When paciente responde "Sim"
  Then deve atualizar status para confirmado
  And deve registrar confirmação

Scenario: Paciente cancela
  Given recebeu confirmação
  When paciente responde "Não"
  Then deve processar cancelamento
  And deve liberar horário
```

### Dependências

- Story E-02-S01 (Agendamento)
- Job scheduler configurado

### Tarefas Técnicas

- [x] Criar job de verificação (confirmation-handler.service.ts)
- [x] Implementar template de confirmação
- [x] Processar resposta do paciente (/api/appointments/confirm-response)
- [x] Atualizar status do agendamento
- [x] Registrar log de confirmações

---

## Story E-02-S09: Lembrete 2h Antes

### User Story

**Como** paciente
**Quero** receber lembrete 2h antes da consulta
**Para que** eu não me esqueça

### Prioridade: P0 | Estimativa: 1 SP

### Critérios de Aceitação

```gherkin
Scenario: Enviar lembrete
  Given uma consulta está agendada para daqui 2h
  When o job executa
  Then deve enviar mensagem de lembrete
  And deve incluir local e profissional

Scenario: Lembrete já confirmado
  Given paciente já confirmou 24h antes
  When envia lembrete 2h antes
  Then deve incluir "Você confirmou presença"
```

### Dependências

- Story E-02-S08 (Confirmação 24h)

### Tarefas Técnicas

- [x] Criar job de lembrete (reminder.service.ts, cron /api/cron/reminders)
- [x] Implementar template
- [x] Incluir detalhes da consulta
- [x] Verificar status de confirmação

---

## Story E-02-S10: Registro Automático de No-Shows

### User Story

**Como** sistema
**Quero** registrar automaticamente quando paciente não comparece
**Para que** eu tenha métricas de no-show

### Prioridade: P0 | Estimativa: 1 SP

### Critérios de Aceitação

```gherkin
Scenario: Detectar no-show
  Given uma consulta estava agendada
  When o horário passou sem check-in
  Then deve marcar como no-show
  And deve registrar no perfil do paciente

Scenario: Check-in manual
  Given paciente chegou
  When atendente registra presença
  Then deve marcar como concluído
  And não deve contar como no-show

Scenario: Alertar no-show recorrente
  Given paciente tem 3 no-shows
  When tenta agendar novamente
  Then deve alertar atendente
  And deve sugerir confirmação por ligação
```

### Dependências

- Story E-02-S01 (Agendamento)

### Tarefas Técnicas

- [x] Criar job de detecção de no-show (PUT /api/appointments/[id]/noshow)
- [x] Implementar check-in manual
- [x] Calcular taxa de no-show por paciente
- [x] Criar alerta de recorrência

---

## Resumo das Stories

| Story | Nome | Prioridade | SP | Sprint |
|-------|------|------------|-----|--------|
| E-02-S01 | Agendamento via Conversa | P0 | 8 | 2-3 |
| E-02-S02 | Verificação de Disponibilidade | P0 | 3 | 2 |
| E-02-S03 | Múltiplos Profissionais | P0 | 2 | 2 |
| E-02-S04 | Reagendamento | P0 | 2 | 3 |
| E-02-S05 | Cancelamento | P0 | 1 | 3 |
| E-02-S06 | Sugestão de Horários | P1 | 2 | 3 |
| E-02-S07 | Prevenção Overbooking | P0 | 2 | 2 |
| E-02-S08 | Confirmação 24h | P0 | 2 | 3 |
| E-02-S09 | Lembrete 2h | P0 | 1 | 3 |
| E-02-S10 | Registro No-Shows | P0 | 1 | 3 |
| **Total** | | | **24** | **2 Sprints** |

### Sprint 2 (15 SP)

- E-02-S01: Agendamento via Conversa (8 SP)
- E-02-S02: Verificação Disponibilidade (3 SP)
- E-02-S03: Múltiplos Profissionais (2 SP)
- E-02-S07: Prevenção Overbooking (2 SP)

### Sprint 3 (9 SP)

- E-02-S04: Reagendamento (2 SP)
- E-02-S05: Cancelamento (1 SP)
- E-02-S06: Sugestão Horários (2 SP)
- E-02-S08: Confirmação 24h (2 SP)
- E-02-S09: Lembrete 2h (1 SP)
- E-02-S10: No-Shows (1 SP)

---

## Definition of Ready (DoR)

Antes de iniciar qualquer Story do E-02:

- [ ] PRD e Architecture aprovados
- [ ] E-01-S01 (WhatsApp) implementado
- [ ] Schema de agendamentos criado
- [ ] Tabela de profissionais populada
- [ ] Horários de expediente configurados

## Definition of Done (DoD)

Para considerar uma Story completa:

- [ ] Código implementado e revisado
- [ ] Testes unitários com cobertura > 80%
- [ ] Testes de integração passando
- [ ] Validação de regras de negócio
- [ ] Documentação da API atualizada
- [ ] Sem bugs conhecidos
- [ ] Deploy em staging

## NFR Traceability

| Story | NFRs Relacionados |
|-------|-------------------|
| E-02-S01 | NFR-01 (Latência < 5s), NFR-13 (Conversação natural) |
| E-02-S02 | NFR-14 (Disponibilidade real-time) |
| E-02-S03 | NFR-15 (Multi-profissional) |
| E-02-S04 | NFR-01, NFR-13 |
| E-02-S05 | NFR-01, NFR-13 |
| E-02-S06 | NFR-16 (Sugestões inteligentes) |
| E-02-S07 | NFR-17 (Concorrência) |
| E-02-S08 | NFR-18 (Confirmação 24h) |
| E-02-S09 | NFR-19 (Lembrete 2h) |
| E-02-S10 | NFR-20 (No-show tracking) |

---

**Documento criado por:** BMAD Method v6.2.2
**Data:** 2026-03-27
**Status:** ✅ IMPLEMENTADO - Atualizado em 2026-04-07