# Stories - Epic E-05: Vendas e Conversão

---
epic: E-05
epic_name: Vendas e Conversão
created_date: 2026-03-27
methodology: BMAD v6.2.2
total_stories: 4
total_story_points: 8
sprint: 3-5
---

## Visão do Epic

**Como** clínica odontológica
**Quero** ferramentas de vendas automatizadas
**Para que** eu possa converter mais leads em pacientes pagantes

---

## Story E-05-S01: Captura de Leads

### User Story

**Como** sistema
**Quero** capturar leads de todos os canais
**Para que** eu não perca oportunidades

### Prioridade: P0 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Capturar lead do WhatsApp
  Given um novo contato envia mensagem
  When demonstra interesse em procedimento
  Then deve criar um lead
  And deve classificar fonte como WhatsApp

Scenario: Capturar lead do Instagram
  Given um usuário envia DM no Instagram
  When demonstra interesse
  Then deve criar um lead
  And deve classificar fonte como Instagram

Scenario: Lead já existe
  Given um lead já foi criado
  When nova interação acontece
  Then deve atualizar o lead existente
  And não deve duplicar
```

### Dependências

- E-01: Atendimento Multicanal
- E-04: CRM Inteligente

### Tarefas Técnicas

- [ ] Criar tabela de leads
- [ ] Detectar intenção de compra
- [ ] Associar ao paciente existente
- [ ] Registrar fonte e canal
- [ ] Implementar deduplicação

### Schema de Lead

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | ID único |
| patient_id | UUID | FK (pode ser null) |
| source | Enum | whatsapp/instagram/manual |
| status | Enum | new/qualified/converted/lost |
| score | Integer | 0-100 |
| notes | Text | Observações |

---

## Story E-05-S02: Qualificação de Leads

### User Story

**Como** sistema
**Quero** qualificar leads automaticamente
**Para que** eu possa priorizar os mais promissores

### Prioridade: P1 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Calcular scoring do lead
  Given um lead foi criado
  When o sistema qualifica
  Then deve aplicar scoring baseado em:
    - Respostas a perguntas
    - Interesse demonstrado
    - Urgência
  And deve categorizar (quente/morno/frio)

Scenario: Lead quente
  Given lead tem score > 70
  When qualificado
  Then deve marcar como "quente"
  And deve notificar responsável

Scenario: Atualizar scoring
  Given lead interage novamente
  When demonstra mais interesse
  Then deve aumentar o scoring
  And deve reclassificar se necessário
```

### Dependências

- Story E-05-S01 (Captura)

### Tarefas Técnicas

- [ ] Definir critérios de scoring
- [ ] Implementar algoritmo
- [ ] Criar categorias
- [ ] Notificar sobre leads quentes
- [ ] Registrar histórico de scoring

### Critérios de Scoring

| Critério | Pontos |
|----------|--------|
| Interesse em procedimento específico | +20 |
| Perguntou preço | +15 |
| Demonstrou urgência | +15 |
| Já é paciente | +10 |
| Respondeu rapidamente | +10 |
| Fora do horário comercial | +5 |

---

## Story E-05-S03: Agendamento de Avaliações

### User Story

**Como** sistema
**Quero** agendar avaliações automaticamente
**Para que** leads se convertam em consultas

### Prioridade: P0 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Oferecer avaliação para lead quente
  Given lead é classificado como "quente"
  When o sistema processa
  Then deve oferecer agendamento de avaliação
  And deve sugerir horários disponíveis

Scenario: Agendar avaliação
  Given lead aceita avaliação
  When confirma horário
  Then deve criar agendamento
  And deve marcar lead como convertido

Scenario: Follow-up se não agendou
  Given lead não agendou na primeira interação
  When passam 24h
  Then deve enviar follow-up
  And deve oferecer avaliação novamente
```

### Dependências

- Story E-05-S02 (Qualificação)
- E-02: Gestão de Agendamentos

### Tarefas Técnicas

- [ ] Integrar com agendamento
- [ ] Criar fluxo de avaliação
- [ ] Implementar follow-up automático
- [ ] Marcar conversão no lead

---

## Story E-05-S04: Notificação de Leads Quentes

### User Story

**Como** vendedor
**Quero** ser notificado sobre leads quentes
**Para que** eu possa contactar rapidamente

### Prioridade: P1 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Notificar lead quente
  Given um lead é classificado como "quente"
  When o scoring é calculado
  Then deve notificar responsável via WhatsApp/app
  And deve incluir detalhes do lead

Scenario: Dashboard de leads
  Given sou vendedor
  When acesso o dashboard
  Then devo ver leads quentes em destaque
  And devo ver histórico de interações
```

### Dependências

- Story E-05-S02 (Qualificação)

### Tarefas Técnicas

- [ ] Criar sistema de notificação
- [ ] Implementar dashboard de leads
- [ ] Configurar responsáveis por lead
- [ ] Registrar tempo de resposta

---

## Resumo das Stories

| Story | Nome | Prioridade | SP | Sprint |
|-------|------|------------|-----|--------|
| E-05-S01 | Captura de Leads | P0 | 2 | 3 |
| E-05-S02 | Qualificação de Leads | P1 | 2 | 4 |
| E-05-S03 | Agendamento de Avaliações | P0 | 2 | 4 |
| E-05-S04 | Notificação de Leads Quentes | P1 | 2 | 5 |
| **Total** | | | **8** | **3 Sprints** |

---

## Definition of Ready (DoR)

Antes de iniciar qualquer Story do E-05:

- [ ] PRD e Architecture aprovados
- [ ] E-01 (Atendimento Multicanal) implementado
- [ ] E-04 (CRM Inteligente) implementado
- [ ] E-02 (Agendamentos) para S03
- [ ] Sistema de notificações configurado

## Definition of Done (DoD)

Para considerar uma Story completa:

- [ ] Código implementado e revisado
- [ ] Testes unitários com cobertura > 80%
- [ ] Scoring de leads validado com negócio
- [ ] Integração com agendamentos funcionando
- [ ] Notificações testadas
- [ ] Documentação atualizada
- [ ] Deploy em staging

## NFR Traceability

| Story | NFRs Relacionados |
|-------|-------------------|
| E-05-S01 | NFR-40 (Captura de leads), NFR-41 (Deduplicação de leads) |
| E-05-S02 | NFR-42 (Scoring de leads), NFR-43 (Classificação quente/morno/frio) |
| E-05-S03 | NFR-44 (Agendamento de avaliações), NFR-45 (Follow-up automático) |
| E-05-S04 | NFR-46 (Notificação de leads quentes), NFR-47 (Dashboard de leads) |

---

**Documento criado por:** BMAD Method v6.2.2
**Data:** 2026-03-27
**Status:** ✅ Stories Criados - Ready for Sprint Planning