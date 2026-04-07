# Stories - Epic E-01: Atendimento Multicanal

---
epic: E-01
epic_name: Atendimento Multicanal
created_date: 2026-03-27
methodology: BMAD v6.2.2
total_stories: 12
total_story_points: 34
sprint: 1-2
---

## Visão do Epic

**Como** clínica odontológica
**Quero** um sistema de atendimento automatizado multicanal
**Para que** meus pacientes possam ser atendidos 24/7 via WhatsApp, Instagram e outros canais

---

## Story E-01-S01: Integração WhatsApp Business API

### User Story

**Como** sistema Synkroo
**Quero** me conectar ao WhatsApp Business API
**Para que** possa receber e enviar mensagens dos pacientes

### Prioridade: P0 | Estimativa: 5 SP

### Critérios de Aceitação

```gherkin
Scenario: Configurar webhook do WhatsApp
  Given tenho uma conta WhatsApp Business aprovada
  When configuro o webhook na Meta Cloud API
  Then o sistema deve receber mensagens inbound
  And o sistema deve validar a assinatura do webhook
  And o sistema deve responder com status 200

Scenario: Receber mensagem de texto
  Given o webhook está configurado
  When um paciente envia "Olá, quero agendar"
  Then o sistema deve receber o payload via POST
  And o sistema deve extrair telefone do remetente
  And o sistema deve extrair o conteúdo da mensagem
  And o sistema deve armazenar no banco de dados

Scenario: Enviar mensagem de texto
  Given tenho uma mensagem para enviar
  When chamo a API de envio
  Then o sistema deve enviar para o número correto
  And o sistema deve receber confirmação de entrega
  And o sistema deve registrar o status da mensagem
```

### Dependências

- Conta WhatsApp Business aprovada
- Meta Developer App configurada
- Token de acesso permanente

### Tarefas Técnicas

- [x] Configurar Meta Developer App
- [x] Implementar endpoint de webhook
- [x] Validar assinatura HMAC do webhook
- [x] Implementar cliente da API de envio (Evolution API)
- [x] Criar schema de mensagens no banco
- [x] Implementar retry com backoff exponencial
- [x] Escrever testes de integração

### Riscos

| Risco | Mitigação |
|-------|-----------|
| Webhook não verificado | Implementar verificação de desafio Meta |
| Rate limit excedido | Respeitar rate limits, usar fila |

---

## Story E-01-S02: Integração Instagram Graph API

### User Story

**Como** sistema Synkroo
**Quero** me conectar ao Instagram Graph API
**Para que** possa receber e enviar DMs dos pacientes

### Prioridade: P0 | Estimativa: 3 SP

### Critérios de Aceitação

```gherkin
Scenario: Receber DM do Instagram
  Given a conta Instagram está conectada
  When um usuário envia uma DM
  Then o sistema deve receber via webhook
  And o sistema deve extrair ID do usuário
  And o sistema deve extrair conteúdo da mensagem
  And o sistema deve armazenar no banco

Scenario: Responder DM dentro da janela 24h
  Given recebi uma DM há menos de 24h
  When preciso responder
  Then o sistema deve enviar a resposta
  And a mensagem deve ser entregue sem custo adicional

Scenario: Respeitar janela de 24h
  Given uma conversa está fora da janela de 24h
  When preciso enviar mensagem
  Then o sistema deve identificar que está fora da janela
  And o sistema deve usar template aprovado (se disponível)
```

### Dependências

- Conta Instagram Business conectada
- Permissões instagram_basic, instagram_manage_messages

### Tarefas Técnicas

- [x] Configurar Instagram Business Account
- [x] Implementar webhook de DMs
- [x] Implementar cliente da Graph API
- [x] Controlar janela de 24h
- [x] Mapear IDs do Instagram para usuários
- [x] Escrever testes de integração

---

## Story E-01-S03: Processamento de Mensagens com IA

### User Story

**Como** sistema Synkroo
**Quero** processar mensagens com o agente IA
**Para que** o paciente receba resposta automática inteligente

### Prioridade: P0 | Estimativa: 8 SP

### Critérios de Aceitação

```gherkin
Scenario: Processar mensagem e gerar resposta
  Given uma mensagem foi recebida
  When o sistema processa com o agente IA
  Then o sistema deve gerar uma resposta contextual
  And a resposta deve ser relevante para a intenção
  And a resposta deve ser enviada em <5 segundos

Scenario: Manter contexto de conversa
  Given um paciente está em conversa ativa
  When envia uma nova mensagem
  Then o sistema deve recuperar histórico recente
  And o sistema deve usar contexto para gerar resposta
  And o sistema deve atualizar o histórico

Scenario: Timeout de resposta
  Given o agente está processando
  When passa mais de 4 segundos
  Then o sistema deve enviar resposta de fallback
  And o sistema deve registrar o timeout
```

### Dependências

- Claude Agent SDK configurado
- Story E-01-S01 (WhatsApp) ou E-01-S02 (Instagram)

### Tarefas Técnicas

- [x] Integrar Claude Agent SDK (via OpenAI-compat)
- [x] Implementar pipeline de processamento (agent.service.ts)
- [x] Criar prompts de sistema
- [x] Implementar memória de curto prazo (conversation-context.ts)
- [x] Configurar timeout de resposta
- [x] Implementar fallback responses
- [x] Criar métricas de latência
- [x] Escrever testes unitários

---

## Story E-01-S04: Classificação de Intenção

### User Story

**Como** sistema Synkroo
**Quero** classificar a intenção das mensagens
**Para que** possa rotear para o tratamento adequado

### Prioridade: P0 | Estimativa: 3 SP

### Critérios de Aceitação

```gherkin
Scenario: Classificar intenção de agendamento
  Given um paciente envia "Quero marcar uma consulta"
  When o sistema classifica a intenção
  Then deve retornar "agendamento"
  And a confiança deve ser > 0.8

Scenario: Classificar intenção de dúvida
  Given um paciente envia "Qual o valor do clareamento?"
  When o sistema classifica a intenção
  Then deve retornar "duvida"
  And deve extrair entidade "procedimento: clareamento"

Scenario: Classificar intenção de emergência
  Given um paciente envia "Estou com muita dor de dente"
  When o sistema classifica a intenção
  Then deve retornar "emergencia"
  And deve priorizar escalação humana
```

### Dependências

- Story E-01-S03 (Processamento IA)

### Tarefas Técnicas

- [x] Definir taxonomia de intentos (6 tipos)
- [x] Criar prompts de classificação (MiniMax/M2.7)
- [x] Implementar extração de confiança
- [x] Validar accuracy com dataset de teste
- [x] Ajustar thresholds de confiança
- [x] Implementar logging de classificações (agent_logs)

### Tipos de Intenção

| Intenção | Descrição | Ação |
|----------|-----------|------|
| agendamento | Agendar/Reagendar/Cancelar | Fluxo de agendamento |
| duvida | Perguntas sobre serviços/procedimentos | Resposta IA |
| emergencia | Dor, urgência | Escalação humana |
| confirmacao | Confirmar presença | Atualizar status |
| reclamacao | Reclamações | Escalação humana |
| outros | Mensagens genéricas | Resposta IA |

---

## Story E-01-S05: Extração de Entidades

### User Story

**Como** sistema Synkroo
**Quero** extrair entidades das mensagens
**Para que** possa preencher automaticamente dados de agendamento

### Prioridade: P0 | Estimativa: 3 SP

### Critérios de Aceitação

```gherkin
Scenario: Extrair data e hora
  Given um paciente envia "Quero marcar para quinta às 10"
  When o sistema extrai entidades
  Then deve retornar data: "próxima quinta-feira"
  And deve retornar hora: "10:00"
  And deve normalizar para formato ISO

Scenario: Extrair nome e telefone
  Given um novo paciente envia mensagem
  When o sistema extrai entidades
  Then deve identificar nome se mencionado
  And deve validar telefone do remetente

Scenario: Extrair procedimento
  Given um paciente envia "Quero fazer um clareamento"
  When o sistema extrai entidades
  Then deve retornar procedimento: "clareamento"
  And deve mapear para procedimento cadastrado
```

### Dependências

- Story E-01-S03 (Processamento IA)

### Tarefas Técnicas

- [x] Definir schema de entidades
- [x] Criar prompts de extração
- [x] Implementar normalização de datas
- [x] Implementar resolução de datas relativas
- [x] Mapear procedimentos similares
- [x] Validar entidades extraídas
- [x] Escrever testes unitários

### Entidades Suportadas

| Entidade | Exemplos | Normalização |
|----------|----------|--------------|
| data | "quinta", "amanhã", "15/03" | ISO 8601 |
| hora | "10h", "14:30", "depois do almoço" | HH:MM |
| nome | "Meu nome é Maria" | String |
| telefone | Do remetente | E.164 |
| procedimento | "clareamento", "limpeza" | ID do procedimento |

---

## Story E-01-S06: Escalação para Humano

### User Story

**Como** paciente
**Quero** ser transferido para um atendente humano quando necessário
**Para que** minhas necessidades complexas sejam atendidas

### Prioridade: P0 | Estimativa: 3 SP

### Critérios de Aceitação

```gherkin
Scenario: Detectar necessidade de escalação
  Given a intenção é "reclamacao" ou "emergencia"
  When o sistema processa a mensagem
  Then deve marcar para escalação
  And deve transferir contexto da conversa
  And deve notificar o atendente responsável

Scenario: Paciente solicita humano explicitamente
  Given um paciente envia "Quero falar com alguém"
  When o sistema processa a mensagem
  Then deve transferir para atendente
  And deve informar tempo de espera estimado

Scenario: Falha múltipla do agente
  Given o agente falhou em responder adequadamente 3 vezes
  When detecta insatisfação do paciente
  Then deve oferecer escalação automática
```

### Dependências

- Story E-01-S04 (Classificação)
- Story E-01-S03 (Processamento IA)

### Tarefas Técnicas

- [x] Definir critérios de escalação
- [x] Implementar detecção de intenção de escalação
- [x] Criar sistema de notificação para atendentes
- [x] Transferir contexto de conversa
- [x] Implementar fila de escalação
- [x] Medir tempo de resposta humano
- [x] Criar dashboard de escalações

---

## Story E-01-S07: Histórico de Conversas

### User Story

**Como** atendente humano
**Quero** acessar o histórico completo de conversas
**Para que** eu possa entender o contexto ao assumir uma conversa

### Prioridade: P1 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Armazenar mensagem recebida
  Given uma mensagem é recebida
  When o sistema processa
  Then deve armazenar no banco
  And deve registrar canal, telefone, conteúdo, timestamp
  And deve associar ao paciente correto

Scenario: Recuperar histórico recente
  Given um paciente tem histórico de conversas
  When preciso do contexto
  Then devo poder recuperar as últimas 20 mensagens
  And as mensagens devem estar ordenadas por timestamp
  And deve mostrar canal de origem

Scenario: Buscar conversa por paciente
  Given quero ver conversas de um paciente
  When busco pelo nome ou telefone
  Then devo ver todas as conversas do paciente
  And devo poder filtrar por período
```

### Dependências

- Schema de mensagens no banco
- Story E-01-S01 ou E-01-S02

### Tarefas Técnicas

- [x] Criar tabela de mensagens
- [x] Implementar índices para busca
- [x] Criar API de histórico
- [x] Implementar paginação
- [x] Associar mensagens a pacientes
- [x] Implementar busca full-text (RAG)

---

## Story E-01-S08: Contexto de Conversa (Memória Curto Prazo)

### User Story

**Como** agente IA
**Quero** manter contexto da conversa atual
**Para que** possa responder de forma contextual e coerente

### Prioridade: P0 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Manter contexto de conversa ativa
  Given um paciente está conversando
  When envia múltiplas mensagens
  Then o sistema deve manter contexto entre mensagens
  And deve referenciar informações anteriores

Scenario: Limite de contexto
  Given uma conversa tem muitas mensagens
  When o contexto excede o limite
  Then deve manter as N mensagens mais recentes
  And deve manter informações críticas extraídas

Scenario: Timeout de sessão
  Given uma conversa está inativa
  When passam mais de 30 minutos sem mensagem
  Then deve finalizar a sessão de contexto
  And deve limpar memória de curto prazo
```

### Dependências

- Story E-01-S03 (Processamento IA)

### Tarefas Técnicas

- [x] Implementar sessão de conversa (conversation_sessions)
- [x] Definir tamanho máximo de contexto
- [x] Implementar sliding window
- [x] Extrair e manter informações críticas
- [x] Implementar timeout de sessão
- [x] Testar com conversas longas

---

## Story E-01-S09: Tratamento de Erros de Entrega

### User Story

**Como** sistema Synkroo
**Quero** detectar e tratar erros de entrega de mensagens
**Para que** eu possa garantir que as mensagens cheguem ao destinatário

### Prioridade: P1 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Detectar falha de entrega
  Given uma mensagem foi enviada
  When o webhook de status indica falha
  Then o sistema deve registrar o erro
  And deve tentar reenviar até 3 vezes
  And deve usar backoff exponencial

Scenario: Notificar falha persistente
  Given uma mensagem falhou 3 vezes
  When todas as tentativas esgotaram
  Then deve registrar como não entregue
  And deve notificar administrador
  And deve oferecer canal alternativo

Scenario: Validar número inválido
  Given um número de telefone é inválido
  When tento enviar mensagem
  Then deve detectar antes de enviar
  And deve marcar paciente com telefone inválido
```

### Dependências

- Story E-01-S01 (WhatsApp)

### Tarefas Técnicas

- [x] Implementar webhook de status
- [x] Criar sistema de retry (lib/retry.ts)
- [x] Implementar backoff exponencial
- [x] Registrar motivos de erro
- [x] Criar alertas de falha
- [x] Implementar validação de número

---

## Story E-01-S10: Rate Limiting e Throttling

### User Story

**Como** sistema Synkroo
**Quero** respeitar rate limits das APIs
**Para que** não seja bloqueado pelas plataformas

### Prioridade: P1 | Estimativa: 1 SP

### Critérios de Aceitação

```gherkin
Scenario: Respeitar rate limit do WhatsApp
  Given o WhatsApp tem rate limit de 80 mensagens/minuto
  When envio múltiplas mensagens
  Then deve respeitar o limite
  And deve enfileirar mensagens excedentes
  And deve processar quando houver capacidade

Scenario: Throttling por destinatário
  Given envio muitas mensagens para mesmo número
  When excedo limite por usuário
  Then deve aplicar throttling
  And deve espaçar mensagens adequadamente
```

### Dependências

- Story E-01-S01 (WhatsApp)
- Story E-01-S02 (Instagram)

### Tarefas Técnicas

- [x] Implementar token bucket algorithm
- [x] Configurar limites por API
- [x] Criar fila de mensagens
- [x] Implementar worker de envio
- [x] Monitorar uso de quota

---

## Story E-01-S11: Templates de Mensagens Aprovados

### User Story

**Como** sistema Synkroo
**Quero** usar templates aprovados pela Meta
**Para que** possa enviar mensagens fora da janela de 24h

### Prioridade: P2 | Estimativa: 1 SP

### Critérios de Aceitação

```gherkin
Scenario: Usar template aprovado
  Given preciso enviar mensagem fora da janela 24h
  When tenho um template aprovado
  Then posso enviar usando o template
  And a mensagem deve seguir o formato aprovado

Scenario: Template não aprovado
  Given preciso enviar mensagem fora da janela 24h
  When não tenho template aprovado
  Then não devo enviar a mensagem
  And devo registrar para envio posterior
```

### Dependências

- Story E-01-S01 (WhatsApp)
- Templates aprovados no Meta Business Manager

### Tarefas Técnicas

- [x] Criar templates no Meta Business Manager
- [x] Implementar envio com template
- [x] Validar placeholders
- [x] Monitorar status de aprovação

---

## Story E-01-S12: Métricas de Atendimento

### User Story

**Como** gestor da clínica
**Quero** ver métricas de atendimento multicanal
**Para que** eu possa avaliar a performance do sistema

### Prioridade: P1 | Estimativa: 1 SP

### Critérios de Aceitação

```gherkin
Scenario: Visualizar volume de mensagens
  Given estou no dashboard
  When acesso métricas de atendimento
  Then devo ver volume de mensagens por canal
  And devo ver distribuição por intenção
  And devo ver tempo médio de resposta

Scenario: Métricas por período
  Given quero analisar um período
  When seleciono data início e fim
  Then devo ver métricas do período
  And devo ver comparação com período anterior
```

### Dependências

- Story E-01-S07 (Histórico)

### Tarefas Técnicas

- [x] Criar queries de agregação
- [x] Implementar API de métricas
- [x] Calcular KPIs
- [x] Criar visualizações no dashboard

---

## Resumo das Stories

| Story | Nome | Prioridade | SP | Sprint |
|-------|------|------------|-----|--------|
| E-01-S01 | Integração WhatsApp Business API | P0 | 5 | 1 |
| E-01-S02 | Integração Instagram Graph API | P0 | 3 | 1 |
| E-01-S03 | Processamento de Mensagens com IA | P0 | 8 | 1 |
| E-01-S04 | Classificação de Intenção | P0 | 3 | 1 |
| E-01-S05 | Extração de Entidades | P0 | 3 | 1-2 |
| E-01-S06 | Escalação para Humano | P0 | 3 | 2 |
| E-01-S07 | Histórico de Conversas | P1 | 2 | 2 |
| E-01-S08 | Contexto de Conversa | P0 | 2 | 2 |
| E-01-S09 | Tratamento de Erros | P1 | 2 | 2 |
| E-01-S10 | Rate Limiting | P1 | 1 | 2 |
| E-01-S11 | Templates Aprovados | P2 | 1 | 2 |
| E-01-S12 | Métricas de Atendimento | P1 | 1 | 2 |
| **Total** | | | **34** | **2 Sprints** |

### Sprint 1 (18 SP)

- E-01-S01: Integração WhatsApp (5 SP)
- E-01-S02: Integração Instagram (3 SP)
- E-01-S03: Processamento IA (8 SP)
- E-01-S04: Classificação de Intenção (3 SP)
- E-01-S05: Extração de Entidades (início, 3 SP)

### Sprint 2 (16 SP)

- E-01-S05: Extração de Entidades (conclusão)
- E-01-S06: Escalação Humano (3 SP)
- E-01-S07: Histórico (2 SP)
- E-01-S08: Contexto (2 SP)
- E-01-S09: Erros (2 SP)
- E-01-S10: Rate Limiting (1 SP)
- E-01-S11: Templates (1 SP)
- E-01-S12: Métricas (1 SP)

---

## Definition of Ready (DoR)

Antes de iniciar qualquer Story do E-01:

- [ ] PRD e Architecture aprovados
- [ ] Ambiente de desenvolvimento configurado
- [ ] Conta WhatsApp Business aprovada (para S01, S03+)
- [ ] Conta Instagram Business conectada (para S02)
- [ ] Claude Agent SDK configurado (para S03+)
- [ ] Schema de mensagens criado no banco

## Definition of Done (DoD)

Para considerar uma Story completa:

- [ ] Código implementado e revisado
- [ ] Testes unitários com cobertura > 80%
- [ ] Testes de integração passando
- [ ] Documentação da API atualizada
- [ ] Sem bugs conhecidos
- [ ] Deploy em ambiente de staging
- [ ] Code review aprovado

## NFR Traceability

| Story | NFRs Relacionados |
|-------|-------------------|
| E-01-S01 | NFR-01 (Latência < 5s), NFR-05 (Disponibilidade 99.5%) |
| E-01-S02 | NFR-01, NFR-05 |
| E-01-S03 | NFR-01, NFR-02 (Contexto < 10 msgs), NFR-03 (Fallback) |
| E-01-S04 | NFR-04 (Accuracy > 85%) |
| E-01-S05 | NFR-04, NFR-06 (Normalização) |
| E-01-S06 | NFR-07 (Escalation < 5min) |
| E-01-S07 | NFR-08 (Histórico 2 anos) |
| E-01-S08 | NFR-02 |
| E-01-S09 | NFR-05, NFR-09 (Retry policy) |
| E-01-S10 | NFR-10 (Rate limiting) |
| E-01-S11 | NFR-11 (Templates Meta) |
| E-01-S12 | NFR-12 (Métricas) |

---

**Documento criado por:** BMAD Method v6.2.2
**Data:** 2026-03-27
**Status:** ✅ IMPLEMENTADO - Atualizado em 2026-04-07