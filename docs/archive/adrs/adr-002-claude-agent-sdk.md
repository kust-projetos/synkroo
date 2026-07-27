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

**Nota sobre optional methods:** A interface `LLMProvider` contem apenas metodos que TODOS providers suportam. Extensoes especificas (ex: Claude tool calling, OpenAI function calling) sao implementadas via sub-interfaces que os consumers verificam com type guards:

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

### 3. Providers Suportados

| Provider | Use Case | Modelo | Status |
|----------|----------|--------|--------|
| **Claude** | Producao (target) | Sonnet 4 | Planejado |
| **MiniMax** | Desenvolvimento local | M2.7 | Implementado (prototipo) |
| **OpenAI** | Opcao futura | GPT-4o | Planejado |

### 4. Embeddings (Servico Separado)

Embeddings sao servico dedicado, independente do LLM provider:

```typescript
// Embeddings usam servico proprio, nao o LLMProvider
// Configurados via EMBEDDING_* env vars
// Isso evita conflito quando o provider de chat nao suporta embeddings de qualidade
```

### 5. Arquitetura Multi-Agent (Mantida)

```
ORCHESTRATOR AGENT
+-- Router (sempre ativo, classifica intencao)
+-- Scheduler Agent (lazy, agendamentos)
+-- Sales Agent (lazy, vendas)
+-- Generalist Agent (lazy, fallback)

Cada agente usa LLMProvider via factory.
MCP Servers continuam conforme planejado.
```

### 6. Configuracao via Environment

```bash
# Provider selection
LLM_PROVIDER=claude|minimax|openai

# Provider-specific keys
CLAUDE_API_KEY=...        # Para provider=claude
MINIMAX_API_KEY=...       # Para provider=minimax
OPENAI_API_KEY=...        # Para provider=openai

# Embeddings (servico separado, provider independente)
EMBEDDING_API_KEY=...
EMBEDDING_MODEL=text-embedding-3-small
```

---

## Alternativas Consideradas

### Alternativa 1: Claude-only (v1 deste ADR)
- **Pros:** Simples, SDK nativo, tool calling robusto
- **Contras:** Vendor lock-in, sem opcao local gratuita
- **Veredito:** Atualizado para multi-provider

### Alternativa 2: LangChain com multi-provider
- **Pros:** Ecossistema grande, abstracao pronta
- **Contras:** Complexidade extra, curva de aprendizado
- **Veredito:** Rejeitada - factory propria e mais leve

### Alternativa 3: Multi-LLM Provider com Factory (Decisao Atual)
- **Pros:** Troca via env var, teste local gratis, codigo agnostico
- **Contras:** Abstracao extra, recursos avancados podem nao estar disponiveis em todos providers
- **Veredito:** Aceita - interface minimal comum + extensoes por sub-interface

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
