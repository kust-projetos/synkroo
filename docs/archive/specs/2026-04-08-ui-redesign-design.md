# Synkroo UI Redesign — Design Spec v1.1

**Data:** 2026-04-08
**Status:** Aprovado
**Escopo:** Redesign completo de todas as páginas (25 page files)
**Revisão:** v1.1 — corrigido gaps, adicionado padrões e componentes faltantes

---

## 1. Visão Geral

Redesenhar toda a interface do Synkroo para uma identidade visual **Minimalista Premium** inspirada em Linear, Vercel e Stripe. O redesign inclui: design system com shadcn/ui, tema claro/escuro, nova sidebar colapsável, cards premium com gradientes sutis, e ícones Heroicons.

**O que NÃO muda:** Toda a lógica de negócio, rotas, estrutura de arquivos, API endpoints, e tipos TypeScript permanecem intactos. Apenas a camada visual (componentes, estilos, layout) é afetada.

---

## 2. Decisões de Design

| Decisão | Escolha | Justificativa |
|---------|---------|---------------|
| Personalidade | Minimalista Premium | Consistente com SaaS B2B profissional |
| Paleta Dashboard | Teal-600 (#0d9488) + Zinc | Teal = saúde + tecnologia, Zinc = neutro premium |
| Paleta Landing | Forest Dark + Teal-800 (#115e59) CTAs | Contraste forte, visual sofisticado |
| Cards | Subtle Shadow (elevated) | Funciona melhor em dark mode que bordas |
| Ícones | Heroicons (outline + solid) | Biblioteca oficial Tailwind, tree-shakeable |
| Componentes | shadcn/ui (Radix + Tailwind) | Padrão da indústria Next.js, tema dark/light nativo |
| Sidebar | Clara/Escura por tema, colapsável | Acompanha tema, toggle expand/collapse |
| Charts | Recharts (já instalado) | Substituir charts CSS-based por charts reais |
| Abordagem | Híbrida (DS + Dashboard juntos) | Ver resultado rápido mantendo organização |

---

## 3. Design Tokens

### 3.1 CSS Variables (HSL format)

**Tema Claro:**
```css
:root {
  --background: 0 0% 98%;           /* #fafafa zinc-50 */
  --foreground: 240 6% 10%;         /* #18181b zinc-900 */
  --card: 0 0% 100%;                /* white */
  --card-foreground: 240 6% 10%;
  --primary: 168 84% 39%;           /* #0d9488 teal-600 */
  --primary-foreground: 0 0% 100%;
  --secondary: 240 5% 96%;          /* #f4f4f5 zinc-100 */
  --secondary-foreground: 240 6% 10%;
  --muted: 240 5% 96%;
  --muted-foreground: 240 4% 46%;   /* #71717a zinc-500 */
  --accent: 168 84% 94%;            /* #f0fdfa teal-50 */
  --accent-foreground: 168 84% 39%;
  --destructive: 0 84% 60%;         /* red-600 */
  --border: 240 5% 92%;             /* #e4e4e7 zinc-200 */
  --input: 240 5% 92%;
  --ring: 168 84% 39%;
  --radius: 0.5rem;
}
```

**Tema Escuro:**
```css
.dark {
  --background: 240 6% 10%;        /* #18181b zinc-900 */
  --foreground: 0 0% 98%;          /* #fafafa */
  --card: 240 5% 15%;              /* #27272a zinc-800 */
  --card-foreground: 0 0% 98%;
  --primary: 168 74% 56%;          /* #2dd4bf teal-400 */
  --primary-foreground: 240 6% 10%;
  --secondary: 240 4% 16%;         /* #27272a */
  --secondary-foreground: 0 0% 98%;
  --muted: 240 4% 16%;
  --muted-foreground: 240 4% 64%;  /* #a1a1aa zinc-400 */
  --accent: 168 74% 20%;
  --accent-foreground: 168 74% 56%;
  --destructive: 0 63% 61%;
  --border: 240 4% 20%;            /* #3f3f46 zinc-700 */
  --input: 240 4% 20%;
  --ring: 168 74% 56%;
}
```

### 3.2 Paleta de Status

| Status | Claro | Escuro | Uso |
|--------|-------|--------|-----|
| Success | green-600 #16a34a | green-400 #4ade80 | Confirmado, concluído |
| Warning | amber-600 #d97706 | amber-400 #fbbf24 | Pendente, atenção |
| Error | red-600 #dc2626 | red-400 #f87171 | Cancelado, erro |
| Info | blue-600 #2563eb | blue-400 #60a5fa | Em andamento, informativo |

### 3.3 Tipografia

- **Font**: Inter (via next/font/google)
- **Headings**: font-weight 700, tracking tight (-0.025em)
- **Body**: font-weight 400, zinc-700 light / zinc-300 dark
- **Labels**: uppercase, 9-10px, letter-spacing 0.08em, zinc-500 light / zinc-600 dark
- **Numbers**: font-weight 700-800, tracking tight

### 3.4 Landing Page (Tema fixo escuro)

```
Background: linear-gradient(135deg, #0c1117 0%, #0a1a1a 40%, #0c2e2e 100%)
CTA/Nav accent: teal-800 #115e59
Text accent: teal-200 #99f6e4
Badge pill: bg rgba(17,94,89,0.12), border rgba(17,94,89,0.2), text #99f6e4
```

---

## 4. Sidebar

### 4.1 Estrutura

- **Largura expandida**: 240px
- **Largura compactada**: 64px
- **Estado persistido** em localStorage (chave: `synkroo_sidebar_collapsed`)
- **Segue o tema**: branca no light, dark zinc (#0f0f11) no dark
- **Mobile**: drawer overlay com backdrop (preserva comportamento existente)
- **Transição**: 200ms ease para expand/collapse
- **Tooltips no compact mode**: label do item + seta, aparece no hover

### 4.2 Navegação — 3 Seções (12 itens)

**Principal:**
1. Dashboard (ícone: Squares2x2)
2. Pacientes (ícone: UsersIcon) — badge: contagem total
3. Agendamentos (ícone: CalendarDaysIcon) — badge: hoje
4. Lista de Espera (ícone: ClockIcon) — badge: aguardando
5. Inativos (ícone: UserMinusIcon) — badge: contagem

**Comunicação:**
6. Conversas (ícone: ChatBubbleLeftRightIcon) — badge: unread (pill teal)
7. Campanhas (ícone: MegaphoneIcon) — badge: ativas
8. Leads (ícone: FlagIcon) — badge: quentes

**Gestão:**
9. Analytics (ícone: ChartBarIcon)
10. Dentistas (ícone: IdentificationIcon)
11. Procedimentos (ícone: WrenchScrewdriverIcon)
12. Configurações (ícone: Cog6ToothIcon)

### 4.3 Active State

- **Light**: bg `rgba(13,148,136,0.06)`, ícone + texto teal-600 (#0d9488)
- **Dark**: bg `rgba(13,148,136,0.1)`, ícone + texto teal-400 (#2dd4bf)

### 4.4 Badges

Badges contextuais com cores por significado:
- **Genérico** (contagem): zinc-100 bg / zinc-500 text (light), zinc-800 / zinc-400 (dark)
- **Teal**: itens do dia, confirmados
- **Amber**: pendentes, inativos
- **Blue**: campanhas ativas
- **Red**: leads quentes, urgente
- **Pill teal** com texto branco: mensagens não lidas (3+ unread)

### 4.5 Compact Mode

- Só ícones SVG outline (18x18) em containers 36x36 com rounded-lg
- Tooltips com label + seta no hover
- Notification dots preservados (8px, cores por tipo)
- Avatar do usuário no rodapé (32x32, rounded-lg)

### 4.6 Rodapé

- **Toggle tema** (☀️/🌙) — pill switch
- **Perfil do usuário** — avatar teal + nome + role + ícone logout

---

## 5. Padrões de Layout Recorrentes

Identificados nas 25 páginas existentes. Todos serão componentizados como parte do design system.

### 5.1 Page Header

Usado em TODAS as páginas de listagem e formulário.

```
┌─────────────────────────────────────────────────┐
│ Título (text-xl font-bold)    [+ Novo Item] btn │
│ Subtítulo (text-sm text-muted)                   │
└─────────────────────────────────────────────────┘
```

Componente: `<PageHeader title="" description="" action={<Button>...</Button>} />`

### 5.2 Stats Bar

Usado em: Dashboard, Leads, Lista de Espera, Inativos, Campanhas/[id].

Grid de 2-5 stat cards com ícone, label, valor e indicador.

Componente: `<StatsGrid stats={[{ label, value, icon, trend, color }]} />`

### 5.3 Data Table

Usado em: Pacientes, Dentistas, Leads, Lista de Espera, Analytics, Campanhas/[id].

```
┌──────────────────────────────────────────────────┐
│ [Search input]  [Filters]  [Actions]              │
├──────────────────────────────────────────────────┤
│ Header: Col A | Col B | Col C | Col D | Actions  │
│ Row 1:   ...  |  ...  |  ...  |  ...  |   ...    │
│ Row 2:   ...  |  ...  |  ...  |  ...  |   ...    │
├──────────────────────────────────────────────────┤
│ Showing 1-10 of 247    < 1 2 3 >                 │
└──────────────────────────────────────────────────┘
```

Componente: `<DataTable columns={} data={} search={} filters={} pagination={} />`

### 5.4 Form Page

Usado em: Pacientes/novo, Agendamentos/novo, Campanhas/nova, Dentistas/novo, Leads/novo, Procedimentos/novo, Configurações.

```
┌──────────────────────────────────────────────────┐
│ ← Voltar    Título do Formulário                  │
├──────────────────────────────────────────────────┤
│ [Label]                                          │
│ [Input / Select / Date Picker]                   │
│                                                  │
│ [Label]                                          │
│ [Input / Select / Date Picker]                   │
│                                                  │
│ [Cancelar]                        [Salvar]       │
└──────────────────────────────────────────────────┘
```

Componente: `<FormPage title="" backHref="" >{children}</FormPage>`

### 5.5 Detail Page

Usado em: Pacientes/[id], Agendamentos/[id], Campanhas/[id], Dentistas/[id], Leads/[id], Procedimentos/[id].

```
┌──────────────────────────────────────────────────┐
│ ← Voltar    Título     [Status Badge]  [Editar]  │
├──────────────────────────────────────────────────┤
│ Card: Info principal                              │
│ Card: Detalhes / Histórico / Tabs                │
└──────────────────────────────────────────────────┘
```

Componente: `<DetailPage title="" backHref="" status={} actions={} >{children}</DetailPage>`

### 5.6 Back Navigation

Usado em 10+ páginas. Icon arrow + link "Voltar".

Componente: `<BackLink href="" label="" />`

---

## 6. Cards Premium

Todos os cards usam **subtle shadow** (sem borda) e **border-radius 12-16px**.

### 6.1 Stat Card (com strip + trend)

- Gradient strip no topo (3px, linear-gradient teal)
- Ícone em container com gradiente bg (48x48, rounded-xl)
- Sparkle dot no canto do ícone para trend up
- Progress bar com gradiente teal
- Trend badge (ex: +12.5%)

### 6.2 Stat Card Invertido (fundo teal)

- Background gradiente teal (#0d9488 → #0f766e)
- Texto branco
- Subtle dot pattern overlay (opacity 0.05, radial-gradient)
- Stat pill com bg rgba branco

### 6.3 Patient Card (perfil completo)

- Avatar com gradiente bg + inicial + online indicator
- Info grid (telefone, última visita, consultas) em bg zinc-50 com dividers internos
- Tags com gradient bg teal sutil e borda
- Footer com divider, próxima consulta e link "Ver perfil →"

### 6.4 Appointment Card (com sidebar de data)

- Sidebar de data com gradiente teal (mês, dia, hora) — 64px largura
- Content area com paciente, dentista, procedimento
- Status badge com borda sutil
- Quick actions inline (Ligar, WhatsApp, Editar)

### 6.5 Lead Card (com temperatura)

- Left border colorido (4px, gradiente red) indicando temperatura
- Score bar com gradiente amber→red
- Badge de temperatura (Quente/Morno/Frio)
- Footer com dados de contato e CTA "Converter →"

### 6.6 Campaign Card (métricas)

- Metrics grid (3 colunas) com dividers internos e bg zinc-50
- Numbers em font-weight 800
- Progress bar segmentada com cores por etapa
- Badge de status com cores contextuais

### 6.7 Conversation Card (chat preview)

- Avatar com online indicator (green dot, border 3px)
- Message preview em bubble bg zinc-50 com border-top-left-radius mínimo
- Unread count badge (pill teal com texto branco)
- Quick actions (Responder, Agendar)

### 6.8 Empty State

- Ícone grande (64px) em container com gradiente bg (rounded-2xl)
- Título bold + descrição + CTA
- CTA com gradiente teal e box-shadow rgba(13,148,136,0.3)

### 6.9 Notification Toast

- Ícone em container com gradiente bg (40x40, rounded-xl)
- Título bold + descrição + ações em texto
- Timestamp (canto superior direito, cor muted)
- Box-shadow mais forte que cards normais (shadow-lg)
- Auto-dismiss em 5s (reduzir de 30s atual)
- Variantes: success (green), error (red), warning (amber), info (blue)

### 6.10 Waitlist Card (Lista de Espera)

- Priority indicator colorido (1-10, gradiente green→yellow→red)
- Preferred date/time com ícone calendário
- Days waiting badge (cor escalada por urgência)
- Status badge + actions (cancel, view appointment)

---

## 7. Componentes shadcn/ui

### 7.1 Componentes Base (shadcn/ui init)

| Componente | Uso no Synkroo |
|------------|----------------|
| Button | 6 variantes: primary, default, outline, secondary, ghost, destructive |
| Input | Form fields com label, focus ring teal |
| Badge | Status badges — 6 cores: teal, amber, red, blue, green, zinc |
| Card | Container base para todos os cards premium |
| Dialog | Modais de confirmação, contact, preferences |
| Dropdown Menu | Actions menu nas tabelas (⋯) |
| Select | Dropdowns em formulários (dentista, procedimento, tipo) |
| Table | Data tables com paginação |
| Tabs | Patient detail (Info / Consultas), Analytics tabs |
| Toast | Notification toasts — success/error/warning/info |
| Tooltip | Sidebar compacta, info helpers |
| Avatar | User profiles, patient initials |
| Skeleton | Loading states para tabelas e cards |
| Separator | Dividers em cards e layouts |
| Popover | Date picker, filters |
| Sheet | Mobile sidebar drawer |
| Switch | Toggle de configurações (notificações) |

### 7.2 Componentes Customizados (Synkroo-specific)

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| `PageHeader` | `src/components/ui/page-header.tsx` | Título + subtítulo + action button |
| `StatsGrid` | `src/components/ui/stats-grid.tsx` | Grid responsivo de stat cards |
| `DataTable` | `src/components/ui/data-table.tsx` | Tabela com search, filters, paginação |
| `FormPage` | `src/components/ui/form-page.tsx` | Container de formulário com back nav |
| `DetailPage` | `src/components/ui/detail-page.tsx` | Container de detail com status + actions |
| `BackLink` | `src/components/ui/back-link.tsx` | Navegação ← Voltar |
| `StatusBadge` | `src/components/ui/status-badge.tsx` | Badge de status com mapeamento de cores |
| `StatCard` | `src/components/ui/stat-card.tsx` | Card de métrica premium |
| `StatCardInverted` | `src/components/ui/stat-card-inverted.tsx` | Card teal invertido |
| `PatientCard` | `src/components/ui/patient-card.tsx` | Card de paciente com avatar + info |
| `AppointmentCard` | `src/components/ui/appointment-card.tsx` | Card de agendamento com data sidebar |
| `LeadCard` | `src/components/ui/lead-card.tsx` | Card de lead com score bar |
| `CampaignCard` | `src/components/ui/campaign-card.tsx` | Card de campanha com métricas |
| `ConversationCard` | `src/components/ui/conversation-card.tsx` | Card de conversa com preview |
| `EmptyState` | `src/components/ui/empty-state.tsx` | Estado vazio com CTA |
| `SearchInput` | `src/components/ui/search-input.tsx` | Input de busca com ícone |
| `FilterBar` | `src/components/ui/filter-bar.tsx` | Barra de filtros reutilizável |

### 7.3 Dark Mode

- **ThemeProvider**: `next-themes` com `attribute="class"` e `defaultTheme="light"`
- **Toggle**: No header do dashboard (ícone ☀️/🌙)
- **Persistência**: localStorage automático via next-themes
- **Integração**: shadcn/ui CSS variables respondem automaticamente à classe `.dark`

---

## 8. Charts (Recharts)

Substituir todos os charts CSS-based por componentes Recharts (já instalado como dependência).

| Chart Atual (CSS) | Chart Novo (Recharts) | Componente |
|-------------------|----------------------|------------|
| `HourlyChart` (barras verticais) | `<BarChart>` com gradiente teal | `src/components/charts/hourly-chart.tsx` |
| `DayOfWeekChart` (barras horizontais) | `<BarChart>` horizontal | `src/components/charts/day-of-week-chart.tsx` |
| `TrendsChart` (stacked bars) | `<BarChart>` stacked | `src/components/charts/trends-chart.tsx` |
| `ROICard` | Manter card, usar Recharts para sparklines se necessário | Manter `src/lib/ui/analytics-charts.tsx` (refatorado) |
| `AnalyticsMetrics` | Refatorar para usar `StatsGrid` | Usar componente comum |

**Tema dos charts:**
- Light: teal-500 para barras, zinc-400 para grid lines
- Dark: teal-400 para barras, zinc-600 para grid lines
- Tooltips com card style do design system

---

## 9. Chat Widget

O widget é **público/embutido** (não faz parte do dashboard). Mudanças:

- **Remover** prop `primaryColor` — usar CSS variable `--primary` do tema
- **Aplicar** tema claro/escuro baseado na preferência do sistema (não do dashboard)
- **Manter** todas as props: `clinicId`, `clinicName`, `position`, `greeting`
- **Atualizar** estilos para usar subtle shadow + border-radius 16px + avatar com gradiente

---

## 10. Notification System

### NotificationCard → NotificationToast (shadcn)

- **Substituir** implementação customizada por `Toast` do shadcn/ui
- **Manter** os 6 tipos: agenda, paciente, lembrete, campanha, financeiro, sistema
- **Mapear** cores: agenda→blue, paciente→teal, lembrete→amber, campanha→green, financeiro→purple, sistema→zinc
- **Auto-dismiss**: 5s (reduzir de 30s atual)

### NotificationPreferences → Dialog (shadcn)

- **Substituir** implementação customizada por `Dialog` do shadcn/ui
- **Manter** 6 categorias com toggles
- **Manter** persistência em localStorage
- **Atualizar** visual para cards com switch components

---

## 11. Páginas a Migrar (25 files)

### 11.1 Layout & Navegação
| Prioridade | Rota | Tipo |
|------------|------|------|
| P0 | Dashboard layout | Layout (sidebar + header) |
| P0 | Sidebar | Componente colapsável |

### 11.2 Dashboard Principal
| Prioridade | Rota | Tipo |
|------------|------|------|
| P1 | `/dashboard` | Dashboard home com stat cards + agenda + leads |

### 11.3 Listagens (6 páginas)
| Prioridade | Rota | Tipo |
|------------|------|------|
| P2 | `/dashboard/pacientes` | Tabela com paginação |
| P2 | `/dashboard/agendamentos` | Lista com filtros de data/status |
| P2 | `/dashboard/leads` | Pipeline com badges de temperatura |
| P2 | `/dashboard/lista-espera` | Waitlist com priority indicators |
| P2 | `/dashboard/dentistas` | Tabela com busca |
| P2 | `/dashboard/procedimentos` | Grid de cards |

### 11.4 Sub-páginas (14 páginas)
| Prioridade | Rota | Tipo |
|------------|------|------|
| P2 | `/dashboard/pacientes/novo` | Form |
| P2 | `/dashboard/pacientes/[id]` | Detail com tabs |
| P2 | `/dashboard/pacientes/[id]/editar` | Form |
| P2 | `/dashboard/pacientes/inativos` | Lista com filtros + contact modal |
| P2 | `/dashboard/agendamentos/novo` | Form complexo (typeahead, time slots) |
| P2 | `/dashboard/agendamentos/[id]` | Detail + inline edit |
| P2 | `/dashboard/campanhas` | Lista |
| P2 | `/dashboard/campanhas/nova` | Form com template editor |
| P2 | `/dashboard/campanhas/[id]` | Detail com stats |
| P2 | `/dashboard/leads/novo` | Form |
| P2 | `/dashboard/leads/[id]` | Detail com score |
| P2 | `/dashboard/dentistas/novo` | Form |
| P2 | `/dashboard/dentistas/[id]` | Detail + inline edit |
| P2 | `/dashboard/procedimentos/novo` | Form |
| P2 | `/dashboard/procedimentos/[id]` | Detail + inline edit |

### 11.5 Funcionalidades
| Prioridade | Rota | Tipo |
|------------|------|------|
| P2 | `/dashboard/conversas` | Split pane inbox |
| P2 | `/dashboard/analytics` | Charts + métricas |
| P2 | `/dashboard/configuracoes` | Settings form |

### 11.6 Auth (3 páginas)
| Prioridade | Rota | Tipo |
|------------|------|------|
| P3 | `/login` | Card centrado |
| P3 | `/signup` | Card centrado |
| P3 | `/complete-profile` | Card centrado |

### 11.7 Landing Page
| Prioridade | Rota | Tipo |
|------------|------|------|
| P3 | `/` | Hero + features + CTA |

### 11.8 Chat Widget
| Prioridade | Rota | Tipo |
|------------|------|------|
| P3 | Componente embutido | Widget flutuante |

---

## 12. Dependências a Instalar

```bash
# shadcn/ui init (cria lib/utils.ts + components.json)
npx shadcn@latest init

# shadcn/ui components
npx shadcn@latest add button input badge card dialog dropdown-menu select table tabs toast tooltip avatar skeleton separator popover sheet switch

# Dependências manuais
npm install @heroicons/react next-themes class-variance-authority clsx tailwind-merge tailwindcss-animate cmdk recharts
```

**Nota:** shadcn/ui instala as dependências Radix automaticamente. Não instalar @radix-ui/* manualmente.

---

## 13. Abordagem de Implementação

**Híbrida**: Montar design system + migrar dashboard em paralelo.

### Fase 1: Foundation (P0)
1. Init shadcn/ui + configurar tailwind-merge + next-themes
2. Configurar CSS variables (light + dark) em globals.css
3. Criar `lib/utils.ts` (cn helper)
4. Instalar componentes shadcn/ui base
5. Criar ThemeProvider em providers.tsx

### Fase 2: Core Components (P1)
6. Criar componentes customizados Synkroo (PageHeader, StatsGrid, DataTable, FormPage, etc.)
7. Refazer sidebar com Heroicons + seções + badges + collapse
8. Refazer dashboard layout (sidebar + header + content)

### Fase 3: Dashboard Principal (P1)
9. Migrar página principal do Dashboard
10. Migrar analytics com Recharts

### Fase 4: Listagens (P2)
11. Migrar páginas de listagem (Pacientes, Agendamentos, Leads, Lista de Espera, Dentistas, Procedimentos)

### Fase 5: Formulários & Details (P2)
12. Migrar páginas de formulário (novo/editar)
13. Migrar páginas de detail

### Fase 6: Funcionalidades (P2)
14. Migrar conversas (split pane)
15. Migrar configurações
16. Atualizar notification system

### Fase 7: Auth & Landing (P3)
17. Refazer Login / Signup / Complete-profile
18. Refazer Landing Page (Forest Dark)

### Fase 8: Chat Widget (P3)
19. Atualizar Chat Widget com CSS variables

---

## 14. Notas Adicionais

- **Manter** toda a lógica de negócio — só muda visual
- **Manter** rotas e estrutura de arquivos existente
- **Substituir** todos os SVGs inline por Heroicons
- **Substituir** todos os emojis em UI por ícones Heroicons
- **Migrar** charts CSS-based para Recharts
- **Testes** existentes devem continuar passando — atualizar selectors se necessário
- **Performance**: shadcn/ui é tree-shakeable, Heroicons é tree-shakeable — sem bundle bloat
- **Acessibilidade**: shadcn/ui/Radix provê aria labels e keyboard navigation automaticamente
