# Stories - Epic E-08: Dashboard e Gestão

---
epic: E-08
epic_name: Dashboard e Gestão
created_date: 2026-03-27
methodology: BMAD v6.2.2
total_stories: 4
total_story_points: 8
sprint: 3-4
---

## Visão do Epic

**Como** gestor da clínica
**Quero** um dashboard com métricas e relatórios
**Para que** eu possa tomar decisões baseadas em dados

---

## Story E-08-S01: Dashboard Principal

### User Story

**Como** gestor da clínica
**Quero** ver um dashboard com métricas principais
**Para que** eu tenha visão geral do negócio

### Prioridade: P1 | Estimativa: 3 SP

### Critérios de Aceitação

```gherkin
Scenario: Visualizar métricas do dia
  Given acesso o dashboard
  When a página carrega
  Then devo ver agendamentos do dia
  And devo ver mensagens atendidas
  And devo ver taxa de confirmação

Scenario: Comparativo com período anterior
  Given estou no dashboard
  When visualizo métricas
  Then devo ver comparação com semana anterior
  And devo ver indicador de tendência (↑/↓)

Scenario: Alertas de atenção
  Given há alertas pendentes
  When acesso o dashboard
  Then devo ver alertas destacados
  And devo poder clicar para detalhes
```

### Dependências

- E-01: Atendimento Multicanal (dados de mensagens)
- E-02: Gestão de Agendamentos (dados de agendamentos)
- E-04: CRM Inteligente (dados de pacientes)

### Tarefas Técnicas

- [ ] Criar queries de agregação
- [ ] Implementar API de dashboard
- [ ] Calcular métricas derivadas
- [ ] Criar visualizações
- [ ] Implementar cache

### Métricas do Dashboard

| Métrica | Fonte | Atualização |
|---------|-------|-------------|
| Agendamentos do dia | appointments | Real-time |
| Taxa de confirmação | appointments | Tempo real |
| Mensagens atendidas | messages | Tempo real |
| Pacientes novos | patients | Diário |
| No-shows | appointments | Diário |
| ROI mensal | calculated | Diário |

---

## Story E-08-S02: Relatórios de Agendamentos

### User Story

**Como** gestor
**Quero** relatórios detalhados de agendamentos
**Para que** eu possa analisar a performance

### Prioridade: P1 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Relatório mensal
  Given acesso relatórios
  When seleciono período "Março 2026"
  Then devo ver total de agendamentos
  And devo ver distribuição por procedimento
  And devo ver taxa de no-show

Scenario: Filtros de relatório
  Given quero filtrar relatório
  When seleciono profissional específico
  Then devo ver dados apenas desse profissional

Scenario: Exportar relatório
  Given estou visualizando relatório
  When clico em exportar
  Then devo poder baixar em PDF ou CSV
```

### Dependências

- E-02: Gestão de Agendamentos

### Tarefas Técnicas

- [ ] Criar queries de relatório
- [ ] Implementar filtros
- [ ] Gerar PDF
- [ ] Exportar CSV
- [ ] Cache de relatórios

---

## Story E-08-S03: Cálculo de ROI

### User Story

**Como** gestor
**Quero** ver o ROI da plataforma
**Para que** eu possa justificar o investimento

### Prioridade: P1 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Calcular ROI
  Given o sistema tem dados de uso
  When acesso seção de ROI
  Then devo ver valor economizado (horas de atendente)
  And devo ver receita gerada (agendamentos)
  And devo ver ROI = (receita - custo) / custo

Scenario: Comparativo mensal
  Given tenho ROI calculado
  When visualizo histórico
  Then devo ver evolução mês a mês
  And devo ver projeção para próximo mês
```

### Dependências

- E-01, E-02, E-03 (dados de uso)

### Tarefas Técnicas

- [ ] Definir fórmula de ROI
- [ ] Calcular horas economizadas
- [ ] Calcular receita gerada
- [ ] Criar visualização
- [ ] Projeção simples

### Fórmula ROI

```
ROI = (Valor Economizado + Receita Gerada - Custo Plataforma) / Custo Plataforma

Valor Economizado = Mensagens Atendidas IA × Tempo Médio × Valor Hora Atendente
Receita Gerada = Agendamentos via IA × Ticket Médio
```

---

## Story E-08-S04: Relatórios de Pacientes

### User Story

**Como** gestor
**Quero** relatórios de pacientes
**Para que** eu possa entender minha base

### Prioridade: P1 | Estimativa: 1 SP

### Critérios de Aceitação

```gherkin
Scenario: Relatório de novos pacientes
  Given acesso relatório de pacientes
  When visualizo dados
  Then devo ver novos pacientes por período
  And devo ver origem (WhatsApp/Instagram/Manual)

Scenario: Relatório de retenção
  Given quero ver retenção
  When acesso relatório
  Then devo ver taxa de retorno
  And devo ver pacientes inativos
```

### Dependências

- E-04: CRM Inteligente

### Tarefas Técnicas

- [ ] Criar queries
- [ ] Calcular métricas de retenção
- [ ] Visualizar gráficos
- [ ] Exportar dados

---

## Resumo das Stories

| Story | Nome | Prioridade | SP | Sprint |
|-------|------|------------|-----|--------|
| E-08-S01 | Dashboard Principal | P1 | 3 | 3 |
| E-08-S02 | Relatórios Agendamentos | P1 | 2 | 4 |
| E-08-S03 | Cálculo de ROI | P1 | 2 | 4 |
| E-08-S04 | Relatórios Pacientes | P1 | 1 | 4 |
| **Total** | | | **8** | **2 Sprints** |

---

## Definition of Ready (DoR)

Antes de iniciar qualquer Story do E-08:

- [ ] PRD e Architecture aprovados
- [ ] E-01 (Atendimento Multicanal) implementado - para dados de mensagens
- [ ] E-02 (Gestão de Agendamentos) implementado - para dados de agendamentos
- [ ] E-04 (CRM Inteligente) implementado - para dados de pacientes
- [ ] Sistema de relatórios configurado

## Definition of Done (DoD)

Para considerar uma Story completa:

- [ ] Código implementado e revisado
- [ ] Testes unitários com cobertura > 80%
- [ ] Queries de agregação otimizadas
- [ ] Cache implementado para dashboards
- [ ] Export PDF/CSV funcionando
- [ ] Documentação atualizada
- [ ] Deploy em staging

## NFR Traceability

| Story | NFRs Relacionados |
|-------|-------------------|
| E-08-S01 | NFR-48 (Dashboard principal), NFR-49 (Métricas em tempo real) |
| E-08-S02 | NFR-50 (Relatórios de agendamentos), NFR-51 (Export PDF/CSV) |
| E-08-S03 | NFR-52 (Cálculo de ROI), NFR-53 (Projeção mensal) |
| E-08-S04 | NFR-54 (Relatórios de pacientes), NFR-55 (Métricas de retenção) |

---

**Documento criado por:** BMAD Method v6.2.2
**Data:** 2026-03-27
**Status:** ✅ Stories Criados - Ready for Sprint Planning