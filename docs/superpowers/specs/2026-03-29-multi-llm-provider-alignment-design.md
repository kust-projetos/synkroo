# Design: Multi-LLM Provider Alignment

**Data:** 2026-03-29
**Autor:** Claude + Walis
**Status:** Aprovado (v2 - revisado)
**Escopo:** ADR-002 (rewrite) + architecture.md/v1.1 (updates) + ADR README

---

## Contexto

O projeto Synkroo esta sendo desenvolvido com metodologia BMAD. A documentacao de arquitetura previa Claude Sonnet 4 como LLM unico. Na pratica, o prototipo local usa MiniMax M2.7 para testes.

**Decisao do Product Owner:** Nao se limitar a um unico provider de LLM. A arquitetura deve ser provider-agnostic, suportando multiplos providers (Claude, MiniMax, OpenAI, etc.) com troca via configuracao.

**Toda a arquitetura planejada se mantem** (Supabase, MCP Servers, Redis, Edge Functions, Event-Driven, RLS multi-tenant). A unica mudanca e no ADR-002.

---

## Numeracao de ADRs por Documento

**Importante:** Os documentos tem esquemas de numeracao diferentes. Este spec referencia os ADRs inline de cada documento:

| ADR ID | `architecture.md` (root docs) | `architecture-v1.1.md` | `docs/architecture/adrs/` |
|--------|-------------------------------|------------------------|--------------------------|
| ADR-001 | Supabase como Backend Unico | Supabase-Only para MVP | Event-Driven Architecture |
| ADR-002 | Evolution API como Primary + Playwright como Fallback | WhatsApp Hibrido (Web + API) | Claude Agent SDK |
| ADR-003 | Claude Sonnet como Modelo Principal | Row-Level Security Multi-Tenant | Caching Multi-Layer |
| ADR-004 | _(nao existe)_ | 4+1 Multi-Agent Architecture | Multi-Tenant RLS |
| ADR-005 | _(nao existe)_ | 5-Layer Memory System | Background Jobs |

O alvo das mudancas e:
- **`docs/architecture/adrs/adr-002`** → Reescrever para multi-provider
- **`architecture.md` ADR-003** (Claude Sonnet como Modelo Principal) → Atualizar para multi-provider
- **`architecture-v1.1.md`** → Nao tem ADR "Claude Sonnet" inline; adicionar nota na secao 2.3

---

## Mudancas

### 1. ADR-002: Claude Agent SDK → Multi-LLM Provider Strategy

**Arquivo:** `docs/architecture/adrs/adr-002-claude-agent-sdk.md`

**Acao:** Reescrever o conteudo do ADR-002 mantendo o mesmo arquivo. Adicionar header "Supersedes: ADR-002 v1 (Claude-only)".

**Novo conteudo:**

#### Status: Accepted (Updated v2)

#### Decisao

Adotar **Provider-Agnostic LLM Layer** com factory pattern:

```typescript
// Localizacao: src/lib/llm/provider.ts
// Interface padrao que todo provider implementa
export interface LLMProvider {
  classifyIntent(message: string): Promise<{ intent: string; confidence: number }>
  extractEntities(message: string): Promise<Record<string, string>>
  generateResponse(prompt: string, context: ConversationContext): Promise<string>
  shouldEscalate(message: string, intent: string): Promise<boolean>
}

// Embeddings sao separados do LLM provider - usam servico dedicado
// Configurados via EMBEDDING_API_KEY e EMBEDDING_MODEL, independentes do LLM_PROVIDER

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

**Nota sobre optional methods:** A interface `LLMProvider` contem apenas metodos que TODOS providers suportam. Extencoes especificas (ex: Claude tool calling, OpenAI function calling) sao implementadas via sub-interfaces que os consumers verificam com type guards:

```typescript
// Exemplo de extensao por provider
interface ClaudeExtended extends LLMProvider {
  toolCall(prompt: string, tools: Tool[]): Promise<ToolResult>
}

// Consumer verifica disponibilidade
if ('toolCall' in provider) {
  const result = await (provider as ClaudeExtended).toolCall(prompt, tools)
}
```

#### Providers Suportados

| Provider | Use Case | Modelo | Status |
|----------|----------|--------|--------|
| **Claude** | Producao (target) | Sonnet 4 | Planejado |
| **MiniMax** | Desenvolvimento local | M2.7 | Implementado (prototipo) |
| **OpenAI** | Opcao futura | GPT-4o | Planejado |

#### Arquitetura Multi-Agent (mantida)

```
ORCHESTRATOR AGENT
├── Router (sempre ativo, classifica intencao)
├── Scheduler Agent (lazy, agendamentos)
├── Sales Agent (lazy, vendas)
└── Generalist Agent (lazy, fallback)

Cada agente usa LLMProvider via factory.
MCP Servers continuam conforme planejado.
```

#### Configuracao via Environment

```bash
# Provider selection
LLM_PROVIDER=claude|minimax|openai

# Provider-specific keys
CLAUDE_API_KEY=...        # Para provider=claude
MINIMAX_API_KEY=...       # Para provider=minimax
OPENAI_API_KEY=...        # Para provider=openai

# Embeddings (servico separado, provider independente)
# Nao confundir com LLM_PROVIDER - embeddings tem seu proprio servico
EMBEDDING_API_KEY=...
EMBEDDING_MODEL=text-embedding-3-small
```

**Nota sobre Embeddings:** O metodo `generateEmbedding` foi removido da interface `LLMProvider`. Embeddings sao servico dedicado configurado via `EMBEDDING_*` env vars, independente do provider de chat. Isso evita conflito quando o provider de chat (ex: MiniMax) nao suporta embeddings de qualidade.

#### Consequencias

- **Positivas:** Troca de provider sem mudanca de codigo, testes locais com MiniMax (gratis), producao com Claude (qualidade)
- **Negativas:** Abstracao extra, alguns recursos avancados podem nao estar disponiveis em todos providers
- **Mitigacao:** Interface minimal comum + extensoes por provider via sub-interfaces com type guards

---

### 2. Atualizacao: `docs/architecture/adrs/README.md`

**Acao:** Atualizar a linha do ADR-002 no indice para refletir novo titulo e status v2.

```
| ADR-002 | Multi-LLM Provider Strategy (v2) | ✅ Accepted | 2026-03-27 (updated 2026-03-29) |
```

### 3. Atualizacao: `docs/architecture.md` (root docs)

**Arquivo:** `docs/architecture.md`

**Mudancas:**
- Secao 2.3 "Agentes IA" / stack de IA: Atualizar de "Claude SDK / Claude Sonnet 4" para "Multi-LLM Provider Layer (Claude Sonnet 4 producao, MiniMax M2.7 dev)"
- ADR-003 inline "Claude Sonnet como Modelo Principal": Atualizar titulo para "Multi-LLM Provider Strategy" e conteudo para refletir factory pattern

### 4. Atualizacao: `docs/architecture-v1.1.md`

**Arquivo:** `docs/architecture-v1.1.md`

**Mudancas:**
- Secao 2.3 / stack de IA: Adicionar nota que o sistema usa Multi-LLM Provider Layer
- **NOTA:** Este documento NAO tem ADR "Claude Sonnet como Modelo Principal" inline. O ADR-003 aqui e "Row-Level Security para Multi-Tenant". A mudanca e apenas na secao de stack de IA.
- Versao bump: v1.1 → v1.2

---

## Documentos Analisados que NAO Mudam

| Documento | Razao |
|-----------|-------|
| PRD v3.4 | Requisitos de negocio nao mudaram |
| UX Design v2.1 | Interface nao depende do provider |
| Epics | Stories nao referenciam provider especifico |
| ADR-001 (Event-Driven) | Valido e implementavel |
| ADR-003 em `adrs/` (Caching) | Valido, ainda nao implementado |
| ADR-004 em `adrs/` (Multi-Tenant RLS) | Ja implementado |
| ADR-005 em `adrs/` (Background Jobs) | Valido, ainda nao implementado |
| BMAD Validation Report | Score geral se mantem |
| Stories (e-01 a e-08) | Sem referencia a provider |

### Documentos Relacionados Verificados

| Documento | Precisa mudar? | Razao |
|-----------|----------------|-------|
| `docs/superpowers/specs/2026-03-25-agent-design.md` | Nao | Descreve arquitetura multi-agente (4+1), nao referencia provider especifico. O factory LLM encaixa naturalmente. |
| `docs/architecture/adrs/README.md` | **Sim** | Indice de ADRs precisa refletir novo titulo do ADR-002 |

---

## Plano de Execucao

1. Reescrever `docs/architecture/adrs/adr-002-claude-agent-sdk.md` com conteudo multi-provider
2. Atualizar `docs/architecture/adrs/README.md` - indice ADR-002
3. Atualizar `docs/architecture.md` - secao stack IA + ADR-003 inline
4. Atualizar `docs/architecture-v1.1.md` - secao stack IA + bump v1.2
5. Commit das mudancas

---

**Aprovado por:** Walis (Product Owner)
**Data de aprovacao:** 2026-03-29
**Revisao:** v3 - corrigidos 4 issues do spec review v2 (tabela ADR, frase incompleta, version bump restaurado)
