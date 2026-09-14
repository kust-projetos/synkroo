# Spike: bundle baseline frontend (G2 — performance com evidência)

Data: 2026-09-14 · Branch: `feat/hardening-g2-frontend-perf` · Next.js 15.5.22 · recharts 3.8.1

Como reproduzir: `npm run analyze` (wrapper Windows-compatível em `scripts/analyze.mjs`,
`ANALYZE=true` via `spawn`; relatórios em `.next/analyze/{client,edge,nodejs}.html`).
O wrapper `withBundleAnalyzer` em `next.config.ts` é neutro no bundle
(só gera os relatórios HTML quando `ANALYZE=true`).

## 1. Maiores chunks client (bytes em disco, `.next/static/chunks`)

| Chunk | Tamanho (antes) | Tamanho (depois) | Conteúdo |
|---|---|---|---|
| `5873.94bb3426059d0dac.js` | 374,3 KB | 374,3 KB | recharts (contém `BarChart`; `ResponsiveContainer` resolvido via alias/minify) — carregado via `r.e(5873)` sob demanda |
| `framework-a32a2a465584c0bc.js` | 185,3 KB | 185,3 KB | React/Next framework (shared) |
| `1255-cf02c4775860a5ab.js` | 170 KB raw / 46 kB gzip | idem | shared chunk |
| `4bd1b696-100b9d70ed4e49c1.js` | 169 KB raw / 54,2 kB gzip | idem | shared chunk |
| `main-1ee0fb294e64cce2.js` | 119,8 KB | 119,8 KB | runtime main |
| `polyfills-42372ed130431b0a.js` | 110 KB | 110 KB | polyfills |

## 2. First Load JS (tabela do `next build`, gzip) — 5 maiores páginas

| Rota | Size | First Load JS (antes) | First Load JS (depois) |
|---|---|---|---|
| `/dashboard/crm/pipeline` | 49 kB | 220 kB | 220 kB |
| `/dashboard/agendamentos` | 23,7 kB | 219 kB | 219 kB |
| `/dashboard/contatos` | 28,6 kB | 204 kB | 204 kB |
| `/dashboard/leads` | 11,8 kB | 190 kB | 190 kB |
| `/dashboard/tarefas` | 8,86 kB | 174 kB | 174 kB |

Total First Load JS compartilhado: **102 kB** (antes = depois).
Páginas com charts: `/dashboard/analytics` 146 kB (page 10 kB), `/dashboard/contatos` 204 kB.

## 3. Decisão por componente (os 6 imports estáticos de recharts em folhas)

Achado central do profiling: **os 6 já estão fora do caminho crítico**.
Cada folha é importada exclusivamente através de um `next/dynamic` com
`ssr:false` + skeleton no consumidor — o compilado comprova:
a página `/dashboard/analytics` (24,7 KB) carrega o chunk recharts compartilhado
via `Promise.all([r.e(4400), r.e(5873), r.e(6021/7833/4621)])` sob demanda;
`/dashboard/contatos` carrega `FinancialCharts` via `a.e(5873) + a.e(8644)` sob demanda.
O chunk 5873 (~374 KB raw) **não** faz parte dos 102 kB compartilhados do First Load.
Migrar de novo (dynamic dentro da folha) seria camada redundante: ganho mensurável
esperado = 0, custo = complexidade + risco de quebra de testes. Por isso **0 de 6 migrados**.

| # | Folha | Consumidor (dynamic já existente) | Decisão | Justificativa (números) |
|---|---|---|---|---|
| 1 | `components/charts/trends-chart.tsx` (`TrendsChartRecharts`) | `src/lib/ui/analytics-charts.tsx` (`ssr:false`, skeleton `h-64`) | NÃO migrar | Chunk página 24,7 KB; recharts (374 KB) já lazy via `r.e(5873)`; `/dashboard/analytics` First Load 146 kB inalterado por esta folha |
| 2 | `components/charts/hourly-chart.tsx` (`HourlyChartRecharts`) | `src/lib/ui/analytics-charts.tsx` (`ssr:false`, skeleton `h-48`) | NÃO migrar | Idem acima (mesmo boundary, `r.e(5873)+r.e(4621)`) |
| 3 | `components/charts/day-of-week-chart.tsx` (`DayOfWeekChartRecharts`) | `src/lib/ui/analytics-charts.tsx` (`ssr:false`, skeleton `h-48`) | NÃO migrar | Idem acima (`r.e(5873)+r.e(6021)`) |
| 4 | `components/contacts/financial-charts.tsx` (`FinancialCharts`) | `components/contacts/contact-financial-tab.tsx` (`ssr:false`, `Skeleton h-64`) | NÃO migrar | Carregado via `a.e(5873)+a.e(8644)` sob demanda, só na aba "Financeiro" (trilha raramente usada); First Load de `/dashboard/contatos` (204 kB) não contém recharts |
| 5 | `components/reports/pipeline-funnel-chart.tsx` (`PipelineFunnelChart`) | `components/reports/pipeline-analytics-dashboard.tsx` (`ssr:false`, skeleton `h-64`) | NÃO migrar | Boundary dinâmico já existente; página `/dashboard/crm/pipeline` 220 kB não inclui recharts no First Load compartilhado (102 kB) |
| 6 | `components/reports/financial-overview-chart.tsx` (`FinancialOverviewChart`) | `components/reports/financial-reports-dashboard.tsx` (`ssr:false`, skeleton `h-72`) | NÃO migrar | Idem acima |

## 4. Re-medição (depois)

Nenhuma migração aplicada (ver §3) → coluna "depois" = "antes" em todas as tabelas
(builds de 2026-09-14, antes e depois do wrapper do analyzer, byte-idênticos nos
números do relatório). Regra do plano respeitada: sem melhoria mensurável, sem mudança.

## 5. Próximos alvos reais (fora deste escopo, exigem evidência própria)

- `/dashboard/crm/pipeline` (49 kB page, 220 kB First Load) e `/dashboard/contatos`
  (28,6 kB page) são as rotas mais pesadas — o peso está nos page chunks próprios,
  não no recharts. Qualquer mexida nelas exige profiling dedicado.
- ~78% das páginas dashboard são client components — fora do escopo desta etapa.
