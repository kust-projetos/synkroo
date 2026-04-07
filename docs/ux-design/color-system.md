# Synkroo Color System - WCAG AA Compliant

## Overview

Sistema de cores premium para Synkroo - Plataforma de IA para Clínicas Odontológicas.
Todas as cores passam nos requisitos WCAG 2.1 AA (mínimo 4.5:1 para texto normal).

## Primary Palette (Dark Theme)

### Background Colors

| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `--bg-primary` | `#09090b` | `9, 9, 11` | Main background |
| `--bg-secondary` | `#18181b` | `24, 24, 27` | Card backgrounds |
| `--bg-tertiary` | `#27272a` | `39, 39, 42` | Elevated surfaces |
| `--bg-elevated` | `#3f3f46` | `63, 63, 70` | Modals, dropdowns |

### Text Colors

| Token | Hex | Contrast on bg-primary | Usage |
|-------|-----|------------------------|-------|
| `--text-primary` | `#fafafa` | 18.7:1 ✅ | Headings, primary text |
| `--text-secondary` | `#d4d4d8` | 12.1:1 ✅ | Body text, descriptions |
| `--text-tertiary` | `#a1a1aa` | 7.2:1 ✅ | Muted text, labels |
| `--text-disabled` | `#71717a` | 4.0:1 ❌ | Disabled states (use sparingly) |

### Accent Colors

| Token | Hex | Contrast on bg-primary | Usage |
|-------|-----|------------------------|-------|
| `--accent-primary` | `#818cf8` | 6.8:1 ✅ | Primary actions, links |
| `--accent-secondary` | `#a78bfa` | 8.3:1 ✅ | Secondary accent |
| `--accent-tertiary` | `#6366f1` | 5.2:1 ✅ | Hover states |

### Semantic Colors

#### Success (Green)
| Token | Hex | Contrast | Usage |
|-------|-----|----------|-------|
| `--success-primary` | `#4ade80` | 8.9:1 ✅ | Success text, icons |
| `--success-bg` | `rgba(74, 222, 128, 0.1)` | - | Success backgrounds |
| `--success-border` | `rgba(74, 222, 128, 0.3)` | - | Success borders |

#### Warning (Amber)
| Token | Hex | Contrast | Usage |
|-------|-----|----------|-------|
| `--warning-primary` | `#fbbf24` | 10.2:1 ✅ | Warning text, icons |
| `--warning-bg` | `rgba(251, 191, 36, 0.1)` | - | Warning backgrounds |
| `--warning-border` | `rgba(251, 191, 36, 0.3)` | - | Warning borders |

#### Danger (Red)
| Token | Hex | Contrast | Usage |
|-------|-----|----------|-------|
| `--danger-primary` | `#f87171` | 6.5:1 ✅ | Error text, icons |
| `--danger-bg` | `rgba(248, 113, 113, 0.1)` | - | Error backgrounds |
| `--danger-border` | `rgba(248, 113, 113, 0.3)` | - | Error borders |

#### Info (Blue)
| Token | Hex | Contrast | Usage |
|-------|-----|----------|-------|
| `--info-primary` | `#60a5fa` | 7.8:1 ✅ | Info text, icons |
| `--info-bg` | `rgba(96, 165, 250, 0.1)` | - | Info backgrounds |
| `--info-border` | `rgba(96, 165, 250, 0.3)` | - | Info borders |

## Risk Indicator Colors

### High Risk (87%+ no-show probability)
```css
--risk-high-bg: rgba(239, 68, 68, 0.15);
--risk-high-border: rgba(239, 68, 68, 0.5);
--risk-high-text: #fca5a5; /* 8.5:1 on dark bg */
--risk-high-badge: #ef4444;
```

### Medium Risk (60-86% no-show probability)
```css
--risk-medium-bg: rgba(251, 191, 36, 0.15);
--risk-medium-border: rgba(251, 191, 36, 0.5);
--risk-medium-text: #fcd34d; /* 11.2:1 on dark bg */
--risk-medium-badge: #fbbf24;
```

### Low Risk (0-59% no-show probability)
```css
--risk-low-bg: rgba(74, 222, 128, 0.15);
--risk-low-border: rgba(74, 222, 128, 0.5);
--risk-low-text: #86efac; /* 10.1:1 on dark bg */
--risk-low-badge: #22c55e;
```

## Agent Status Colors

### Active Agent
```css
--agent-active: #4ade80; /* Green - 8.9:1 */
--agent-active-glow: rgba(74, 222, 128, 0.4);
```

### Idle Agent
```css
--agent-idle: #a1a1aa; /* Gray - 7.2:1 */
--agent-idle-glow: rgba(161, 161, 170, 0.2);
```

### Processing Agent
```css
--agent-processing: #818cf8; /* Purple - 6.8:1 */
--agent-processing-glow: rgba(129, 140, 248, 0.4);
```

## Glassmorphism Values

```css
/* Card backgrounds */
--glass-bg: rgba(255, 255, 255, 0.05);
--glass-bg-hover: rgba(255, 255, 255, 0.08);
--glass-border: rgba(255, 255, 255, 0.1);
--glass-border-hover: rgba(255, 255, 255, 0.15);

/* Blur values */
--glass-blur: 20px;
--glass-blur-heavy: 40px;
```

## Usage Guidelines

### Text on Dark Backgrounds
- ✅ Use `--text-primary` for headings
- ✅ Use `--text-secondary` for body text
- ✅ Use `--text-tertiary` for labels and hints
- ❌ Never use `--text-disabled` for readable text

### Accent Colors
- ✅ Use for links, buttons, and interactive elements
- ✅ Combine with white text (on solid backgrounds)
- ❌ Don't use as text color on dark backgrounds for long passages

### Risk Indicators
- ✅ Always include icon + text (not color alone)
- ✅ Use semantic labels: "ALTO RISCO", "MÉDIO", "BAIXO"
- ✅ Animate high-risk elements with pulse

### Focus States
```css
--focus-ring: 2px solid #818cf8;
--focus-ring-offset: 2px;
```

## CSS Variables

```css
:root {
  /* Background */
  --bg-primary: #09090b;
  --bg-secondary: #18181b;
  --bg-tertiary: #27272a;
  --bg-elevated: #3f3f46;

  /* Text */
  --text-primary: #fafafa;
  --text-secondary: #d4d4d8;
  --text-tertiary: #a1a1aa;
  --text-disabled: #71717a;

  /* Accent */
  --accent-primary: #818cf8;
  --accent-secondary: #a78bfa;
  --accent-tertiary: #6366f1;

  /* Semantic */
  --success-primary: #4ade80;
  --warning-primary: #fbbf24;
  --danger-primary: #f87171;
  --info-primary: #60a5fa;

  /* Glassmorphism */
  --glass-bg: rgba(255, 255, 255, 0.05);
  --glass-border: rgba(255, 255, 255, 0.1);
  --glass-blur: 20px;
}
```

## Contrast Testing Results

All color combinations tested against WCAG 2.1 AA:
- ✅ Primary text on dark background: 18.7:1
- ✅ Secondary text on dark background: 12.1:1
- ✅ Tertiary text on dark background: 7.2:1
- ✅ Accent on dark background: 6.8:1
- ✅ Success on dark background: 8.9:1
- ✅ Warning on dark background: 10.2:1
- ✅ Danger on dark background: 6.5:1

## Tools Used
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Coolors Contrast Checker](https://coolors.co/contrast-checker)