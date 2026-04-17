# CLAUDE.md - Synkroo

**Projeto:** Synkroo - Calendário Kanban com WhatsApp Bot
**Versão:** 0.1.0
**Última atualização:** 2026-04-15
**Idioma:** Português Brasil

---

## Visão Geral

Synkroo é um aplicativo de calendário/kanban com integração WhatsApp. Permite gerenciar eventos, tarefas e communicate via chatbot.

**Stack Principal:**
- **Frontend:** Next.js 15 (React 19)
- **Database:** Supabase (PostgreSQL)
- **Styling:** Tailwind CSS + Radix UI
- **State:** Zustand + TanStack Query
- **WhatsApp:** Custom bot com qrcode-terminal

---

## Estrutura do Projeto

```
synkroo/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/                # API routes
│   │   ├── dashboard/           # Dashboard pages
│   │   ├── login/              # Auth pages
│   │   ├── signup/
│   │   ├── complete-profile/
│   │   ├── layout.tsx           # Root layout
│   │   ├── page.tsx            # Landing page
│   │   └── providers.tsx       # Context providers
│   │
│   ├── components/
│   │   ├── calendar/            # Calendar components (@event-calendar/core)
│   │   ├── charts/             # Recharts visualizations
│   │   ├── chat-widget/        # WhatsApp chat interface
│   │   ├── notifications/      # Toast notifications
│   │   └── ui/                 # Radix UI primitives (Button, Dialog, etc.)
│   │
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # Utilities, Supabase client
│   ├── services/               # Business logic services
│   └── types/                  # TypeScript types
│
├── public/                     # Static assets
├── e2e/                       # Playwright E2E tests
├── graphify-out/               # Code knowledge graph
├── screenshots/               # App screenshots
└── package.json
```

---

## Comandos Principais

```bash
# Desenvolvimento
npm run dev                    # Next.js dev server (port 3000)
npm run build                  # Production build
npm run lint                   # ESLint

# Database (Supabase CLI)
npm run db:setup              # Setup database
npm run db:push               # Push schema changes
npm run db:pull               # Pull remote schema
npm run db:reset              # Reset local database
npm run db:seed               # Seed database
npm run supabase:start         # Start local Supabase
npm run supabase:stop         # Stop local Supabase

# WhatsApp Bot
npm run whatsapp:start        # Start WhatsApp CLI (generates QR)

# Testes
npm test                      # Jest tests
npm run test:watch           # Watch mode

# Health check
curl -s http://localhost:3000/api/health | jq .
```

---

## Variáveis de Ambiente

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_ID=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=

# WhatsApp
WHATSAPP_SESSION_NAME=synkroo-session
```

---

## Arquitetura

### Autenticação

- **Método:** Supabase Auth com middleware de proteção
- **Arquivos-chave:** `src/middleware.ts`, `src/lib/supabase/`
- **Rotas protegidas:** `/dashboard/*`, `/api/*`

### Estado da Aplicação

| Estado | Biblioteca | Persistência |
|--------|-------------|---------------|
| **Server State** | TanStack Query | Supabase (remote) |
| **UI State** | Zustand | Memory (local) |
| **Theme** | next-themes | localStorage |

### Calendário

- **Biblioteca:** `@event-calendar/core`
- **Views:** Month, Week, Day
- **Eventos:** Supabase `events` table
- **Componentes:** `src/components/calendar/`

---

## Convenções de Código

### Nomenclatura

- **Arquivos de componente:** PascalCase (`CalendarView.tsx`)
- **Hooks:** camelCase com prefixo `use` (`useCalendar.ts`)
- **Utilidades:** kebab-case (`date-utils.ts`)
- **Types/Interfaces:** PascalCase

### Estrutura de Componente

```typescript
// src/components/ui/Button.tsx
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva('...', {
  variants: { variant: { default: '...', destructive: '...' } },
  defaultVariants: { variant: 'default' },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant }), className)} ref={ref} {...props} />;
  }
);
```

### Import Paths

```typescript
// Use @/ alias
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useCalendarStore } from '@/hooks/useCalendar';
```

---

## Cores e Temas

### Light/Dark Mode

O projeto usa `next-themes` com Tailwind `darkMode: 'class'`.

**CSS Variables (em `globals.css`):**
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
}
.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
}
```

### Paleta de Cores

| Token | Light | Dark |
|-------|-------|------|
| `primary` | blue-600 | blue-500 |
| `secondary` | slate-100 | slate-800 |
| `accent` | indigo-500 | indigo-400 |
| `destructive` | red-500 | red-400 |
| `muted` | slate-100 | slate-800 |

---

## Componentes Principais

### UI Primitives (Radix UI)

| Componente | Import | Props principais |
|------------|--------|------------------|
| `Button` | `@/components/ui/button` | variant, size, asChild |
| `Card` | `@/components/ui/card` | title, padding, footer |
| `Dialog` | `@/components/ui/dialog` | open, onOpenChange |
| `DropdownMenu` | `@/components/ui/dropdown-menu` | trigger, children |
| `Select` | `@/components/ui/select` | value, onValueChange |
| `Toast` | `@/components/ui/toast` | title, description |
| `Tooltip` | `@/components/ui/tooltip` | content, children |

### Componentes de Feature

| Componente | Local | Descrição |
|------------|-------|-----------|
| `CalendarView` | `components/calendar/` | Wrapper @event-calendar |
| `EventCard` | `components/calendar/` | Card para eventos |
| `CashFlowChart` | `components/charts/` | Gráfico de receitas/despesas |
| `ChatWidget` | `components/chat-widget/` | Interface WhatsApp |
| `NotificationToast` | `components/notifications/` | Toast notifications |

---

## Banco de Dados (Supabase)

### Tabelas Principais

```sql
-- Events (calendário)
events (
  id UUID PRIMARY KEY,
  title TEXT,
  description TEXT,
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  user_id UUID REFERENCES auth.users,
  created_at TIMESTAMP DEFAULT now()
)

-- Users (perfil estendido)
profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT now()
)
```

### Comandos Úteis

```bash
# Gerar tipos TypeScript do banco
npm run db:types

# Verificar conexão
npm run health
```

---

## Testes

### Unit Tests (Jest)

```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
```

### E2E Tests (Playwright)

```bash
# Setup
npx playwright install

# Run
npx playwright test

# UI Mode
npx playwright test --ui
```

**Arquivos E2E:** `e2e/` com spec files por feature.

---

## Debugging

### Performance

```bash
# Lighthouse audit
npx lighthouse http://localhost:3000 --output=json --output-path=./perf.json
```

### Screenshot Debug

```javascript
// Chrome DevTools MCP
take_screenshot(filePath: "screenshots/debug-calendar.png")

// Playwright MCP
browser_take_screenshot(filename: "screenshots/debug-calendar.png")
```

---

## Graphify

Este projeto possui knowledge graph em `graphify-out/`.

**Rebuild após mudanças:**
```bash
python -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"
```

---

## Recursos Adicionais

| Recurso | Local |
|---------|-------|
| README | `README.md` |
| Screenshots | `screenshots/` |
| E2E Report | `playwright-report/` |
| Code Graph | `graphify-out/GRAPH_REPORT.md` |
| UX Analysis | `ux-analysis.md` |
