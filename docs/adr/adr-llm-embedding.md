# ADR-LLM-01: Escolha de LLM Provider, Modelo de Embedding e Dimensão pgvector

**Status:** ✅ Aprovado  
**Data:** 2026-08-23  
**Fase:** F6 (IA & Mensageria) — Requisito F6.06 / O3-G04

---

## Contexto & Problema

O Synkroo necessita de uma camada de inteligência artificial conversacional e busca semântica para:
1. **Chat & Agentes:** Processamento de intenções, atendimento ao paciente, agendamento assistido e triagem de mensagens via WhatsApp/canais.
2. **Knowledge Base (RAG):** Busca semântica vetorial sobre a base de conhecimento odontológico da clínica, procedimentos, políticas de cancelamento e FAQs.
3. **Robustez & Segurança:** O sistema não pode alucinar sucesso de ações, vazar segredos/chaves de API nem tolerar falhas abertas (*fail-closed* mandatório). A dimensão dos vetores de embedding precisa ser fixada e consistente no banco de dados (`pgvector`) antes de qualquer ingestão.

---

## Decisões

### 1. Multi-LLM Provider Layer (Factory Pattern)
- **Primary / Default Provider:** **MiniMax** (`MiniMax-M2.7`)
  - **Justificativa:** Excelente desempenho em língua portuguesa, suporte nativo a OpenAI-compatible API (`chat/completions`), suporte a function calling / tool calls (`operacional__*`, `comercial__*`), e custo-benefício ideal para o volume de mensagens de clínicas odontológicas.
- **Secondary / Fallback Providers:**
  - **OpenAI** (`gpt-4o-mini`, `gpt-4o`): Provedor de alta confiabilidade para ambientes com chaves corporativas diretas.
  - **OpenRouter** (`anthropic/claude-3.5-sonnet`, `meta-llama/llama-3.1-70b-instruct`): Provedor multi-modelo com failover e agregação.
- **Resolução Dinâmica:** Gerenciada pela factory `createLlmProvider` / `getLlmProvider` em `src/lib/llm/` via variável `LLM_PROVIDER` (`minimax` | `openai` | `openrouter`).

### 2. Modelo de Embedding & Dimensão Vetorial Fixa
- **Modelo de Embedding Primário:** **`text-embedding-3-small`** (OpenAI).
- **Dimensão Vetorial Produzida:** **`1536`** (dimensão fixa).
- **Vector Store:** **`pgvector`** (PostgreSQL) com coluna `embedding vector(1536)` (conforme [ADR-BASE-04](file:///D:/projetos/synkroo/docs/adr/ADR-BASE-04-pgvector.md)).
- **Regra de Ingestão:** Nenhuma ingestão de documentos ou geração de embeddings é iniciada sem que o vetor tenha exatamente 1536 dimensões finitas e o modelo esteja explícito nos metadados.

### 3. Fail-Closed Guarantees (Falha Fechada)
- **Sem Provedor / Chave Ausente:** Lança erro tipado `LlmError` com código `missing_api_key`. Nunca inventa respostas nem executa tools de forma espúria.
- **Provider Down / 5xx / Network Outage:** Aplica retentativas seguras e controladas (apenas para requisições idempotentes) com timeout budget (default 30s) e lança `provider_down`. O contexto da conversa é preservado, e o fluxo escala para atendimento humano.
- **Rate Limit (429):** Identificado com código `rate_limited` e statusCode 429.
- **Redação de Segredos:** Tokens de autenticação (`Bearer ...`, `sk-...`, `MINIMAX_API_KEY`, etc.) são ativamente redigidos de mensagens de erro, logs e payloads serializados.

---

## Consequências & Benefícios

- **Portabilidade:** Possibilidade de alternar providers (MiniMax ↔ OpenAI ↔ OpenRouter) via configuração de ambiente sem alteração de código de negócio.
- **Segurança Operacional:** Garantia de que nenhuma ação clínica ou financeira (R1–R3) é disparada por resposta malformada ou falha de conectividade.
- **Consistência Vetorial:** pgvector opera com dimensão 1536 estável e índice compatível com busca por similaridade de cosseno (`cosine`).

---

## Evidências & Implementação
- **Módulo Adapter:** `src/lib/llm/` (`types.ts`, `errors.ts`, `factory.ts`, `providers/base.ts`, `providers/minimax.ts`, `providers/openai.ts`, `providers/openrouter.ts`)
- **Embeddings:** `src/lib/embeddings/generate.ts` (1536 dims, `text-embedding-3-small`)
- **Testes de Contrato:** `src/lib/llm/__tests__/llm-adapter.test.ts` (14 testes verdes cobrindo seleção, 401, 429, 500, timeout, redação e tool parsing).
