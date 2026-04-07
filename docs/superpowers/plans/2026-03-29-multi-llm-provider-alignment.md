# Multi-LLM Provider Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alinhar 4 documentos de arquitetura para refletir a decisao multi-LLM provider (factory pattern com Claude/MiniMax/OpenAI).

**Architecture:** Atualizacao documental apenas. Reescrever ADR-002 para multi-provider strategy, atualizar README de ADRs, secao 2.3 de architecture.md e architecture-v1.1.md, e ADR-003 inline de architecture.md.

**Tech Stack:** Markdown, documentacao BMAD

**Spec:** `docs/superpowers/specs/2026-03-29-multi-llm-provider-alignment-design.md`

---

## File Structure

| Acao | Arquivo | Responsabilidade |
|------|---------|------------------|
| **REWRITE** | `docs/architecture/adrs/adr-002-claude-agent-sdk.md` | ADR-002 reescrito para multi-provider |
| **MODIFY** | `docs/architecture/adrs/README.md:21` | Indice ADR-002 atualizado |
| **MODIFY** | `docs/architecture.md:142-148,58,93-95,974-988` | Secao 2.3 + diagrama + ADR-003 inline |
| **MODIFY** | `docs/architecture-v1.1.md:150-157,57-58,102-105,13` | Secao 2.3 + diagrama + version bump |

---

### Task 1: Reescrever ADR-002 para Multi-LLM Provider Strategy

**Files:**
- Rewrite: `docs/architecture/adrs/adr-002-claude-agent-sdk.md`

- [ ] **Step 1: Escrever novo conteudo do ADR-002**

Substituir TODO o conteudo do arquivo `docs/architecture/adrs/adr-002-claude-agent-sdk.md` por:

```markdown
# ADR-002: Multi-LLM Provider Strategy

**Supersedes:** ADR-002 v1 (Claude Agent SDK)
**Status:** Accepted (Updated v2)
**Data:** 2026-03-27 (updated 2026-03-29)
**Decisores:** Winston (Arquiteto), Walis (Product Owner)

---

## Contexto

O Synkroo precisa de capacidade de IA para:
1. **Classificar intencoes** de mensagens (agendamento, duvida, reclamacao)
2. **Rotear para agentes especializados** (Scheduler, Sales, Generalist)
3. **Executar tool calling** estruturado (calendario, banco de dados)
4. **Manter contexto** de conversas
5. **Escalar horizontalmente** conforme volume de mensagens

### Requisitos

| Requisito | Descricao |
|-----------|-----------|
| Latencia | Tempo de resposta < 5s (P90) |
| Custo | Otimizar uso de tokens |
| Extensibilidade | Facilmente adicionar novos providers |
| Flexibilidade | Trocar provider via configuracao |

### Motivacao para Multi-Provider

O prototipo local usa MiniMax M2.7 para testes (sem custo). A producao usara Claude Sonnet 4 (qualidade superior). A arquitetura deve ser provider-agnostic para:
- Desenvolver localmente sem custo de API
- Trocar provider sem mudanca de codigo
- Adicionar novos providers conforme necessario

---

## Decisao

Adotar **Provider-Agnostic LLM Layer** com factory pattern.

### 1. Interface LLMProvider

```typescript
// Localizacao: src/lib/llm/provider.ts
export interface LLMProvider {
  classifyIntent(message: string): Promise<{ intent: string; confidence: number }>
  extractEntities(message: string): Promise<Record<string, string>>
  generateResponse(prompt: string, context: ConversationContext): Promise<string>
  shouldEscalate(message: string, intent: string): Promise<boolean>
}
```

### 2. Factory Pattern

```typescript
// Localizacao: src/lib/llm/factory.ts
export function getLLMProvider(): LLMProvider {
  const provider = process.env.LLM_PROVIDER || 'minimax'
  switch (provider) {
    case 'claude': return new ClaudeProvider()
    case 'minimax': return new MiniMaxProvider()
    case 'openai': return new OpenAIProvider()
    default: throw new Error(`Unknown LLM provider: ${provider}`)
  }
}
```

### 3. Extensibilidade via Sub-Interfaces

```typescript
// Recursos especificos por provider via type guards
interface ClaudeExtended extends LLMProvider {
  toolCall(prompt: string, tools: Tool[]): Promise<ToolResult>
}

// Consumer verifica disponibilidade
if ('toolCall' in provider) {
  const result = await (provider as ClaudeExtended).toolCall(prompt, tools)
}
```

### 4. Providers Suportados

| Provider | Use Case | Modelo | Status |
|----------|----------|--------|--------|
| **Claude** | Producao (target) | Sonnet 4 | Planejado |
| **MiniMax** | Desenvolvimento local | M2.7 | Implementado (prototipo) |
| **OpenAI** | Opcao futura | GPT-4o | Planejado |

---

## Arquitetura Multi-Agent (Mantida)

```
ORCHESTRATOR AGENT
+-- Router (sempre ativo, classifica intencao)
+-- Scheduler Agent (lazy, agendamentos)
+-- Sales Agent (lazy, vendas)
+-- Generalist Agent (lazy, fallback)

Cada agente usa LLMProvider via factory.
MCP Servers continuam conforme planejado.
```

---

## Configuracao via Environment

```bash
# Provider selection
LLM_PROVIDER=claude|minimax|openai

# Provider-specific keys
CLAUDE_API_KEY=...
MINIMAX_API_KEY=...
OPENAI_API_KEY=...

# Embeddings (servico separado, independente do LLM provider)
EMBEDDING_API_KEY=...
EMBEDDING_MODEL=text-embedding-3-small
```

**Nota sobre Embeddings:** O servico de embeddings e dedicado e configurado via `EMBEDDING_*` env vars, independente do provider de chat. Isso evita conflito quando o provider de chat (ex: MiniMax) nao suporta embeddings de qualidade.

---

## Alternativas Consideradas

### Alternativa 1: Claude-only (v1 deste ADR)
- **Pros:** Simples, SDK nativo
- **Contras:** Vendor lock-in, sem opcao local gratuita
- **Veredito:** Atualizado para multi-provider

### Alternativa 2: LangChain com multi-provider
- **Pros:** Ecossistema grande, abstracao pronta
- **Contras:** Complexidade extra, curva de aprendizado
- **Veredito:** Rejeitada - factory propria e mais leve

### Alternativa 3: Multi-LLM Provider com Factory (Decisao Atual)
- **Pros:** Troca via env var, teste local gratis, codigo agnostico
- **Contras:** Abstracao extra, recursos avancados nem sempre disponiveis
- **Veredito:** Aceita - interface comum + extensoes por sub-interface

---

## Consequencias

### Positivas
- Troca de provider sem mudanca de codigo
- Testes locais com MiniMax (gratis)
- Producao com Claude (qualidade superior)
- Extensibilidade para novos providers

### Negativas
- Abstracao extra no codigo
- Recursos avancados podem nao estar disponiveis em todos providers
- Configuracao adicional (env vars por provider)

### Mitigacoes
- Interface minimal comum + extensoes via sub-interfaces com type guards
- Documentacao clara de qual provider suporta qual feature
- Testes de integracao por provider

---

## Referencias

- [Claude API Documentation](https://docs.anthropic.com/)
- [MiniMax API Documentation](https://www.minimaxi.com/)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Multi-Agent Systems Best Practices](https://www.anthropic.com/research/building-effective-agents)

---

**Relacionado com:**
- Epic E-01: Atendimento Multicanal
- Epic E-06: Inteligencia (Stories de memoria)
- ADR-001: Event-Driven Architecture
```

- [ ] **Step 2: Verificar que o arquivo foi salvo corretamente**

Run: `head -3 docs/architecture/adrs/adr-002-claude-agent-sdk.md`
Expected: primeira linha contem "Multi-LLM Provider Strategy"

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/adrs/adr-002-claude-agent-sdk.md
git commit -m "docs: rewrite ADR-002 for multi-LLM provider strategy

- Factory pattern with LLMProvider interface
- Claude (production), MiniMax (dev), OpenAI (future)
- Sub-interfaces for provider-specific features
- Embeddings as separate service
- Supersedes ADR-002 v1 (Claude-only)"
```

---

### Task 2: Atualizar README de ADRs

**Files:**
- Modify: `docs/architecture/adrs/README.md:21`

- [ ] **Step 1: Atualizar linha do ADR-002 no indice**

Substituir na linha 21 de `docs/architecture/adrs/README.md`:

**De:**
```
| [ADR-002](./adr-002-claude-agent-sdk.md) | Claude Agent SDK para Orquestracao de IA | ✅ Accepted | 2026-03-27 |
```

**Para:**
```
| [ADR-002](./adr-002-claude-agent-sdk.md) | Multi-LLM Provider Strategy (v2) | ✅ Accepted | 2026-03-27 (updated 2026-03-29) |
```

- [ ] **Step 2: Verificar a mudanca**

Run: `grep "ADR-002" docs/architecture/adrs/README.md`
Expected: contem "Multi-LLM Provider Strategy (v2)"

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/adrs/README.md
git commit -m "docs: update ADR-002 title in ADRs index to multi-provider"
```

---

### Task 3: Atualizar docs/architecture.md

**Files:**
- Modify: `docs/architecture.md`

#### Parte A: Secao 2.3 Agentes IA

- [ ] **Step 1: Atualizar tabela da secao 2.3**

Substituir em `docs/architecture.md` (secao 2.3, linhas 142-148):

**De:**
```markdown
### 2.3 Agentes IA

| Tecnologia | Versao | Motivo |
|------------|--------|--------|
| **Claude SDK** | Latest | Agentes inteligentes |
| **Modelo** | Claude Sonnet 4 | Custo/beneficio ideal |
| **MCP Servers** | Custom | Tool calling estruturado |
```

**Para:**
```markdown
### 2.3 Agentes IA

| Tecnologia | Versao | Motivo |
|------------|--------|--------|
| **Multi-LLM Provider Layer** | Factory Pattern | Provider-agnostic (Claude producao, MiniMax dev) |
| **Modelo Producao** | Claude Sonnet 4 | Qualidade superior para producao |
| **Modelo Dev** | MiniMax M2.7 | Testes locais sem custo |
| **MCP Servers** | Custom | Tool calling estruturado |
```

#### Parte B: Diagrama External Services

- [ ] **Step 2: Atualizar diagrama External Services**

Substituir em `docs/architecture.md` (secao External Services, ~linha 93-95):

**De:**
```
│  │  │ Claude API  │   │  Playwright │   │   Redis     │   │   CDN       │           │  │
│  │  │  (Sonnet)   │   │  (WhatsApp) │   │  (Cache)    │   │  (Static)   │           │  │
```

**Para:**
```
│  │  │ LLM API     │   │  Playwright │   │   Redis     │   │   CDN       │           │  │
│  │  │(Multi-Prov) │   │  (WhatsApp) │   │  (Cache)    │   │  (Static)   │           │  │
```

- [ ] **Step 3: Atualizar ADR-003 inline**

Substituir em `docs/architecture.md` (ADR-003, ~linhas 974-988):

**De:**
```markdown
### ADR-003: Claude Sonnet como Modelo Principal

**Status:** Accepted

**Contexto:** Agente precisa de raciocinio complexo com custo controlado.

**Decisao:** Usar Claude Sonnet 4 para todas as interacoes do agente.

**Consequencias:**
- Excelente raciocinio e seguimento de instrucoes
- Custo previsivel (~$3 por 1M tokens input)
- Tool calling nativo
- Latencia ~2-3s por resposta
```

**Para:**
```markdown
### ADR-003: Multi-LLM Provider Strategy

**Status:** Accepted (Updated 2026-03-29)

**Contexto:** Agente precisa de raciocinio complexo com custo controlado e flexibilidade para trocar provider.

**Decisao:** Usar factory pattern com interface LLMProvider. Claude Sonnet 4 para producao, MiniMax M2.7 para desenvolvimento local, OpenAI como opcao futura. Selecao via `LLM_PROVIDER` env var.

**Consequencias:**
- Troca de provider sem mudanca de codigo
- Desenvolvimento local gratuito com MiniMax
- Qualidade superior em producao com Claude
- Ver detalhes em `docs/architecture/adrs/adr-002-claude-agent-sdk.md`
```

- [ ] **Step 4: Verificar as mudancas**

Run: `grep -n "Multi-LLM\|LLM_PROVIDER\|Multi-Prov" docs/architecture.md`
Expected: pelo menos 4 linhas correspondentes

- [ ] **Step 5: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: update architecture.md for multi-LLM provider

- Section 2.3: Multi-LLM Provider Layer with factory pattern
- Diagram: LLM API (Multi-Provider) instead of Claude API
- ADR-003 inline: multi-provider strategy"
```

---

### Task 4: Atualizar docs/architecture-v1.1.md

**Files:**
- Modify: `docs/architecture-v1.1.md`

#### Parte A: Version bump

- [ ] **Step 1: Atualizar versao no header**

Substituir em `docs/architecture-v1.1.md` (linha 13):

**De:**
```
**Versao:** 1.1 (BMAD Compliant)
```

**Para:**
```
**Versao:** 1.2 (BMAD Compliant)
```

#### Parte B: Secao 2.3 Agentes IA

- [ ] **Step 2: Atualizar tabela da secao 2.3**

Substituir em `docs/architecture-v1.1.md` (secao 2.3, ~linhas 150-157):

**De:**
```markdown
### 2.3 Agentes IA

| Tecnologia | Versao | Motivo |
|------------|--------|--------|
| **Claude SDK** | Latest | Agentes inteligentes |
| **Modelo** | Claude Sonnet 4 | Custo/beneficio ideal |
| **MCP Servers** | Custom | Tool calling estruturado |
```

**Para:**
```markdown
### 2.3 Agentes IA

| Tecnologia | Versao | Motivo |
|------------|--------|--------|
| **Multi-LLM Provider Layer** | Factory Pattern | Provider-agnostic (Claude producao, MiniMax dev) |
| **Modelo Producao** | Claude Sonnet 4 | Qualidade superior para producao |
| **Modelo Dev** | MiniMax M2.7 | Testes locais sem custo |
| **MCP Servers** | Custom | Tool calling estruturado |
```

#### Parte C: Diagrama External Services

- [ ] **Step 3: Atualizar diagrama External Services**

Substituir em `docs/architecture-v1.1.md` (secao External Services, ~linhas 102-105):

**De:**
```
│  │  │ Claude API  │   │  Playwright │   │   Redis     │   │   CDN       │           │  │
│  │  │  (Sonnet)   │   │  (WhatsApp) │   │  (Cache)    │   │  (Static)   │           │  │
```

**Para:**
```
│  │  │ LLM API     │   │  Playwright │   │   Redis     │   │   CDN       │           │  │
│  │  │(Multi-Prov) │   │  (WhatsApp) │   │  (Cache)    │   │  (Static)   │           │  │
```

- [ ] **Step 4: Verificar as mudancas**

Run: `grep -n "Multi-LLM\|Multi-Prov\|Versao.*1.2" docs/architecture-v1.1.md`
Expected: pelo menos 3 linhas correspondentes

- [ ] **Step 5: Commit**

```bash
git add docs/architecture-v1.1.md
git commit -m "docs: update architecture-v1.1.md for multi-LLM provider

- Version bump to v1.2
- Section 2.3: Multi-LLM Provider Layer
- Diagram: LLM API (Multi-Provider)"
```

---

## Self-Review

### 1. Spec Coverage

| Requisito Spec | Task |
|----------------|------|
| Reescrever ADR-002 | Task 1 |
| Atualizar README ADRs | Task 2 |
| Atualizar architecture.md secao 2.3 | Task 3, Parte A |
| Atualizar architecture.md ADR-003 | Task 3, Parte C |
| Atualizar architecture-v1.1.md secao 2.3 | Task 4, Parte B |
| Atualizar architecture-v1.1.md version bump | Task 4, Parte A |
| Diagramas External Services | Task 3 Parte B, Task 4 Parte C |

**Gaps:** Nenhum. Todas as 4 mudancas do spec estao cobertas.

### 2. Placeholder Scan

- Nenhum TBD, TODO, ou "implementar depois"
- Todo codigo esta completo nos steps
- Sem "similar a Task N"

### 3. Type Consistency

- N/A (documentacao apenas, sem tipos de codigo para validar)
- Nomes de env vars consistentes entre ADR-002 e spec
