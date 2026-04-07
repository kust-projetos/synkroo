# Stories - Epic E-04: CRM Inteligente

---
epic: E-04
epic_name: CRM Inteligente
created_date: 2026-03-27
methodology: BMAD v6.2.2
total_stories: 7
total_story_points: 13
sprint: 2-3
---

## Visão do Epic

**Como** clínica odontológica
**Quero** um CRM centralizado com dados de pacientes
**Para que** eu possa conhecer meus pacientes e personalizar o atendimento

---

## Story E-04-S01: Cadastro de Pacientes

### User Story

**Como** atendente da clínica
**Quero** cadastrar pacientes com informações completas
**Para que** eu tenha um registro organizado de todos os pacientes

### Prioridade: P0 | Estimativa: 3 SP

### Critérios de Aceitação

```gherkin
Scenario: Criar novo paciente manualmente
  Given estou na tela de cadastro
  When preencho nome, telefone, email, CPF
  Then o paciente deve ser criado no sistema
  And deve gerar ID único
  And deve registrar data de cadastro

Scenario: Validar campos obrigatórios
  Given estou criando um paciente
  When não preencho nome ou telefone
  Then devo ver mensagem de erro
  And não devo permitir salvar

Scenario: Validar CPF único
  Given já existe um paciente com CPF "123.456.789-00"
  When tento cadastrar outro com mesmo CPF
  Then devo ver mensagem de CPF já cadastrado
  And devo sugerir editar o existente

Scenario: Validar telefone único
  Given já existe um paciente com telefone "(11) 99999-9999"
  When tento cadastrar outro com mesmo telefone
  Then devo ver mensagem de telefone já cadastrado
```

### Dependências

- Schema de pacientes no banco
- RLS configurado para multi-tenant

### Tarefas Técnicas

- [x] Criar tabela patients
- [x] Implementar API de CRUD
- [x] Validar CPF (dígitos verificadores)
- [x] Validar telefone (formato brasileiro)
- [x] Implementar busca de duplicatas
- [x] Criar índices únicos
- [x] Implementar RLS por clínica

### Campos do Cadastro

| Campo | Tipo | Obrigatório | Único |
|-------|------|-------------|-------|
| id | UUID | Auto | Sim |
| nome | String | Sim | Não |
| telefone | String | Sim | Sim |
| email | String | Não | Não |
| cpf | String | Não | Sim |
| data_nascimento | Date | Não | Não |
| endereco | JSONB | Não | Não |
| observacoes | Text | Não | Não |
| clinic_id | UUID | Sim | Não |

---

## Story E-04-S02: Cadastro via Conversa

### User Story

**Como** paciente
**Quero** me cadastrar através de uma conversa natural
**Para que** eu não precise preencher formulários

### Prioridade: P0 | Estimativa: 5 SP

### Critérios de Aceitação

```gherkin
Scenario: Detectar novo paciente
  Given uma mensagem é recebida de telefone desconhecido
  When o sistema processa
  Then deve identificar que é um novo paciente
  And deve iniciar fluxo de cadastro
  And deve solicitar nome

Scenario: Extrair nome da conversa
  Given o sistema perguntou o nome
  When o paciente responde "Meu nome é Maria Silva"
  Then deve extrair "Maria Silva"
  And deve confirmar com o paciente

Scenario: Solicitar informações gradualmente
  Given o paciente está sendo cadastrado
  When o sistema precisa de mais informações
  Then deve solicitar uma informação por vez
  And deve ser conversacional e amigável

Scenario: Cadastro mínimo para agendamento
  Given o paciente quer agendar rapidamente
  When fornece apenas nome e telefone
  Then deve permitir cadastro mínimo
  And deve marcar como "cadastro incompleto"
  And deve solicitar informações depois

Scenario: Confirmar dados extraídos
  Given o sistema extraiu dados da conversa
  When os dados são suficientes
  Then deve apresentar resumo para confirmação
  And deve permitir correções
```

### Dependências

- Story E-01-S05 (Extração de Entidades)
- Story E-04-S01 (Cadastro manual)

### Tarefas Técnicas

- [x] Integrar com pipeline de extração
- [x] Criar fluxo de cadastro conversacional
- [x] Implementar confirmação de dados
- [x] Validar dados extraídos
- [x] Criar estado de "cadastro incompleto"
- [x] Permitir edição posterior
- [x] Testar com diferentes padrões de resposta

### Fluxo Conversacional

```
Paciente: Olá, quero marcar uma consulta
Sistema: Olá! Bem-vindo à Clínica Sorriso. Para agendar, preciso do seu nome.
Paciente: Maria Silva
Sistema: Obrigado, Maria! Seu telefone é (11) 99999-9999?
Paciente: Sim, esse mesmo
Sistema: Perfeito! Já cadastrei você. Qual procedimento deseja agendar?
```

---

## Story E-04-S03: Histórico de Atendimentos

### User Story

**Como** dentista
**Quero** ver o histórico de atendimentos do paciente
**Para que** eu possa acompanhar sua evolução

### Prioridade: P0 | Estimativa: 2 SP

### Critérios de Aceitação

```gherkin
Scenario: Visualizar histórico no perfil
  Given estou na página do paciente
  When acesso a aba "Histórico"
  Then devo ver todos os atendimentos anteriores
  And devo ver data, procedimento, profissional
  And devo ver status de cada atendimento

Scenario: Filtrar por período
  Given estou vendo o histórico
  When seleciono um período
  Then devo ver apenas atendimentos do período
  And devo ver total de atendimentos no período

Scenario: Ver detalhes do atendimento
  Given estou no histórico
  When clico em um atendimento
  Then devo ver detalhes completos
  And devo ver observações registradas
  And devo ver valor cobrado
```

### Dependências

- Story E-02 (Agendamentos) - para dados de atendimentos
- Story E-04-S01 (Cadastro)

### Tarefas Técnicas

- [x] Criar relação paciente-agendamentos
- [x] Implementar query de histórico
- [x] Criar API de histórico
- [x] Implementar filtros
- [x] Criar visualização de timeline

---

## Story E-04-S04: Preferências e Observações

### User Story

**Como** dentista
**Quero** registrar preferências e observações sobre o paciente
**Para que** eu possa personalizar o atendimento

### Prioridade: P1 | Estimativa: 1 SP

### Critérios de Aceitação

```gherkin
Scenario: Adicionar observação
  Given estou no perfil do paciente
  When adiciono uma observação
  Then deve ser salva com data e autor
  And deve aparecer no histórico

Scenario: Registrar preferência
  Given quero registrar preferência do paciente
  When marco "Prefere atendimento pela manhã"
  Then deve ser salva
  And deve influenciar sugestões de horário

Scenario: Observações privadas
  Given adiciono uma observação
  When marco como "privada"
  Then não deve ser visível para o paciente
  And deve ser visível apenas para a equipe
```

### Dependências

- Story E-04-S01 (Cadastro)

### Tarefas Técnicas

- [x] Criar tabela de observações
- [x] Implementar campo de preferências
- [x] Adicionar controle de visibilidade
- [x] Registrar autor e timestamp

---

## Story E-04-S05: Tags Manuais

### User Story

**Como** atendente
**Quero** adicionar tags aos pacientes
**Para que** eu possa categorizar e segmentar

### Prioridade: P1 | Estimativa: 1 SP

### Critérios de Aceitação

```gherkin
Scenario: Adicionar tag ao paciente
  Given estou no perfil do paciente
  When adiciono tag "VIP"
  Then a tag deve aparecer no perfil
  And deve estar disponível para filtros

Scenario: Criar nova tag
  Given quero adicionar uma tag que não existe
  When digito "Inadimplente"
  Then deve criar a nova tag
  E deve associar ao paciente

Scenario: Remover tag
  Given o paciente tem a tag "Novo"
  When removo a tag
  Then não deve mais aparecer no perfil
```

### Dependências

- Story E-04-S01 (Cadastro)

### Tarefas Técnicas

- [x] Criar tabela de tags
- [x] Criar relação paciente-tags (N:N)
- [x] Implementar API de tags
- [x] Implementar busca por tags
- [x] Sugerir tags existentes

### Tags Sugeridas

| Tag | Critério de Sugestão |
|-----|---------------------|
| Novo | Primeiro agendamento |
| VIP | Alto LTV (manual) |
| Inadimplente | Pagamento pendente (manual) |
| Retorno | Já voltou ao menos 1x |

---

## Story E-04-S06: Segmentação para Campanhas

### User Story

**Como** gestor da clínica
**Quero** segmentar pacientes para campanhas
**Para que** eu possa enviar mensagens direcionadas

### Prioridade: P1 | Estimativa: 1 SP

### Critérios de Aceitação

```gherkin
Scenario: Criar segmento por critérios
  Given quero criar uma campanha
  When defino critérios "pacientes inativos há 60 dias"
  Then devo ver quantos pacientes atendem
  And devo poder preview da lista

Scenario: Combinar critérios
  Given quero refinar o segmento
  When adiciono "que fizeram clareamento"
  Then deve filtrar pela interseção
  And devo ver contagem atualizada

Scenario: Salvar segmento
  Given criei um segmento útil
  When salvo com nome "Leads Clareamento"
  Then devo poder reutilizar depois
```

### Dependências

- Story E-04-S01 (Cadastro)
- Story E-04-S05 (Tags)

### Tarefas Técnicas

- [x] Criar query builder visual
- [x] Implementar filtros combinados
- [x] Criar API de segmentação
- [x] Salvar segmentos
- [x] Calcular contagem em tempo real

### Critérios de Segmentação

| Critério | Tipo |
|----------|------|
| Data último atendimento | Data |
| Procedimento realizado | Lista |
| Tags | Multi-select |
| Faixa etária | Range |
| Valor total gasto | Range |

---

## Story E-04-S07: Deduplicação de Pacientes

### User Story

**Como** sistema
**Quero** detectar e mesclar pacientes duplicados
**Para que** eu não tenha registros incorretos

### Prioridade: P1 | Estimativa: 0 SP (incluído no S01)

### Critérios de Aceitação

```gherkin
Scenario: Detectar duplicata por telefone
  Given existe paciente com telefone "11999999999"
  When tento cadastrar outro com mesmo telefone
  Then devo ver mensagem de duplicata
  And devo sugerir edição do existente

Scenario: Detectar duplicata por CPF
  Given existe paciente com CPF "123.456.789-00"
  When tento cadastrar outro com mesmo CPF
  Then devo ver mensagem de duplicata

Scenario: Mesclar pacientes
  Given há dois registros do mesmo paciente
  When uso a função de mesclar
  Then deve manter dados mais completos
  And deve combinar histórico
  And deve registrar a mesclagem
```

### Dependências

- Story E-04-S01 (Cadastro)

### Tarefas Técnicas

- [x] Implementar busca de duplicatas
- [x] Criar função de mesclagem
- [x] Registrar audit de mesclagem
- [x] Atualizar referências de agendamentos

---

## Resumo das Stories

| Story | Nome | Prioridade | SP | Sprint |
|-------|------|------------|-----|--------|
| E-04-S01 | Cadastro de Pacientes | P0 | 3 | 2 |
| E-04-S02 | Cadastro via Conversa | P0 | 5 | 2-3 |
| E-04-S03 | Histórico de Atendimentos | P0 | 2 | 3 |
| E-04-S04 | Preferências e Observações | P1 | 1 | 3 |
| E-04-S05 | Tags Manuais | P1 | 1 | 3 |
| E-04-S06 | Segmentação para Campanhas | P1 | 1 | 3 |
| E-04-S07 | Deduplicação de Pacientes | P1 | 1 | 2 |
| **Total** | | | **14** | **2 Sprints** |

### Sprint 2 (8 SP)

- E-04-S01: Cadastro de Pacientes (3 SP)
- E-04-S07: Deduplicação (1 SP)
- E-04-S02: Cadastro via Conversa (início, 4 SP)

### Sprint 3 (6 SP)

- E-04-S02: Cadastro via Conversa (conclusão, 1 SP)
- E-04-S03: Histórico (2 SP)
- E-04-S04: Preferências (1 SP)
- E-04-S05: Tags (1 SP)
- E-04-S06: Segmentação (1 SP)

---

## Definition of Ready (DoR)

Antes de iniciar qualquer Story do E-04:

- [x] PRD e Architecture aprovados
- [x] Schema de pacientes criado
- [x] RLS configurado para multi-tenant
- [x] E-01-S05 (Extração de Entidades) para S02

## Definition of Done (DoD)

Para considerar uma Story completa:

- [x] Código implementado e revisado
- [x] Testes unitários com cobertura > 80%
- [x] Validações de CPF/telefone funcionando
- [x] RLS testado por clínica
- [x] Documentação da API atualizada
- [x] Deploy em staging

## NFR Traceability

| Story | NFRs Relacionados |
|-------|-------------------|
| E-04-S01 | NFR-29 (Cadastro completo), NFR-30 (Validações) |
| E-04-S02 | NFR-31 (Cadastro conversacional), NFR-32 (Cadastro mínimo) |
| E-04-S03 | NFR-33 (Histórico de atendimentos) |
| E-04-S04 | NFR-34 (Preferências), NFR-35 (Observações privadas) |
| E-04-S05 | NFR-36 (Tags manuais) |
| E-04-S06 | NFR-37 (Segmentação) |
| E-04-S07 | NFR-38 (Deduplicação), NFR-39 (Mesclagem) |

---

**Documento criado por:** BMAD Method v6.2.2
**Data:** 2026-03-27
**Status:** ✅ IMPLEMENTADO - Atualizado em 2026-04-07