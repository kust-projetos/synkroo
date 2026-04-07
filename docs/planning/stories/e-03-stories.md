# Stories - Epic E-03: Follow-up e Retenção

---
epic: E-03
epic_name: Follow-up e Retenção
created_date: 2026-03-27
methodology: BMAD v6.2.2
total_stories: 6
total_story_points: 13
sprint: 3-4
---

## Visão do Epic

**Como** clínica odontológica
**Quero** um sistema de follow-up automatizado
**Para que** meus pacientes retornem regularmente e a receita seja maximizada

---

## Story E-03-S01: Follow-up Pós-Consulta

### User Story

**Como** sistema
**Quero** enviar follow-up automático após cada consulta
**Para que** o paciente se sinta cuidado e forneça feedback

### Prioridade: P0 | Estimativa: 3 SP

### Critérios de Aceitação

```gherkin
Scenario: Enviar follow-up 2h após consulta
  Given uma consulta foi concluída
  When passam 2 horas
  Then deve enviar mensagem de follow-up
  And deve incluir orientações do procedimento
  And deve solicitar feedback

Scenario: Incluir orientações pós-procedimento
  Given paciente fez extração
  When envia follow-up
  Then deve incluir orientações específicas de extração
  And deve incluir telefone para emergência

Scenario: Solicitar avaliação
  Given follow-up foi enviado
  When paciente responde
  Then deve registrar feedback
  And deve calcular NPS
```

### Dependências

- E-02: Gestão de Agendamentos (status concluído)

### Tarefas Técnicas

- [ ] Criar job de verificação pós-consulta
- [ ] Implementar templates por procedimento
- [ ] Criar banco de orientações
- [ ] Registrar feedback
- [ ] Calcular NPS

---

## Story E-03-S02: Lembretes de Retorno

### User Story

**Como** sistema
**Quero** enviar lembretes de retorno baseados em regras
**Para que** o paciente não esqueça de voltar

### Prioridade: P1 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Lembrete 6 meses após limpeza
  Given paciente fez limpeza há 6 meses
  When o job executa
  Then deve enviar lembrete de retorno
  And deve sugerir agendamento

Scenario: Regra por procedimento
  Given cada procedimento tem periodicidade
  When configurada
  Then deve respeitar a periodicidade
```

### Dependências

- E-02: Gestão de Agendamentos

### Tarefas Técnicas

- [ ] Configurar periodicidade por procedimento
- [ ] Criar job de verificação
- [ ] Implementar templates
- [ ] Permitir configuração por clínica

---

## Story E-03-S03: Identificação de Pacientes Inativos

### User Story

**Como** sistema
**Quero** identificar pacientes inativos automaticamente
**Para que** eu possa reativá-los

### Prioridade: P1 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Marcar paciente inativo 30 dias
  Given paciente não retorna há 30 dias
  When o job executa
  Then deve marcar como "Inativo 30 dias"
  And deve adicionar à lista de reativação

Scenario: Escalonar inatividade
  Given paciente está inativo 30/60/90 dias
  When passam mais 30 dias
  Then deve atualizar o status
  And deve priorizar campanhas
```

### Dependências

- E-04: CRM Inteligente

### Tarefas Técnicas

- [ ] Criar job de verificação diária
- [ ] Calcular dias desde último atendimento
- [ ] Atualizar status do paciente
- [ ] Criar segmentos de inatividade

---

## Story E-03-S04: Campanhas de Reativação

### User Story

**Como** gestor
**Quero** enviar campanhas de reativação automáticas
**Para que** pacientes inativos retornem

### Prioridade: P1 | Estimativa: 3 SP

### Critérios de Aceitação

```gherkin
Scenario: Enviar campanha para inativos 60 dias
  Given há pacientes inativos há 60 dias
  When a campanha é disparada
  Then deve enviar mensagem personalizada
  And deve incluir oferta de retorno

Scenario: Agendar retorno via campanha
  Given paciente recebeu campanha
  When responde positivamente
  Then deve iniciar fluxo de agendamento

Scenario: Respeitar opt-out
  Given paciente optou por não receber mensagens
  When campanha é disparada
  Then não deve enviar para este paciente
```

### Dependências

- Story E-03-S03 (Identificação)
- E-01: Atendimento Multicanal

### Tarefas Técnicas

- [ ] Criar sistema de campanhas
- [ ] Implementar templates por segmento
- [ ] Respeitar opt-out
- [ ] Registrar métricas de conversão
- [ ] Limitar frequência

---

## Story E-03-S05: Recuperação de Orçamentos

### User Story

**Como** sistema
**Quero** identificar orçamentos não convertidos
**Para que** eu possa fazer follow-up e converter

### Prioridade: P1 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Identificar orçamento pendente
  Given um orçamento foi gerado há 7 dias
  When não foi convertido
  Then deve identificar como pendente
  And deve iniciar sequência de follow-up

Scenario: Sequência de follow-up
  Given orçamento está pendente
  When executa sequência
  Then deve enviar mensagem dia 7
  And deve enviar mensagem dia 14
  And deve notificar vendedor
```

### Dependências

- Sistema de orçamentos (novo módulo)

### Tarefas Técnicas

- [ ] Criar tabela de orçamentos
- [ ] Implementar job de verificação
- [ ] Criar sequência de follow-up
- [ ] Registrar conversão

---

## Story E-03-S06: Alertas de Tratamentos Incompletos

### User Story

**Como** sistema
**Quero** alertar sobre tratamentos incompletos
**Para que** o paciente complete o tratamento

### Prioridade: P1 | Estimativa: 1 SP

### Critérios de Aceitação

```gherkin
Scenario: Detectar tratamento incompleto
  Given paciente iniciou tratamento de canal
  When não completou em 30 dias
  Then deve alertar clínica
  And deve sugerir follow-up com paciente
```

### Dependências

- E-02: Gestão de Agendamentos

### Tarefas Técnicas

- [ ] Identificar tratamentos multi-sessão
- [ ] Calcular progresso do tratamento
- [ ] Gerar alertas
- [ ] Notificar equipe

---

## Resumo das Stories

| Story | Nome | Prioridade | SP | Sprint |
|-------|------|------------|-----|--------|
| E-03-S01 | Follow-up Pós-Consulta | P0 | 3 | 3 |
| E-03-S02 | Lembretes de Retorno | P1 | 2 | 3 |
| E-03-S03 | Identificação Inativos | P1 | 2 | 4 |
| E-03-S04 | Campanhas de Reativação | P1 | 3 | 4 |
| E-03-S05 | Recuperação Orçamentos | P1 | 2 | 4 |
| E-03-S06 | Tratamentos Incompletos | P1 | 1 | 4 |
| **Total** | | | **13** | **2 Sprints** |

---

## Definition of Ready (DoR)

Antes de iniciar qualquer Story do E-03:

- [ ] PRD e Architecture aprovados
- [ ] E-02 (Agendamentos) implementado
- [ ] E-04-S01 (Cadastro de Pacientes) implementado
- [ ] Job scheduler configurado
- [ ] Templates de mensagem aprovados

## Definition of Done (DoD)

Para considerar uma Story completa:

- [ ] Código implementado e revisado
- [ ] Testes unitários com cobertura > 80%
- [ ] Job agendado e testado
- [ ] Templates de mensagem validados
- [ ] Documentação atualizada
- [ ] Deploy em staging
- [ ] Métricas de sucesso definidas

## NFR Traceability

| Story | NFRs Relacionados |
|-------|-------------------|
| E-03-S01 | NFR-21 (Follow-up pós-consulta), NFR-22 (Templates por procedimento) |
| E-03-S02 | NFR-23 (Lembretes de retorno) |
| E-03-S03 | NFR-24 (Detecção de inativos) |
| E-03-S04 | NFR-25 (Campanhas de reativação), NFR-26 (Opt-out) |
| E-03-S05 | NFR-27 (Recuperação de orçamentos) |
| E-03-S06 | NFR-28 (Tratamentos incompletos) |

---

**Documento criado por:** BMAD Method v6.2.2
**Data:** 2026-03-27
**Status:** ✅ Stories Criados - Ready for Sprint Planning