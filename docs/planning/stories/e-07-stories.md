# Stories - Epic E-07: Call Center com IA

---
epic: E-07
epic_name: Call Center com IA
created_date: 2026-03-27
methodology: BMAD v6.2.2
total_stories: 8
total_story_points: 21
sprint: 9-10
status: Pós-MVP
---

## Visão do Epic

**Como** clínica odontológica
**Quero** um sistema de call center automatizado com IA
**Para que** eu possa fazer e receber ligações automaticamente

---

## Story E-07-S01: Infraestrutura de Voz

### User Story

**Como** sistema Synkroo
**Quero** me conectar a um provedor de telefonia
**Para que** possa fazer e receber ligações via API

### Prioridade: P2 | Estimativa: 5 SP

### Critérios de Aceitação

```gherkin
Scenario: Configurar provedor de telefonia
  Given tenho uma conta Twilio/Vonage
  When configuro as credenciais no sistema
  Then o sistema deve validar a conexão
  And deve listar números disponíveis
  And deve permitir aquisição de número

Scenario: Receber ligação inbound
  Given um número está configurado
  When uma ligação é recebida
  Then o sistema deve atender automaticamente
  And deve iniciar fluxo de atendimento
  And deve registrar metadata da chamada

Scenario: Fazer ligação outbound
  Given tenho um número para ligar
  When solicito a chamada
  Then o sistema deve iniciar a ligação
  And deve aguardar atendimento
  And deve conectar ao fluxo de IA
```

### Dependências

- Conta Twilio ou Vonage provisionada
- Número de telefone adquirido
- Compliance LGPD para gravações

### Tarefas Técnicas

- [ ] Escolher e integrar provedor (Twilio/Vonage)
- [ ] Implementar cliente da API de voz
- [ ] Configurar webhook de chamadas
- [ ] Implementar fluxo de atendimento básico
- [ ] Criar modelo de chamadas no banco
- [ ] Implementar gravação de chamadas
- [ ] Configurar armazenamento seguro
- [ ] Escrever testes de integração

---

## Story E-07-S02: Text-to-Speech Natural

### User Story

**Como** sistema de call center
**Quero** converter texto em fala natural
**Para que** o paciente tenha uma experiência de conversa fluida

### Prioridade: P2 | Estimativa: 3 SP

### Critérios de Aceitação

```gherkin
Scenario: Gerar fala a partir de texto
  Given o agente IA gerou uma resposta
  When o sistema converte para áudio
  Then o áudio deve soar natural
  And a latência deve ser <1s
  And a voz deve ser consistente

Scenario: Interromper fala (barge-in)
  Given o sistema está falando
  When o paciente interrompe
  Then o sistema deve parar a fala
  And deve processar a entrada do paciente
  And deve responder apropriadamente

Scenario: Múltiplos idiomas
  Given a clínica atende em português
  When o sistema gera fala
  Then deve usar português brasileiro
  And deve ter pronúncia natural
  And deve respeitar sotaque regional se configurado
```

### Dependências

- Story E-07-S01 (Infraestrutura)
- Serviço TTS (ElevenLabs, Azure, Google)

### Tarefas Técnicas

- [ ] Avaliar provedores TTS
- [ ] Integrar serviço TTS escolhido
- [ ] Implementar cache de áudios comuns
- [ ] Configurar voz padrão da clínica
- [ ] Implementar barge-in handling
- [ ] Otimizar latência
- [ ] Escrever testes de qualidade

---

## Story E-07-S03: Speech-to-Text em Tempo Real

### User Story

**Como** sistema de call center
**Quero** transcrever a fala do paciente em tempo real
**Para que** eu possa processar a intenção e responder

### Prioridade: P2 | Estimativa: 3 SP

### Critérios de Aceitação

```gherkin
Scenario: Transcrever fala em tempo real
  Given o paciente está falando
  When o sistema processa o áudio
  Then a transcrição deve aparecer em <2s
  And a precisão deve ser >90%
  And deve funcionar com sotaques variados

Scenario: Identificar silêncio
  Given o paciente parou de falar
  When há silêncio por 1 segundo
  Then o sistema deve considerar fala completa
  And deve processar a intenção
  And deve gerar resposta

Scenario: Termos odontológicos
  Given o paciente menciona "implante dentário"
  When o sistema transcreve
  Then deve reconhecer corretamente termos técnicos
  And deve manter precisão em nomes de procedimentos
```

### Dependências

- Story E-07-S01 (Infraestrutura)
- Serviço STT (Twilio, Google, Azure)

### Tarefas Técnicas

- [ ] Avaliar provedores STT
- [ ] Integrar streaming de áudio
- [ ] Implementar processamento em tempo real
- [ ] Treinar modelo para termos odontológicos
- [ ] Implementar detecção de silêncio
- [ ] Criar vocabulário customizado
- [ ] Escrever testes de precisão

---

## Story E-07-S04: Agente de Voz Inteligente

### User Story

**Como** sistema de call center
**Quero** um agente de IA que conduza conversas por voz
**Para que** o paciente seja atendido sem intervenção humana

### Prioridade: P2 | Estimativa: 5 SP

### Critérios de Aceitação

```gherkin
Scenario: Atender ligação inbound
  Given uma ligação é recebida
  When o agente atende
  Then deve cumprimentar o paciente
  And deve identificar a intenção da chamada
  And deve conduzir a conversa naturalmente

Scenario: Agendar consulta via voz
  Given o paciente quer agendar
  When o agente processa a solicitação
  Then deve verificar disponibilidade
  And deve propor horários
  And deve confirmar o agendamento
  And deve atualizar o sistema

Scenario: Transferir para humano
  Given o agente detecta situação complexa
  When a intenção é "falar com atendente"
  Then deve transferir a ligação
  And deve passar contexto da conversa
  And deve registrar a transferência
```

### Dependências

- E-01, E-02 funcionando (para contexto)
- Stories E-07-S01 a E-07-S03

### Tarefas Técnicas

- [ ] Criar fluxo de conversa de voz
- [ ] Implementar estado de sessão
- [ ] Integrar com agendamentos (E-02)
- [ ] Implementar detecção de escalação
- [ ] Criar prompts de sistema para voz
- [ ] Implementar confirmação por voz
- [ ] Testar cenários complexos

---

## Story E-07-S05: Ligações de Lembrete Outbound

### User Story

**Como** clínica odontológica
**Quero** que o sistema ligue automaticamente para lembrar pacientes
**Para que** a taxa de no-show seja reduzida

### Prioridade: P2 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Ligação de lembrete 24h antes
  Given um paciente tem consulta amanhã às 14:00
  When faltam 24 horas
  Then o sistema deve fazer ligação automática
  And deve identificar o paciente por telefone
  And deve confirmar a consulta
  And deve processar a resposta

Scenario: Confirmar presença
  Given o paciente atende a ligação
  When confirma a consulta
  Then o sistema deve atualizar status
  And deve agradecer e encerrar
  And deve registrar confirmação

Scenario: Reagendar via voz
  Given o paciente quer reagendar
  When solicita outro horário
  Then o sistema deve propor alternativas
  And deve confirmar novo horário
  And deve atualizar o agendamento
```

### Dependências

- E-02 (Gestão de Agendamentos) funcionando
- Story E-07-S04 (Agente de Voz)

### Tarefas Técnicas

- [ ] Criar job de lembretes automáticos
- [ ] Implementar lógica de timing
- [ ] Criar fluxo de confirmação
- [ ] Implementar reagendamento via voz
- [ ] Criar retry para não-atendidas
- [ ] Registrar logs de compliance
- [ ] Escrever testes

---

## Story E-07-S06: Ligações de Reativação

### User Story

**Como** clínica odontológica
**Quero** ligar automaticamente para pacientes inativos
**Para que** eu possa recuperá-los

### Prioridade: P2 | Estimativa: 1 SP

### Critérios de Aceitação

```gherkin
Scenario: Identificar pacientes inativos
  Given passou 60 dias desde a última visita
  When o sistema executa verificação
  Then deve listar pacientes inativos
  And deve priorizar por valor histórico

Scenario: Ligação de reativação
  Given um paciente inativo é selecionado
  When o sistema faz a ligação
  Then deve oferecer benefício de retorno
  And deve tentar agendar consulta
  And deve registrar resultado da ligação

Scenario: Resposta negativa
  Given o paciente não quer retornar
  When recusa a oferta
  Then o sistema deve agradecer
  And deve registrar motivo se fornecido
  And deve atualizar status do paciente
```

### Dependências

- E-03 (Follow-up) funcionando
- Story E-07-S04 (Agente de Voz)

### Tarefas Técnicas

- [ ] Criar job de identificação de inativos
- [ ] Implementar fluxo de reativação
- [ ] Criar ofertas dinâmicas
- [ ] Implementar agendamento integrado
- [ ] Criar dashboard de reativação
- [ ] Escrever testes

---

## Story E-07-S07: Análise de Sentimento

### User Story

**Como** gestor da clínica
**Quero** analisar o sentimento das chamadas
**Para que** eu possa identificar problemas e melhorar o atendimento

### Prioridade: P3 | Estimativa: 1 SP

### Critérios de Aceitação

```gherkin
Scenario: Detectar sentimento positivo
  Given uma chamada foi concluída
  When o sistema analisa a transcrição
  Then deve classificar como "positivo"
  And deve registrar no histórico
  And deve atualizar score do paciente

Scenario: Detectar insatisfação
  Given o paciente demonstrou insatisfação
  When o sistema detecta sentimento negativo
  Then deve alertar o responsável
  And deve sugerir follow-up
  And deve registrar para análise

Scenario: Relatório de sentimento
  Given o gestor solicita relatório
  When define o período
  Then deve mostrar distribuição de sentimentos
  And deve listar chamadas problemáticas
  And deve sugerir melhorias
```

### Dependências

- Stories E-07-S01 a E-07-S04

### Tarefas Técnicas

- [ ] Integrar análise de sentimento
- [ ] Criar modelo de classificação
- [ ] Implementar alertas automáticos
- [ ] Criar dashboard de sentimento
- [ ] Implementar recomendações
- [ ] Escrever testes

---

## Story E-07-S08: Dashboard de Call Center

### User Story

**Como** gestor da clínica
**Quero** um dashboard com métricas de chamadas
**Para que** eu possa monitorar a performance do call center

### Prioridade: P2 | Estimativa: 1 SP

### Critérios de Aceitação

```gherkin
Scenario: Visualizar métricas do dia
  Given o gestor acessa o dashboard
  When a página carrega
  Then deve visualizar total de chamadas
  And deve visualizar taxa de atendimento
  And deve visualizar tempo médio
  And deve visualizar taxa de transferência

Scenario: Histórico de chamadas
  Given o gestor quer ver detalhes
  When acessa o histórico
  Then deve listar todas as chamadas
  And deve permitir filtrar por data
  And deve permitir ouvir gravações
  And deve mostrar transcrição

Scenario: Métricas de efetividade
  Given o gestor quer avaliar ROI
  When acessa métricas
  Then deve visualizar confirmações via voz
  And deve visualizar reativações
  And deve visualizar tempo economizado
```

### Dependências

- Todas as stories anteriores

### Tarefas Técnicas

- [ ] Criar agregação de métricas
- [ ] Implementar gráficos de chamadas
- [ ] Criar player de áudio
- [ ] Implementar filtros e busca
- [ ] Criar exportação de relatórios
- [ ] Escrever testes

---

## Resumo do Epic

| Story | Nome | SP | Prioridade | Dependências |
|-------|------|----|-----------:|--------------|
| E-07-S01 | Infraestrutura de Voz | 5 | P2 | Twilio/Vonage |
| E-07-S02 | Text-to-Speech Natural | 3 | P2 | E-07-S01 |
| E-07-S03 | Speech-to-Text Tempo Real | 3 | P2 | E-07-S01 |
| E-07-S04 | Agente de Voz Inteligente | 5 | P2 | E-07-S01 a S03 |
| E-07-S05 | Ligações de Lembrete | 2 | P2 | E-07-S04 |
| E-07-S06 | Ligações de Reativação | 1 | P2 | E-07-S04 |
| E-07-S07 | Análise de Sentimento | 1 | P3 | E-07-S04 |
| E-07-S08 | Dashboard de Call Center | 1 | P2 | Todas anteriores |
| **Total** | | **21** | | |

---

**Documento criado por:** BMAD Method v6.2.2
**Data:** 2026-03-27
**Status:** ✅ Stories Definidas - Pronto para Estimativa