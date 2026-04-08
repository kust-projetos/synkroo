# Phase 8: Auth Pages, Landing Page, Chat Widget

**Goal:** Migrar as paginas de autenticacao (login, signup, complete-profile), a landing page (Forest Dark), e o chat widget.

**Depends on:** Phase 1

---

## Task 1: Migrate Login Page

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Read current file**

```bash
cat src/app/login/page.tsx
```

- [ ] **Step 2: Apply migration**

Current: indigo gradient background, white card, indigo buttons, demo credentials.
Replace with: teal-based palette, premium card styling.

Key changes:
- Background: `bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800` (subtle gradient)
- Card: `<Card>` with subtle shadow and `rounded-2xl`
- Logo: Teal gradient background with "S"
- Buttons: Teal primary (`bg-teal-600 hover:bg-teal-700`)
- Inputs: shadcn/ui `<Input>` with teal focus ring (automatic via CSS variables)
- Demo credentials: Keep the demo login functionality, style with muted colors

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: migrate login page to teal premium design"
```

---

## Task 2: Migrate Signup Page

**Files:**
- Modify: `src/app/signup/page.tsx`

- [ ] **Step 1: Apply same pattern as login**

Use the same visual style as login: teal palette, `<Card>`, `<Input>` from shadcn/ui.

- [ ] **Step 2: Commit**

```bash
git add src/app/signup/page.tsx
git commit -m "feat: migrate signup page to design system"
```

---

## Task 3: Migrate Complete Profile Page

**Files:**
- Modify: `src/app/complete-profile/page.tsx`

- [ ] **Step 1: Apply same pattern as login**

Use the same visual style. Form uses shadcn/ui components.

- [ ] **Step 2: Commit**

```bash
git add src/app/complete-profile/page.tsx
git commit -m "feat: migrate complete-profile page to design system"
```

---

## Task 4: Migrate Landing Page (Forest Dark)

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Read current landing page**

```bash
wc -l src/app/page.tsx
```

- [ ] **Step 2: Apply Forest Dark theme**

The landing page has a **fixed dark theme** (does not follow the dashboard theme toggle).

Key changes:
- Background: `linear-gradient(135deg, #0c1117 0%, #0a1a1a 40%, #0c2e2e 100%)`
- CTA/Nav accent: `teal-800 #115e59`
- Text accent: `teal-200 #99f6e4`
- Badge pill: `bg-[rgba(17,94,89,0.12)] border-[rgba(17,94,89,0.2)] text-[#99f6e4]`
- Buttons: `bg-teal-800 hover:bg-teal-700 text-white`
- Hero: Large heading with teal accent, subtle grid/dot pattern background
- Features: Cards with subtle borders and teal accents
- CTA: Teal gradient button with shadow
- Keep all existing sections and content structure
- Replace green/teal-400 accents with the new Forest Dark palette

- [ ] **Step 3: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: migrate landing page to Forest Dark premium design"
```

---

## Task 5: Update Chat Widget

**Files:**
- Modify: `src/lib/ui/chat-widget.tsx` (or wherever the ChatWidget component lives)

- [ ] **Step 1: Read current chat widget**

```bash
find src/ -name "*chat*" -o -name "*widget*" | head -10
```

- [ ] **Step 2: Apply changes per spec**

Key changes:
1. **Remove `primaryColor` prop** — use CSS variable `--primary` from the theme
2. **Apply dark/light mode** based on system preference (not dashboard theme)
3. **Keep** all existing props: `clinicId`, `clinicName`, `position`, `greeting`
4. **Update styling**:
   - `border-radius: 16px` on chat window
   - Avatar with teal gradient background
   - Subtle shadow instead of border
   - `bg-card` / `text-foreground` for theme support
5. **Auto-detect system theme** using `prefers-color-scheme` media query

- [ ] **Step 3: Commit**

```bash
git add src/lib/ui/chat-widget.tsx
git commit -m "feat: update chat widget to use CSS variables and theme support"
```

---

## Phase 8 Complete

All pages and components migrated:
- Auth pages (login, signup, complete-profile) with teal premium design
- Landing page with Forest Dark gradient
- Chat widget with CSS variable-based theming

---

## Final Steps

After all phases are complete:

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Manual visual review**

Start dev server and check:
1. Light theme renders correctly on all pages
2. Dark theme toggle works on all dashboard pages
3. Sidebar collapse/expand works and persists
4. Charts render in both themes
5. Landing page has Forest Dark gradient
6. Chat widget works with system theme
7. Login/Signup pages have teal palette

```bash
npm run dev
```

- [ ] **Step 3: Fix any visual regressions**

Check for:
- Hardcoded colors that should be theme-aware
- Remaining emojis that should be Heroicons
- Inline SVGs that should be Heroicons
- `bg-gray-*` / `text-gray-*` that should be semantic theme colors
- `bg-white` that should be `bg-card`
- Missing responsive breakpoints

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Synkroo UI redesign (25 pages, dark/light theme, premium design)"
```
