# Phase 1: Foundation — shadcn/ui + Design Tokens + ThemeProvider

**Goal:** Configurar toda a infraestrutura do design system: shadcn/ui, CSS variables, dark mode, utils, ThemeProvider.

**Depends on:** Nothing (first phase)

---

## Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install core dependencies**

```bash
cd D:/claude_code/claude_code/projetos/synkroo
npm install next-themes class-variance-authority clsx tailwind-merge tailwindcss-animate @heroicons/react cmdk
```

Expected: `package.json` updated with new deps, no errors.

- [ ] **Step 2: Verify installation**

```bash
npm ls next-themes @heroicons/react class-variance-authority clsx tailwind-merge tailwindcss-animate
```

Expected: All packages listed without `UNMET`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add UI redesign dependencies (shadcn/ui, heroicons, next-themes)"
```

---

## Task 2: Initialize shadcn/ui

**Files:**
- Create: `components.json`
- Create: `src/lib/utils.ts`

- [ ] **Step 1: Create `components.json` manually**

Since `npx shadcn@latest init` is interactive, create the config file directly:

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **Step 2: Create `src/lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 3: Verify imports work**

```bash
npx tsc --noEmit src/lib/utils.ts
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add components.json src/lib/utils.ts
git commit -m "feat: initialize shadcn/ui config and cn() utility"
```

---

## Task 3: Configure Tailwind for Dark Mode + Design Tokens

**Files:**
- Modify: `tailwind.config.ts`

- [ ] **Step 1: Update `tailwind.config.ts`**

Replace the entire file with:

```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
```

- [ ] **Step 2: Verify Tailwind config is valid**

```bash
npx tailwindcss --help
```

Expected: No parse errors.

- [ ] **Step 3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat: configure Tailwind dark mode, CSS variables, animate plugin"
```

---

## Task 4: Configure CSS Variables (Light + Dark Themes)

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace `src/app/globals.css` entirely**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 98%;
    --foreground: 240 6% 10%;
    --card: 0 0% 100%;
    --card-foreground: 240 6% 10%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 6% 10%;
    --primary: 168 84% 39%;
    --primary-foreground: 0 0% 100%;
    --secondary: 240 5% 96%;
    --secondary-foreground: 240 6% 10%;
    --muted: 240 5% 96%;
    --muted-foreground: 240 4% 46%;
    --accent: 168 84% 94%;
    --accent-foreground: 168 84% 39%;
    --destructive: 0 84% 60%;
    --border: 240 5% 92%;
    --input: 240 5% 92%;
    --ring: 168 84% 39%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 240 6% 10%;
    --foreground: 0 0% 98%;
    --card: 240 5% 15%;
    --card-foreground: 0 0% 98%;
    --popover: 240 5% 15%;
    --popover-foreground: 0 0% 98%;
    --primary: 168 74% 56%;
    --primary-foreground: 240 6% 10%;
    --secondary: 240 4% 16%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 4% 16%;
    --muted-foreground: 240 4% 64%;
    --accent: 168 74% 20%;
    --accent-foreground: 168 74% 56%;
    --destructive: 0 63% 61%;
    --border: 240 4% 20%;
    --input: 240 4% 20%;
    --ring: 168 74% 56%;
  }
}

@layer base {
  * {
    @apply border-border;
  }

  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: hsl(var(--muted-foreground) / 0.3);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--muted-foreground) / 0.5);
}
```

- [ ] **Step 2: Verify the app starts**

```bash
npm run build 2>&1 | head -20
```

Expected: Build succeeds (may have warnings but no errors related to CSS).

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: add HSL CSS variables for light/dark themes (shadcn/ui tokens)"
```

---

## Task 5: Create ThemeProvider + Update Root Layout

**Files:**
- Create: `src/components/theme-provider.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/providers.tsx`

- [ ] **Step 1: Create `src/components/theme-provider.tsx`**

```typescript
"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

- [ ] **Step 2: Update `src/app/layout.tsx`**

Add `suppressHydrationWarning` to the `<html>` tag. The current file has:

```tsx
<html lang="pt-BR">
```

Change to:

```tsx
<html lang="pt-BR" suppressHydrationWarning>
```

Keep everything else unchanged.

- [ ] **Step 3: Update `src/app/providers.tsx`**

Current content:
```tsx
'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/lib/auth/context'
import { ToastProvider } from '@/lib/ui/toast'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  )
}
```

Replace with:
```tsx
'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/lib/auth/context'
import { ThemeProvider } from '@/components/theme-provider'
import { ToastProvider } from '@/lib/ui/toast'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
```

- [ ] **Step 4: Verify app builds**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/theme-provider.tsx src/app/layout.tsx src/app/providers.tsx
git commit -m "feat: add ThemeProvider (next-themes) with light/dark mode support"
```

---

## Task 6: Install shadcn/ui Base Components

**Files:**
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/ui/dropdown-menu.tsx`
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/table.tsx`
- Create: `src/components/ui/tabs.tsx`
- Create: `src/components/ui/toast.tsx`
- Create: `src/components/ui/toaster.tsx`
- Create: `src/components/ui/use-toast.ts`
- Create: `src/components/ui/tooltip.tsx`
- Create: `src/components/ui/avatar.tsx`
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/ui/separator.tsx`
- Create: `src/components/ui/popover.tsx`
- Create: `src/components/ui/sheet.tsx`
- Create: `src/components/ui/switch.tsx`

- [ ] **Step 1: Install shadcn/ui components**

```bash
cd D:/claude_code/claude_code/projetos/synkroo
npx shadcn@latest add button input badge card dialog dropdown-menu select table tabs toast tooltip avatar skeleton separator popover sheet switch
```

Note: This is interactive — accept defaults for each prompt. If any Radix dependency is missing, it installs automatically.

- [ ] **Step 2: Verify all component files exist**

```bash
ls src/components/ui/
```

Expected: 19 `.tsx` files + `use-toast.ts`.

- [ ] **Step 3: Verify app builds**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/ components.json
git commit -m "feat: install shadcn/ui base components (19 components)"
```

---

## Task 7: Wire Up shadcn/ui Toast Provider

**Files:**
- Modify: `src/app/providers.tsx`
- Modify: `src/app/layout.tsx` (add Toaster)

- [ ] **Step 1: Update `src/app/providers.tsx` to include shadcn Toaster**

Add the Toaster import and component alongside the existing ToastProvider:

```tsx
'use client'

import { ReactNode } from 'react'
import { AuthProvider } from '@/lib/auth/context'
import { ThemeProvider } from '@/components/theme-provider'
import { ToastProvider } from '@/lib/ui/toast'
import { Toaster } from '@/components/ui/toaster'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <AuthProvider>
        <ToastProvider>
          {children}
          <Toaster />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/providers.tsx
git commit -m "feat: add shadcn/ui Toaster to providers"
```

---

## Phase 1 Complete

Foundation is ready. All subsequent phases depend on:
- `cn()` utility at `src/lib/utils.ts`
- CSS variables in `globals.css`
- ThemeProvider wrapping the app
- 19 shadcn/ui base components in `src/components/ui/`
- Tailwind configured with `darkMode: "class"` and CSS variable colors
