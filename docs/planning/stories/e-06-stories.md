# Stories - Epic E-06: Marketing e Redes Sociais

---
epic: E-06
epic_name: Marketing e Redes Sociais
created_date: 2026-03-27
methodology: BMAD v6.2.2
total_stories: 6
total_story_points: 13
sprint: 7-8
status: Pós-MVP
---

## Visão do Epic

**Como** clínica odontológica
**Quero** ferramentas de marketing automatizado
**Para que** eu possa atrair novos pacientes sem dedicar tempo manual

---

## Story E-06-S01: Gerador de Conteúdo com IA

### User Story

**Como** gestor da clínica
**Quero** gerar conteúdo para Instagram automaticamente com IA
**Para que** eu possa manter presença nas redes sociais sem esforço manual

### Prioridade: P2 | Estimativa: 3 SP

### Critérios de Aceitação

```gherkin
Scenario: Gerar post para Instagram
  Given o usuário solicita conteúdo sobre "clareamento dental"
  When o sistema gera o conteúdo
  Then deve retornar sugestão de imagem (prompt ou placeholder)
  And deve retornar legenda otimizada para Instagram
  And deve incluir hashtags relevantes
  And deve manter tom de voz da clínica

Scenario: Personalizar tom de voz
  Given a clínica tem um perfil definido (formal/descontraído)
  When o sistema gera conteúdo
  Then o conteúdo deve refletir o tom de voz configurado
  And deve ser apropriado para odontologia

Scenario: Agendar postagem
  Given um conteúdo foi gerado e aprovado
  When o usuário define data/hora
  Then o sistema deve agendar a postagem
  And deve enviar confirmação de agendamento
```

### Dependências

- E-01 com Instagram DM funcionando
- Perfil Business do Instagram conectado
- Política de conteúdo definida

### Tarefas Técnicas

- [ ] Criar serviço de geração de conteúdo com Claude
- [ ] Implementar templates de prompts por categoria
- [ ] Criar banco de hashtags por procedimento
- [ ] Implementar configuração de tom de voz
- [ ] Criar interface de preview e edição
- [ ] Implementar sistema de aprovação
- [ ] Escrever testes unitários

---

## Story E-06-S02: Automação de Postagens Instagram

### User Story

**Como** gestor da clínica
**Quero** que minhas postagens sejam publicadas automaticamente
**Para que** eu não precise lembrar de postar manualmente

### Prioridade: P2 | Estimativa: 3 SP

### Critérios de Aceitação

```gherkin
Scenario: Publicar postagem agendada
  Given uma postagem está agendada para 10:00
  When chega o horário
  Then o sistema deve publicar automaticamente
  And deve registrar confirmação de publicação
  And deve atualizar status no calendário de conteúdo

Scenario: Falha na publicação
  Given uma tentativa de publicação falhou
  When o sistema detecta o erro
  Then deve tentar novamente (até 3x)
  And deve notificar o usuário se persistir
  And deve registrar o erro nos logs

Scenario: Calendário de conteúdo
  Given o usuário quer ver posts agendados
  When acessa o calendário
  Then deve visualizar todos os posts por data
  And deve poder editar ou cancelar
  And deve visualizar status de cada post
```

### Dependências

- Story E-06-S01 (Gerador de Conteúdo)
- Instagram Graph API (publish permission)
- Sistema de jobs agendados

### Tarefas Técnicas

- [ ] Integrar Instagram Content Publishing API
- [ ] Implementar sistema de agendamento (cron/queue)
- [ ] Criar modelo de calendário de conteúdo
- [ ] Implementar retry logic
- [ ] Criar interface de calendário
- [ ] Implementar notificações de status
- [ ] Escrever testes de integração

---

## Story E-06-S03: Resposta Automática a Comentários

### User Story

**Como** gestor da clínica
**Quero** que comentários no Instagram sejam respondidos automaticamente
**Para que** eu mantenha engajamento sem monitoramento constante

### Prioridade: P2 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Responder comentário positivo
  Given um usuário comenta "Adorei o atendimento!"
  When o sistema detecta o comentário
  Then deve classificar como "positivo"
  And deve gerar resposta de agradecimento
  And deve publicar a resposta automaticamente

Scenario: Escalar comentário negativo
  Given um usuário comenta com reclamação
  When o sistema detecta o comentário
  Then deve classificar como "negativo"
  And deve notificar o responsável
  And NÃO deve responder automaticamente

Scenario: Resposta a perguntas comuns
  Given um comentário pergunta sobre valores
  When o sistema detecta a pergunta
  Then deve identificar a intenção
  And deve sugerir resposta personalizada
  And deve direcionar para DM se necessário
```

### Dependências

- E-01 com Instagram funcionando
- Story E-06-S02 (Postagens)

### Tarefas Técnicas

- [ ] Implementar webhook de comentários
- [ ] Criar classificador de sentimento
- [ ] Implementar gerador de respostas
- [ ] Criar regras de escalação
- [ ] Implementar fila de moderação
- [ ] Escrever testes unitários

---

## Story E-06-S04: Campanhas de Captação

### User Story

**Como** gestor da clínica
**Quero** criar campanhas de captação automáticas
**Para que** eu possa atrair novos pacientes para procedimentos específicos

### Prioridade: P2 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Criar campanha de captação
  Given o usuário quer criar campanha para "clareamento"
  When configura a campanha
  Then deve definir público-alvo
  And deve definir período de duração
  And deve definir mensagem de captação
  And deve ativar a campanha

Scenario: Campanha com follow-up
  Given uma campanha está ativa
  When um lead interage
  Then o sistema deve registrar o lead
  And deve iniciar sequência de follow-up
  And deve atribuir ao pipeline de vendas

Scenario: Métricas de campanha
  Given uma campanha está ativa
  When o usuário acessa o dashboard
  Then deve visualizar leads gerados
  And deve visualizar taxa de conversão
  And deve visualizar ROI da campanha
```

### Dependências

- E-04 (CRM) funcionando
- E-05 (Vendas) funcionando

### Tarefas Técnicas

- [ ] Criar modelo de campanhas
- [ ] Implementar segmentação de público
- [ ] Criar templates de mensagens
- [ ] Implementar tracking de leads
- [ ] Criar dashboard de métricas
- [ ] Integrar com E-05 (pipeline)
- [ ] Escrever testes

---

## Story E-06-S05: Integração Meta Ads Básica

### User Story

**Como** gestor da clínica
**Quero** conectar minha conta Meta Ads
**Para que** eu possa rastrear performance de anúncios

### Prioridade: P3 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Conectar conta Meta Ads
  Given o usuário tem uma conta Meta Ads ativa
  When autoriza a conexão
  Then o sistema deve obter token de acesso
  And deve listar campanhas ativas
  And deve exibir métricas básicas

Scenario: Sincronizar métricas
  Given a conta está conectada
  When o sistema sincroniza dados
  Then deve importar métricas de desempenho
  And deve calcular custo por lead
  And deve atualizar diariamente

Scenario: Atribuir leads a anúncios
  Given um lead veio de anúncio
  When o lead é criado no sistema
  Then deve atribuir à campanha correta
  And deve calcular ROAS
  And deve exibir no dashboard
```

### Dependências

- Meta Ads API access
- Story E-06-S04 (Campanhas)

### Tarefas Técnicas

- [ ] Implementar OAuth com Meta Ads
- [ ] Criar cliente da Marketing API
- [ ] Implementar sincronização de métricas
- [ ] Criar modelo de atribuição
- [ ] Integrar com dashboard
- [ ] Escrever testes de integração

---

## Story E-06-S06: Analytics de Redes Sociais

### User Story

**Como** gestor da clínica
**Quero** visualizar métricas consolidadas de redes sociais
**Para que** eu possa avaliar o desempenho do marketing

### Prioridade: P2 | Estimativa: 1 SP

### Critérios de Aceitação

```gherkin
Scenario: Dashboard de redes sociais
  Given o usuário acessa o dashboard
  When a página carrega
  Then deve visualizar seguidores por rede
  And deve visualizar engajamento médio
  And deve visualizar posts com melhor performance
  And deve visualizar crescimento mensal

Scenario: Relatório de desempenho
  Given o usuário solicita relatório
  When define o período
  Then deve gerar PDF com métricas
  And deve incluir gráficos de tendência
  And deve incluir recomendações de melhoria
```

### Dependências

- Stories E-06-S01 a E-06-S05

### Tarefas Técnicas

- [ ] Criar agregador de métricas
- [ ] Implementar gráficos de desempenho
- [ ] Criar exportação de relatórios
- [ ] Implementar comparação de períodos
- [ ] Escrever testes

---

## Resumo do Epic

| Story | Nome | SP | Prioridade | Dependências |
|-------|------|----|-----------:|--------------|
| E-06-S01 | Gerador de Conteúdo com IA | 3 | P2 | Instagram API |
| E-06-S02 | Automação de Postagens | 3 | P2 | E-06-S01 |
| E-06-S03 | Resposta a Comentários | 2 | P2 | E-06-S02 |
| E-06-S04 | Campanhas de Captação | 2 | P2 | E-04, E-05 |
| E-06-S05 | Integração Meta Ads | 2 | P3 | E-06-S04 |
| E-06-S06 | Analytics de Redes Sociais | 1 | P2 | Todas anteriores |
| **Total** | | **13** | | |

---

**Documento criado por:** BMAD Method v6.2.2
**Data:** 2026-03-27
**Status:** ❌ Out of MVP Scope - Atualizado em 2026-04-07