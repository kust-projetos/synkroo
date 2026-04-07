# Product Discovery Session - Synkroo

**Data:** 2026-03-24 (Atualizado)
**Metodologia:** BMAD (Business-driven Modular AI Development)
**Status:** ✅ Fase Planning Completa - Pronto para UX Design
**Configuração:** `_bmad/bmm/config.yaml`

---

## Resumo Executivo

**Synkroo** é uma plataforma de automação empresarial para clínicas construída sobre agentes SDK Claude. Após Discovery completo, passamos por:
- ✅ Product Brief v2.1
- ✅ Market Research
- ✅ Technical Research
- ✅ Domain Research
- ✅ Improvements Proposal
- ✅ PRD v3.1

---

## Respostas Consolidadas

### Background & Motivação
- **Origem da ideia:** Observação de oportunidade de mercado em clínicas
- **Foco inicial:** Clínicas odontológicas (95.000+ no Brasil)
- **Expansão futura:** Estética, fisioterapia, outras clínicas

### Problemas Identificados
| Dor | Impacto |
|-----|---------|
| No-show 30-40% | R$5-15k/mês perdido |
| Atendente única | Risco operacional |
| Sobrecarga | Erros, turnover |
| Falta de follow-up | Pacientes abandonam tratamento |
| Leads não respondidos | Perda de receita |

### Público-Alvo
- **Primário:** Clínicas odontológicas (1-5 dentistas, 1-2 atendentes)
- **Faturamento:** R$30-150k/mês
- **Dor principal:** Sobrecarga da única atendente

### Estratégia de Vendas
**Pipeline:**
1. Agente SDR contato via Instagram/WhatsApp
2. Reunião GPCT (descoberta)
3. Demo do agente funcionando (LIVE)
4. Proposta personalizada
5. Implementação

### MVP Definido
**Prazo:** 8 semanas
**Módulos:** 6 (Core, WhatsApp, Scheduling, CRM, Dashboard, Follow-up)
**Agentes:** Router + Assistant
**Stack:** Supabase-only

### Modelo de Negócio
**Híbrido (setup + mensal + repasse):**
- Setup Fee: R$ 3.000 - 20.000
- Mensalidade: R$ 500 - 3.000
- Tokens LLM: Repassados ao cliente
- Margem: 95%+

---

## Diferenciais Confirmados

| Diferencial | Status |
|-------------|--------|
| Agente SDK Claude (não chatbot) | ✅ Mantido |
| Memória persistente + RAG | ✅ MVP |
| WhatsApp Web + Playwright (sem custo API) | ✅ MVP |
| Multi-tenant via RLS | ✅ MVP |
| Stack Supabase-only (simplificado) | ✅ MVP |
| GPCT + Demo ao vivo | ✅ Mantido |

---

## Decisões Tomadas

| Decisão | Escolha |
|---------|---------|
| Nome | **Synkroo** |
| MVP Scope | 6 módulos (simplificado) |
| Agentes MVP | Router + Assistant |
| Stack | Supabase-only |
| WhatsApp | Híbrido (Web + API opcional) |
| Voice/Call Center | Pós-MVP |
| Finance | Pós-MVP |
| BI | Pós-MVP |

---

## Lacunas Resolvidas

| Lacuna | Resolução |
|--------|-----------|
| Stack tecnológica | ✅ Supabase-only (simplificado) |
| Tamanho do mercado | ✅ ~213.500 clínicas |
| Concorrentes | ✅ 6 diretos + chatbots |
| Diferenciação | ✅ Claude SDK + MCPs + Memória |
| Pricing | ✅ Modelo híbrido definido |
| Roadmap | ✅ 8 semanas detalhado |
| Riscos | ✅ 30 itens mapeados |

---

## Próximos Passos

1. ✅ Discovery Completo
2. ✅ Product Brief Aprovado
3. ✅ PRD v3.1 Finalizado
4. **➡️ UX Design** (`bmad-create-ux-design`)
5. **Arquitetura Técnica** (`bmad-create-architecture`)
6. **Epics & Stories** (`bmad-create-epics-and-stories`)

---

## Arquivos do Projeto

```
workspace/projects/synkroo/
├── _bmad/bmm/config.yaml
├── docs/planning/
│   ├── product-brief.md        ✅ v2.1
│   ├── market-research.md      ✅ Completo
│   ├── domain-research.md      ✅ Completo
│   ├── technical-research.md   ✅ MVP Simplificado
│   ├── improvements-proposal.md ✅ Classificado
│   ├── prd.md                  (v3.0 - arquivado)
│   └── prd-v3.1.md             ✅ Versão ativa
├── discovery-session.md        ✅ Este arquivo
└── SESSION-PROGRESS.md         ✅ Atualizado
```