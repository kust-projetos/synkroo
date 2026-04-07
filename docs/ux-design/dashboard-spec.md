# Synkroo Dashboard UX Design Specification

**Version:** 1.0
**Date:** March 25, 2026
**Status:** Approved
**Author:** UX Design Team

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [User Personas](#2-user-personas)
3. [Information Architecture](#3-information-architecture)
4. [Component Library](#4-component-library)
5. [Interaction Patterns](#5-interaction-patterns)
6. [Accessibility Guidelines](#6-accessibility-guidelines)
7. [Responsive Breakpoints](#7-responsive-breakpoints)
8. [Animation & Motion](#8-animation--motion)
9. [Color System](#9-color-system)
10. [Typography System](#10-typography-system)
11. [Iconography](#11-iconography)
12. [Next Steps](#12-next-steps)

---

## 1. Overview & Goals

### 1.1 Product Context

**Synkroo** is an AI automation platform designed specifically for dental clinics in Brazil. The dashboard serves as the primary interface for clinic owners (Dentistas) to monitor, manage, and optimize their AI-powered automation systems.

### 1.2 Design Vision

Create an intuitive, data-rich dashboard that transforms complex AI operations into actionable business insights. The design must bridge the gap between technical AI capabilities and real-world dental clinic management, presenting information in terms of business value (ROI, time saved, patient satisfaction) rather than abstract technical metrics.

### 1.3 Primary Goals

| Goal | Success Metric | Priority |
|------|----------------|----------|
| **ROI Visibility** | Users can identify ROI within 5 seconds of viewing dashboard | Critical |
| **Operational Control** | Quick actions accessible within 2 clicks | Critical |
| **Trust Building** | Transparent AI behavior with clear status indicators | High |
| **Engagement** | Daily active usage with gamification elements | High |
| **Accessibility** | WCAG AA compliance (4.5:1 contrast minimum) | Required |

### 1.4 Design Principles

1. **Business-First Language** - Display metrics in R$, appointment counts, and patient satisfaction scores rather than technical AI metrics
2. **Progressive Disclosure** - Show high-level insights first, allow drill-down for details
3. **Proactive Assistance** - Surface alerts and recommendations before problems occur
4. **Delightful Simplicity** - Clean interface with thoughtful micro-interactions
5. **Trust Through Transparency** - Always show what the AI is doing and why

### 1.5 Scope

**In Scope:**
- Main dashboard view for Dentista persona
- Agent status monitoring (Router + 3 specialized agents)
- ROI and business metrics visualization
- Token usage tracking
- Quick actions panel
- Alert and notification systems
- Mobile-responsive design

**Out of Scope (Future Iterations):**
- Admin/technical configuration panels
- Multi-clinic management view
- Team collaboration features
- Advanced analytics deep-dive

---

## 2. User Personas

### 2.1 Primary Persona: Dr. Ana Santos (Dentista)

**Demographics:**
- Age: 38 years old
- Location: Sao Paulo, Brazil
- Practice: Owner of a medium-sized dental clinic (4 chairs, 8 staff)
- Technical proficiency: Moderate (uses smartphone, basic business software)

**Context:**
```
Dr. Ana runs a busy clinic and struggles with patient communication.
She's adopted Synkroo to automate appointment scheduling, follow-ups,
and basic patient inquiries. She has limited time to check systems
and needs quick, actionable information.
```

**Goals:**
- Understand if the AI investment is paying off
- Know when intervention is needed (high-risk patients, issues)
- Feel in control without being overwhelmed
- See patient satisfaction improving

**Pain Points:**
- "I don't have time to learn complex software"
- "I need to know ROI in real terms, not technical jargon"
- "I worry the AI might say something wrong to patients"
- "I'm already overwhelmed with notifications from other systems"

**Daily Journey:**

| Time | Activity | Dashboard Interaction |
|------|----------|----------------------|
| 07:30 | Morning check (mobile) | Quick glance at overnight activity, urgent alerts |
| 12:00 | Lunch break | Review ROI metrics, agent performance |
| 18:00 | End of day | Check tomorrow's schedule, any flagged patients |
| Weekly | Performance review | Deep dive into weekly metrics and trends |

**Key Questions Dashboard Must Answer:**
1. "Is the AI saving me money/time?"
2. "Are my patients happy with the AI interactions?"
3. "Do I need to intervene anywhere?"
4. "Am I going to hit my token limit?"

### 2.2 Secondary Persona: Dr. Carlos Mendes (Multi-Clinic Owner)

**Demographics:**
- Age: 52 years old
- Practice: Owner of 3 dental clinics
- Technical proficiency: Low-Moderate

**Context:**
```
Dr. Carlos has expanded to multiple locations and uses Synkroo to
maintain consistent patient communication across all clinics. He
needs higher-level oversight and comparison between locations.
```

**Goals:**
- Compare performance across clinics
- Aggregate ROI reporting
- Manage token budgets centrally
- Ensure consistent patient experience

**Note:** Multi-clinic dashboard is planned for Phase 2. Current design should anticipate future expansion.

### 2.3 Accessibility Persona: Joao (Visually Impaired User)

**Demographics:**
- Role: Clinic administrator with low vision
- Uses screen reader and high-contrast mode
- Relies on keyboard navigation

**Requirements:**
- Full keyboard accessibility
- Clear ARIA labels
- Skip links to main content
- High contrast support
- Logical heading structure

---

## 3. Information Architecture

### 3.1 Dashboard Structure

```
Dashboard
├── Header
│   ├── Logo & Branding
│   ├── Clinic Selector (future)
│   ├── Notifications
│   └── User Menu
│
├── Main Content Area
│   ├── ROI Summary Card (Primary Focal Point)
│   ├── Agent Status Panel
│   │   ├── Router Agent (Core)
│   │   ├── Scheduler Agent
│   │   ├── Sales Agent
│   │   └── Generalist Agent
│   │
│   ├── Metrics Grid
│   │   ├── Conversations Today
│   │   ├── Appointments Scheduled
│   │   ├── No-Show Risk Alerts
│   │   └── Patient Satisfaction
│   │
│   ├── Activity Feed
│   │   └── Recent AI Interactions
│   │
│   └── Quick Actions Panel
│       ├── Create Announcement
│       ├── Override Agent
│       ├── Review Pending
│       └── Export Report
│
├── Sidebar (Desktop)
│   ├── Dashboard
│   ├── Conversations
│   ├── Patients
│   ├── Analytics
│   ├── Settings
│   └── Help
│
└── Token Usage Widget
    ├── Current Usage
    ├── Projected Usage
    └── Usage Alerts
```

### 3.2 Navigation Model

**Desktop:**
- Persistent sidebar navigation
- Primary content takes 75% width
- Secondary panel (token usage) in right margin

**Mobile:**
- Bottom navigation bar with 5 primary sections
- Hamburger menu for secondary items
- Full-width content cards
- Collapsible sections

### 3.3 Content Hierarchy

**Layer 1: Immediate Actions (Above the fold)**
- ROI metric
- Critical alerts (no-show risks)
- Agent status

**Layer 2: Today's Activity**
- Conversations count
- Scheduled appointments
- Recent activity feed

**Layer 3: Insights & Trends**
- Weekly comparisons
- Token usage trends
- Achievement progress

**Layer 4: Detailed Data**
- Expandable/clickable for drill-down
- Conversation logs
- Patient-level details

### 3.4 User Flows

#### Flow 1: Daily ROI Check

```
Open Dashboard
    ↓
See ROI Card (R$ 2.450 economizado este mes)
    ↓
Click "Ver Detalhes"
    ↓
Expand ROI Breakdown
    ├── Tempo economizado: 23h
    ├── Consultas evitadas: 8
    └── Taxa de reagenda: 94%
    ↓
Close and continue
```

#### Flow 2: Responding to No-Show Alert

```
See Alert Badge on "Risco de No-Show"
    ↓
Click Alert Card
    ↓
View Patient Details
    ├── Maria Silva - 14:00
    ├── Risk Score: 85%
    └── Reason: No confirmation
    ↓
Choose Action
    ├── [Ligar Agora] → Opens phone
    ├── [Enviar WhatsApp] → Opens WhatsApp
    └── [Descartar] → Marks as handled
    ↓
Confirm Action
    ↓
See Success Toast
```

#### Flow 3: Checking Token Usage

```
View Token Widget
    ↓
See: "R$ 127 / R$ 200 usado"
    ↓
Click for Details
    ↓
View Breakdown
    ├── Scheduler Agent: 45%
    ├── Sales Agent: 30%
    ├── Generalist: 15%
    └── Router: 10%
    ↓
View Projection: "No ritmo atual: R$ 185 final do mes"
    ↓
Adjust if needed
```

---

## 4. Component Library

### 4.1 Cards

#### 4.1.1 ROI Card (Primary)

**Purpose:** Display the primary value metric - Return on Investment in Brazilian Reais.

**Anatomy:**
```
+------------------------------------------+
| ROI Este Mes                    [i]      |
|                                          |
|        R$ 2.450                          |
|        economizado                       |
|                                          |
|  +23% vs. mes anterior      [Ver Detalhes]|
+------------------------------------------+
```

**Specifications:**

| Property | Value |
|----------|-------|
| Width | 100% (mobile), 400px (desktop) |
| Height | Auto (min 160px) |
| Background | `rgba(30, 27, 75, 0.6)` (glassmorphism) |
| Border Radius | 16px |
| Padding | 24px |
| Shadow | `0 8px 32px rgba(0, 0, 0, 0.3)` |

**Typography:**
- Title: `text-sm`, `text-slate-400`, `font-medium`
- Value: `text-4xl`, `text-white`, `font-bold`
- Subtitle: `text-sm`, `text-slate-400`
- Trend: `text-sm`, `text-emerald-400`

**States:**
- **Default:** Shows current month ROI
- **Expanded:** Shows breakdown of savings components
- **Loading:** Skeleton with shimmer animation
- **Error:** Fallback message with retry button

**Interactions:**
- Click "Ver Detalhes" → Expand inline or modal
- Hover "i" icon → Show tooltip explaining calculation
- Swipe left (mobile) → Quick action shortcuts

**Accessibility:**
```html
<article
  role="region"
  aria-label="Retorno sobre investimento este mes"
  tabindex="0"
>
  <h3>ROI Este Mes</h3>
  <p class="sr-only">Dois mil, quatrocentos e cinquenta reais economizados</p>
  ...
</article>
```

#### 4.1.2 Metric Card

**Purpose:** Display individual business metrics with trend indicators.

**Anatomy:**
```
+------------------------------------------+
| [Icon]  Conversas Hoje                   |
|                                          |
|         47                               |
|         conversas                        |
|                                          |
|     +12 vs. ontem         [Sparkline]    |
+------------------------------------------+
```

**Variants:**

| Variant | Icon | Color Accent |
|---------|------|--------------|
| Conversations | MessageCircle | indigo-400 |
| Appointments | Calendar | emerald-400 |
| Alerts | AlertTriangle | amber-400 |
| Satisfaction | Star | yellow-400 |

**Sparkline Specifications:**
- Width: 60px
- Height: 24px
- Stroke: 2px
- Color: Matches card accent
- Points: Last 7 days of data
- Animation: Draw on scroll into view

#### 4.1.3 Activity Card

**Purpose:** Show recent AI interactions in a scrollable feed.

**Anatomy:**
```
+------------------------------------------+
| Atividade Recente              [Ver Tudo] |
|                                          |
| +----------------------------------------+|
| | 14:32  Maria Silva                      ||
| |        Agendamento confirmado           ||
| |        [Scheduler Agent]                ||
| +----------------------------------------+|
|                                          |
| +----------------------------------------+|
| | 14:28  Jose Santos                      ||
| |        Duvida sobre procedimento        ||
| |        [Generalist Agent]               ||
| +----------------------------------------+|
|                                          |
| ... mais 23 conversas                     |
+------------------------------------------+
```

**Item Specifications:**

| Property | Value |
|----------|-------|
| Max Items Visible | 5 |
| Scrollable | Yes |
| Item Height | 72px |
| Item Padding | 12px |
| Divider | 1px, `rgba(148, 163, 184, 0.1)` |

**Agent Badge Colors:**

| Agent | Badge Color | Text |
|-------|-------------|------|
| Router | `bg-indigo-500/20 text-indigo-300` | Router |
| Scheduler | `bg-emerald-500/20 text-emerald-300` | Agendamentos |
| Sales | `bg-purple-500/20 text-purple-300` | Vendas |
| Generalist | `bg-slate-500/20 text-slate-300` | Geral |

#### 4.1.4 Alert Card

**Purpose:** Display actionable alerts requiring user attention.

**Anatomy:**
```
+------------------------------------------+
| [!]  Risco de No-Show            [3]     |
|                                          |
| Maria Silva - 14:00 (85% risco)          |
| Motivo: Sem confirmacao                  |
|                                          |
| [Ligar]  [WhatsApp]  [Descartar]         |
+------------------------------------------+
```

**Alert Severity Colors:**

| Severity | Border | Icon Color | Background |
|----------|--------|------------|------------|
| Critical | `border-red-500` | `text-red-400` | `bg-red-500/10` |
| High | `border-amber-500` | `text-amber-400` | `bg-amber-500/10` |
| Medium | `border-yellow-500` | `text-yellow-400` | `bg-yellow-500/10` |
| Low | `border-blue-500` | `text-blue-400` | `bg-blue-500/10` |

**Interactions:**
- Click patient name → Opens patient details modal
- Click "Ligar" → Triggers phone call with confirmation
- Click "WhatsApp" → Opens WhatsApp with pre-filled message
- Click "Descartar" → Shows confirmation dialog

### 4.2 Navigation

#### 4.2.1 Sidebar Navigation (Desktop)

**Anatomy:**
```
+------------------+
|   [Logo]         |
|   Synkroo        |
|                  |
| [Dashboard]  <-- |
| [Conversas]      |
| [Pacientes]      |
| [Analytics]      |
|                  |
| -----            |
|                  |
| [Configuracoes]  |
| [Ajuda]          |
|                  |
+------------------+
```

**Specifications:**

| Property | Value |
|----------|-------|
| Width | 240px |
| Background | `rgba(15, 23, 42, 0.8)` |
| Item Height | 48px |
| Active Indicator | Left border 3px, `bg-indigo-500` |
| Hover | `bg-white/5` |

**Navigation Items:**

| Item | Icon | Badge? | Keyboard Shortcut |
|------|------|--------|-------------------|
| Dashboard | LayoutDashboard | No | `Ctrl+D` |
| Conversas | MessageCircle | Yes (count) | `Ctrl+C` |
| Pacientes | Users | No | `Ctrl+P` |
| Analytics | BarChart3 | No | `Ctrl+A` |
| Configuracoes | Settings | No | `Ctrl+,` |
| Ajuda | HelpCircle | No | `Ctrl+?` |

#### 4.2.2 Bottom Navigation (Mobile)

**Anatomy:**
```
+------------------------------------------------+
|  [Home]   [Conversas]   [+]   [Pacientes]  [Perfil] |
|   Dashboard   Messages   Quick   Patients   Profile  |
+------------------------------------------------+
```

**Specifications:**

| Property | Value |
|----------|-------|
| Height | 64px + safe-area-inset-bottom |
| Background | `rgba(15, 23, 42, 0.95)` |
| Blur | `backdrop-blur-xl` |
| Item Width | 20% (equal distribution) |
| Active Color | `#818cf8` (indigo-400) |

**Quick Action Button (Center):**
- Diameter: 56px
- Elevation: 8dp
- Color: `#818cf8`
- Icon: Plus
- Tap → Opens quick action sheet
- Long press → Voice command (future)

### 4.3 Feedback Components

#### 4.3.1 Toast Notifications

**Purpose:** Provide brief, non-blocking feedback for user actions.

**Anatomy:**
```
+------------------------------------------+
| [Check]  Acao realizada com sucesso      |
|                              [Desfazer]  |
+------------------------------------------+
```

**Types:**

| Type | Icon | Background | Duration |
|------|------|------------|----------|
| Success | Check | `bg-emerald-500/20 border-emerald-500` | 4s |
| Error | X | `bg-red-500/20 border-red-500` | 6s |
| Warning | AlertTriangle | `bg-amber-500/20 border-amber-500` | 5s |
| Info | Info | `bg-blue-500/20 border-blue-500` | 4s |

**Position:** Top-center, stacked (max 3 visible)

**Interactions:**
- Swipe right → Dismiss
- Click "Desfazer" → Triggers undo action, dismisses toast
- Click elsewhere → No action (toast remains)

**Animation:**
```
Enter: slideDown(0.3s, easeOut) + fadeIn(0.2s)
Exit: slideUp(0.2s, easeIn) + fadeOut(0.15s)
```

#### 4.3.2 Confirmation Dialog

**Purpose:** Confirm destructive or significant actions.

**Anatomy:**
```
+------------------------------------------+
|                                          |
|           [Warning Icon]                 |
|                                          |
|     Descartar alerta de risco?           |
|                                          |
|  Esta acao removera o alerta da lista.   |
|  Voce pode reabrir a partir do historico.|
|                                          |
|     [Cancelar]     [Descartar]           |
|                                          |
+------------------------------------------+
```

**Specifications:**

| Property | Value |
|----------|-------|
| Max Width | 400px |
| Overlay | `bg-black/60 backdrop-blur-sm` |
| Background | `bg-slate-900 border border-slate-700` |
| Border Radius | 16px |
| Padding | 32px |

**Button Styles:**

| Button | Style | Keyboard |
|--------|-------|----------|
| Primary (destructive) | `bg-red-500 hover:bg-red-600` | Enter (when focused) |
| Secondary | `bg-slate-700 hover:bg-slate-600` | Escape |

**Accessibility:**
- Focus trap within dialog
- Escape key closes dialog
- Initial focus on destructive action
- ARIA role="alertdialog"
- aria-describedby points to description

#### 4.3.3 Loading States

**Skeleton Screens:**

```
+------------------------------------------+
| ████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ |
|                                          |
| ██████████                               |
| ████████████████████████████████████████ |
|                                          |
| ████████████        ████████████████████ |
+------------------------------------------+
```

**Skeleton Specifications:**
- Background: `bg-slate-800`
- Shimmer: Linear gradient animation
- Animation duration: 1.5s
- Border radius matches content

**Spinner (for actions):**
- Size: 24px (inline), 40px (overlay)
- Color: `#818cf8`
- Animation: Rotate 360deg, 0.8s linear infinite

### 4.4 Charts & Data Visualization

#### 4.4.1 Sparklines

**Purpose:** Show trend at a glance within metric cards.

**Configuration:**
```javascript
{
  width: 60,
  height: 24,
  stroke: '#818cf8',
  strokeWidth: 2,
  fill: 'rgba(129, 140, 248, 0.1)',
  points: 7, // 7 days
  animation: {
    type: 'draw',
    duration: 800,
    easing: 'ease-out'
  }
}
```

**Colors by Metric:**
| Metric | Stroke | Fill |
|--------|--------|------|
| ROI | `#818cf8` (indigo) | `rgba(129, 140, 248, 0.1)` |
| Conversations | `#a78bfa` (purple) | `rgba(167, 139, 250, 0.1)` |
| Appointments | `#34d399` (emerald) | `rgba(52, 211, 153, 0.1)` |
| Alerts | `#fbbf24` (amber) | `rgba(251, 191, 36, 0.1)` |

#### 4.4.2 Line Chart (Detail View)

**Purpose:** Show detailed metric trends over time.

**Anatomy:**
```
R$ Valor
|
|     •─────•─────•
|    /           \
|   •             •─────•
|  /
| •────────────────────────
+-------------------------→
   Seg Ter Qua Qui Sex Sab
```

**Specifications:**

| Property | Value |
|----------|-------|
| Chart Height | 200px |
| Padding | 16px all sides |
| Grid Lines | Horizontal only, `rgba(148, 163, 184, 0.1)` |
| Tooltip | On hover, shows exact value |
| Responsive | Yes, maintains aspect ratio |

**Interactions:**
- Hover on point → Show tooltip with date, value, context
- Click and drag → Zoom to time range
- Pinch (mobile) → Zoom
- Double-click → Reset zoom

#### 4.4.3 Token Usage Gauge

**Purpose:** Show current token consumption vs. budget.

**Anatomy:**
```
+------------------------------------------+
|          Tokens Usados                    |
|                                          |
|             ╭───────╮                    |
|           ╱         ╲                   |
|          │    63%    │                   |
|           ╲    R$    ╱                   |
|             ╰───────╯                    |
|                                          |
|     R$ 127    de    R$ 200              |
|                                          |
|     Projetado: R$ 185 final do mes       |
+------------------------------------------+
```

**Gauge Specifications:**
- Type: Semi-circular
- Size: 120px x 60px
- Background arc: `bg-slate-700`
- Foreground arc: Gradient based on percentage

**Color Thresholds:**

| Usage % | Arc Color | Status |
|---------|-----------|--------|
| 0-50% | `#34d399` (emerald) | Good |
| 50-75% | `#fbbf24` (amber) | Moderate |
| 75-90% | `#f97316` (orange) | Warning |
| 90-100% | `#ef4444` (red) | Critical |

---

## 5. Interaction Patterns

### 5.1 Confirmation Flows

#### 5.1.1 Destructive Action Confirmation

**When to Use:**
- Dismissing patient alerts
- Canceling appointments
- Overriding AI decisions
- Deleting any data

**Pattern:**

```
1. User triggers action (e.g., clicks "Descartar" on alert)
   ↓
2. System shows confirmation dialog
   ├── Clear, simple title
   ├── Explanation of consequences
   ├── Cancel (secondary) + Confirm (primary/destructive)
   └── Focus on Cancel by default
   ↓
3a. User cancels → Dialog closes, no action taken
3b. User confirms → Action executes, success toast shows
   ↓
4. Toast includes "Desfazer" option (if reversible)
```

**Example Flow: Dismissing No-Show Alert**

```
User: Clicks "Descartar" on Maria Silva alert

System: Shows dialog
┌─────────────────────────────────────┐
│                                     │
│         [Warning Icon]              │
│                                     │
│   Descartar alerta de risco?        │
│                                     │
│   Maria Silva - 14:00 sera removida │
│   da lista de alertas. Voce pode    │
│   reabrir no historico.             │
│                                     │
│   [Cancelar]    [Descartar mesmo]   │
│                                     │
└─────────────────────────────────────┘

User: Clicks "Descartar mesmo"

System:
1. Closes dialog
2. Removes alert from list (with animation)
3. Shows toast:
   ┌─────────────────────────────────────┐
   | [Check] Alerta descartado  [Desfazer]|
   └─────────────────────────────────────┘

User: (Optional) Clicks "Desfazer"

System:
1. Restores alert to list
2. Shows toast: "Alerta restaurado"
```

#### 5.1.2 Non-Destructive Confirmation

**When to Use:**
- Exporting reports
- Sending bulk messages
- Starting/stopping agents

**Pattern:**

```
1. User triggers action
   ↓
2. System shows confirmation with preview (if applicable)
   ├── What will happen
   ├── Estimated time/impact
   ├── Cancel + Confirm
   └── Focus on Confirm by default
   ↓
3. User confirms → Action executes with progress indicator
   ↓
4. Completion notification with result summary
```

### 5.2 Undo Pattern

**Purpose:** Allow users to reverse recent actions within a short time window.

**Applicable Actions:**
- Dismissing alerts
- Marking conversations as handled
- Changing agent status
- Bulk actions

**Implementation:**

```javascript
// Action with undo capability
function dismissAlert(alertId) {
  // 1. Store previous state
  const previousState = {
    alertId,
    timestamp: Date.now()
  };

  // 2. Perform action
  removeAlertFromUI(alertId);

  // 3. Show toast with undo
  showToast({
    message: 'Alerta descartado',
    action: 'Desfazer',
    onAction: () => {
      restoreAlert(alertId);
      showToast({ message: 'Alerta restaurado' });
    },
    duration: 5000 // 5 second window
  });

  // 4. After duration, commit action permanently
  setTimeout(() => {
    if (!undone) {
      permanentlyDismissAlert(alertId);
    }
  }, 5000);
}
```

**Toast with Undo:**

```
+------------------------------------------+
| [Check]  Alerta descartado   [Desfazer]  |
+------------------------------------------+
                                    ↓ 5s
+------------------------------------------+
| [Check]  Alerta descartado               |  (Undo option fades)
+------------------------------------------+
```

### 5.3 Loading States

#### 5.3.1 Initial Page Load

**Pattern:**

```
1. User navigates to page
   ↓
2. Show skeleton screen (not spinner)
   ├── Matches actual content layout
   ├── Subtle shimmer animation
   └── No jarring layout shift when content loads
   ↓
3. Content loads progressively
   ├── Critical content first (ROI, alerts)
   ├── Then secondary content (activity feed)
   └── Each section animates in
   ↓
4. All content loaded, skeletons removed
```

**Skeleton Placement:**

```
+------------------------------------------+
| [████████████████████] ROI Card          |
|                                          |
| [Metric Card Skeleton] [Metric Card Skele│
|                                          |
| [██████████████████████████████████████] │
| [██████████████████████████████████████] │
| Activity Feed Skeleton                   |
|                                          |
+------------------------------------------+
```

#### 5.3.2 Action Loading

**Pattern for Quick Actions (< 2s):**

```
1. User clicks button
   ↓
2. Button shows inline spinner
   ├── Button becomes disabled
   ├── Spinner replaces icon
   └── Button opacity: 0.7
   ↓
3. Action completes
   ├── Spinner becomes success icon
   └── Button returns to normal state
```

**Pattern for Longer Actions (> 2s):**

```
1. User initiates action
   ↓
2. Show overlay with progress
   ├── Dim background
   ├── Progress bar or spinner
   ├── Estimated time
   └── Cancel option (if applicable)
   ↓
3. Progress updates
   ↓
4. Completion notification
```

### 5.4 Error Handling

#### 5.4.1 Error Toast

```
+------------------------------------------+
| [X]  Erro ao carregar dados              |
|                           [Tentar Again] |
+------------------------------------------+
```

**Behavior:**
- Longer duration (6s)
- Always includes retry option
- Logs to console for debugging
- Reports to error tracking service

#### 5.4.2 Empty States

```
+------------------------------------------+
|                                          |
|           [Empty Inbox Icon]             |
|                                          |
|        Nenhuma conversa pendente         |
|                                          |
|     As novas conversas aparecerao aqui   |
|                                          |
+------------------------------------------+
```

**When to Show:**
- No data available
- No results from search/filter
- First-time user (onboarding)

**Components:**
- Relevant icon (not generic)
- Clear message
- Optional: Action to create/get data

---

## 6. Accessibility Guidelines

### 6.1 Compliance Target

**WCAG 2.1 Level AA** including:
- 4.5:1 contrast ratio for normal text
- 3:1 contrast ratio for large text and UI components
- Full keyboard navigation
- Screen reader support

### 6.2 Keyboard Navigation

#### 6.2.1 Focus Order

**Logical Tab Order:**
```
1. Skip to main content link
2. Sidebar/Navigation
3. Main content (top to bottom, left to right)
4. Interactive elements within sections
5. Footer actions
```

#### 6.2.2 Keyboard Shortcuts

| Action | Shortcut | Context |
|--------|----------|---------|
| Go to Dashboard | `Ctrl+D` | Global |
| Go to Conversations | `Ctrl+C` | Global |
| Go to Patients | `Ctrl+P` | Global |
| Search | `Ctrl+K` | Global |
| Quick Action | `Ctrl+N` | Global |
| Close modal/dialog | `Escape` | Modal open |
| Undo last action | `Ctrl+Z` | Within undo window |
| Refresh data | `Ctrl+R` | Dashboard |

#### 6.2.3 Focus Indicators

**Visible Focus Ring:**
```css
*:focus-visible {
  outline: 2px solid #818cf8;
  outline-offset: 2px;
}
```

**Focus Trap:**
- Modals trap focus within
- Escape releases focus trap
- First focusable element auto-focused

### 6.3 Screen Reader Support

#### 6.3.1 ARIA Labels

**Required Labels:**

```html
<!-- ROI Card -->
<article
  role="region"
  aria-label="Retorno sobre investimento"
  aria-live="polite"
>
  <h3 id="roi-title">ROI Este Mes</h3>
  <p aria-labelledby="roi-title">
    <span class="sr-only">Valor economizado:</span>
    <span>R$ 2.450</span>
  </p>
</article>

<!-- Alert List -->
<ul role="list" aria-label="Alertas de risco de no-show">
  <li role="listitem" aria-label="Alerta para Maria Silva, risco 85%">
    ...
  </li>
</ul>

<!-- Agent Status -->
<dl aria-label="Status dos agentes de IA">
  <div role="listitem">
    <dt>Router Agent</dt>
    <dd aria-label="Status: ativo">Ativo</dd>
  </div>
</dl>
```

#### 6.3.2 Live Regions

**For Dynamic Updates:**

```html
<!-- New alert appears -->
<div role="alert" aria-live="assertive">
  Novo alerta: Maria Silva apresenta alto risco de no-show
</div>

<!-- Metric updates -->
<div role="status" aria-live="polite" aria-atomic="true">
  Conversas atualizadas para 47
</div>
```

### 6.4 Color & Contrast

#### 6.4.1 Text Contrast Ratios

| Text Type | Foreground | Background | Ratio |
|-----------|------------|------------|-------|
| Primary text | `#f8fafc` (slate-50) | `#0f172a` (slate-900) | 15.1:1 |
| Secondary text | `#94a3b8` (slate-400) | `#0f172a` | 4.8:1 |
| Muted text | `#64748b` (slate-500) | `#0f172a` | 3.5:1 |
| Accent text | `#818cf8` (indigo-400) | `#0f172a` | 5.2:1 |

#### 6.4.2 Interactive Element Contrast

| Element | Normal | Hover | Focus | Disabled |
|---------|--------|-------|-------|----------|
| Primary button | 4.8:1 | 5.2:1 | 5.5:1 | 2.5:1 |
| Links | 5.2:1 | 5.8:1 | 6.1:1 | N/A |
| Focus ring | 5.5:1 | N/A | N/A | N/A |

#### 6.4.3 Non-Text Contrast

| Element | Foreground | Background | Ratio |
|---------|------------|------------|-------|
| Icons (active) | `#818cf8` | `#0f172a` | 5.2:1 |
| Icons (inactive) | `#64748b` | `#0f172a` | 3.5:1 |
| Chart lines | `#818cf8` | Card bg | 4.2:1 |
| Dividers | `#334155` | `#0f172a` | 2.8:1 |

### 6.5 Skip Links

**Implementation:**

```html
<body>
  <a href="#main-content" class="skip-link">
    Pular para o conteudo principal
  </a>

  <nav>...</nav>

  <main id="main-content" tabindex="-1">
    <!-- Dashboard content -->
  </main>
</body>
```

**CSS:**

```css
.skip-link {
  position: absolute;
  top: -100px;
  left: 0;
  padding: 16px 24px;
  background: #818cf8;
  color: white;
  z-index: 1000;
  transition: top 0.2s;
}

.skip-link:focus {
  top: 0;
}
```

---

## 7. Responsive Breakpoints

### 7.1 Breakpoint Definitions

| Name | Min Width | Max Width | Target Devices |
|------|-----------|-----------|----------------|
| xs | 0 | 479px | Small phones |
| sm | 480px | 767px | Large phones |
| md | 768px | 1023px | Tablets |
| lg | 1024px | 1279px | Small laptops |
| xl | 1280px | 1535px | Desktops |
| 2xl | 1536px | Infinity | Large monitors |

### 7.2 Layout Adaptations

#### 7.2.1 Mobile (xs, sm)

**Layout:**
```
+------------------+
|      Header      |
+------------------+
|                  |
|   ROI Card       |
|   (full width)   |
|                  |
+------------------+
|  Metric Grid     |
|  (2 columns)     |
+------------------+
|                  |
|  Agent Status    |
|  (horizontal)    |
|                  |
+------------------+
|                  |
|  Activity Feed   |
|                  |
+------------------+
|  Quick Actions   |
+------------------+
|  Token Widget    |
+------------------+
|  Bottom Nav      |
+------------------+
```

**Adaptations:**
- Sidebar hidden → Bottom navigation
- Cards stack vertically
- Metrics in 2-column grid
- Agent status horizontal scroll
- Token widget collapsed to badge

#### 7.2.2 Tablet (md)

**Layout:**
```
+------------------+------------------+
|      Header                        |
+------------------+------------------+
|                   |                  |
|   ROI Card        |  Token Widget    |
|                   |                  |
+-------------------+------------------+
|  Metric Grid (4 columns)           |
+-------------------+------------------+
|                   |                  |
|  Agent Status     |  Activity Feed   |
|                   |                  |
+-------------------+------------------+
|       Quick Actions Panel          |
+-------------------------------------+
|           Bottom Nav                |
+-------------------------------------+
```

**Adaptations:**
- Optional sidebar (toggleable)
- Bottom nav still present
- 4-column metric grid
- Side-by-side agent status and activity

#### 7.2.3 Desktop (lg, xl, 2xl)

**Layout:**
```
+--------+-------------------------------------+
|        |            Header                   |
|  Side  +-------------------------------------+
|  bar   |                                      |
|        |   ROI Card        |  Token Widget    |
|        |                    |                  |
|        +--------------------+-----------------+
|        |  Metric Grid (4 columns)            |
|        +-------------------------------------+
|        |                   |                  |
|        |  Agent Status     |  Activity Feed   |
|        |                   |                  |
|        +-------------------+-----------------+
|        |       Quick Actions Panel           |
|        +-------------------------------------+
|        |                                      |
+--------+--------------------------------------+
```

**Adaptations:**
- Persistent sidebar
- No bottom nav
- 4-column metrics
- Optimal use of horizontal space

### 7.3 Touch vs. Mouse Targets

#### 7.3.1 Touch Targets (Mobile/Tablet)

**Minimum Size:** 44x44px

| Element | Mobile Size | Spacing |
|---------|-------------|---------|
| Buttons | 48x48px | 8px |
| Icons | 44x44px | 8px |
| List items | 56-72px height | 8px |
| Bottom nav items | 64x64px | 0px |

#### 7.3.2 Mouse Targets (Desktop)

**Minimum Size:** 24x24px

| Element | Desktop Size | Spacing |
|---------|--------------|---------|
| Buttons | 36x36px | 4px |
| Icons | 24x24px | 4px |
| List items | 48-56px height | 4px |
| Sidebar items | 48x48px | 4px |

### 7.4 Orientation Support

**Portrait (Default):**
- Optimized for portrait layouts
- Scroll-based navigation

**Landscape:**
- Tablet landscape shows sidebar
- Mobile landscape keeps bottom nav
- Optimized chart widths

---

## 8. Animation & Motion

### 8.1 Animation Principles

1. **Purposeful** - Every animation serves a purpose
2. **Quick** - Animations complete in < 300ms
3. **Natural** - Use easing curves that feel organic
4. **Consistent** - Same animation patterns throughout
5. **Accessible** - Respect `prefers-reduced-motion`

### 8.2 Timing Functions

| Curve | Use Case | CSS Value |
|-------|----------|-----------|
| Ease-out | Entering elements | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Ease-in | Exiting elements | `cubic-bezier(0.4, 0, 1, 1)` |
| Ease-in-out | State changes | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Spring | Playful interactions | `cubic-bezier(0.34, 1.56, 0.64, 1)` |

### 8.3 Standard Durations

| Animation Type | Duration | Examples |
|----------------|----------|----------|
| Micro-interactions | 100-150ms | Button hover, icon swap |
| Simple transitions | 150-200ms | Dropdown open, tab switch |
| Complex transitions | 200-300ms | Modal open, card expand |
| Emphasis animations | 300-500ms | Success celebration, alert pulse |
| Page transitions | 300-400ms | Route changes |

### 8.4 Animation Catalog

#### 8.4.1 Card Hover

```css
.card {
  transition: transform 0.2s ease-out, box-shadow 0.2s ease-out;
}

.card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
}
```

#### 8.4.2 Button Press

```css
.button:active {
  transform: scale(0.97);
  transition: transform 0.1s ease-out;
}
```

#### 8.4.3 Toast Entry/Exit

```css
/* Entry */
@keyframes toast-enter {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Exit */
@keyframes toast-exit {
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(-100%);
    opacity: 0;
  }
}

.toast-enter {
  animation: toast-enter 0.3s ease-out;
}

.toast-exit {
  animation: toast-exit 0.2s ease-in;
}
```

#### 8.4.4 Skeleton Shimmer

```css
@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

.skeleton {
  background: linear-gradient(
    90deg,
    rgba(148, 163, 184, 0.1) 25%,
    rgba(148, 163, 184, 0.2) 50%,
    rgba(148, 163, 184, 0.1) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
```

#### 8.4.5 Success Celebration

```css
@keyframes celebrate {
  0% { transform: scale(1); }
  25% { transform: scale(1.1); }
  50% { transform: scale(0.95); }
  100% { transform: scale(1); }
}

.celebrate {
  animation: celebrate 0.4s ease-in-out;
}
```

### 8.5 Reduced Motion

**Implementation:**

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Fallbacks:**
- Animations become instant
- Transitions become immediate
- Shimmer becomes static gray
- Charts draw instantly

---

## 9. Color System

### 9.1 Color Philosophy

**Dark Theme Foundation:**
- Primary dark background reduces eye strain during extended use
- Glassmorphism adds depth without harsh borders
- Purple/indigo accents align with AI/tech brand perception
- High contrast for accessibility

### 9.2 Primary Palette

#### 9.2.1 Background Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#0f172a` | Page background |
| `--bg-elevated` | `#1e1b4b` | Cards, elevated surfaces |
| `--bg-overlay` | `rgba(0, 0, 0, 0.6)` | Modal overlays |
| `--bg-glass` | `rgba(30, 27, 75, 0.6)` | Glassmorphism cards |

#### 9.2.2 Brand Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--brand-primary` | `#818cf8` | Primary accent, links, CTAs |
| `--brand-secondary` | `#a78bfa` | Secondary accent, highlights |
| `--brand-tertiary` | `#c4b5fd` | Tertiary elements, disabled |

#### 9.2.3 Semantic Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--success` | `#34d399` | Success states, positive metrics |
| `--warning` | `#fbbf24` | Warnings, moderate alerts |
| `--error` | `#ef4444` | Errors, critical alerts |
| `--info` | `#60a5fa` | Information, neutral alerts |

### 9.3 Agent-Specific Colors

| Agent | Primary | Background | Usage |
|-------|---------|------------|-------|
| Router | `#818cf8` (indigo-400) | `rgba(129, 140, 248, 0.1)` | Status badges, mentions |
| Scheduler | `#34d399` (emerald-400) | `rgba(52, 211, 153, 0.1)` | Scheduling-related UI |
| Sales | `#a78bfa` (purple-400) | `rgba(167, 139, 250, 0.1)` | Sales/conversion UI |
| Generalist | `#94a3b8` (slate-400) | `rgba(148, 163, 184, 0.1)` | General queries |

### 9.4 Text Colors

| Token | Value | Usage | Contrast Ratio |
|-------|-------|-------|----------------|
| `--text-primary` | `#f8fafc` | Primary text, headings | 15.1:1 |
| `--text-secondary` | `#94a3b8` | Secondary text, labels | 4.8:1 |
| `--text-muted` | `#64748b` | Muted text, hints | 3.5:1 |
| `--text-accent` | `#818cf8` | Accent text, links | 5.2:1 |

### 9.5 Gradient Definitions

#### 9.5.1 Card Gradients

```css
/* Primary card gradient */
--gradient-card:
  linear-gradient(
    135deg,
    rgba(129, 140, 248, 0.1) 0%,
    rgba(167, 139, 250, 0.05) 100%
  );

/* ROI card special gradient */
--gradient-roi:
  linear-gradient(
    135deg,
    rgba(129, 140, 248, 0.15) 0%,
    rgba(52, 211, 153, 0.1) 100%
  );
```

#### 9.5.2 Accent Gradients

```css
/* Button gradient */
--gradient-button:
  linear-gradient(
    135deg,
    #818cf8 0%,
    #a78bfa 100%
  );

/* Chart gradient */
--gradient-chart:
  linear-gradient(
    180deg,
    rgba(129, 140, 248, 0.3) 0%,
    rgba(129, 140, 248, 0) 100%
  );
```

### 9.6 Dark Mode Considerations

**Current Implementation:** Dark mode only (primary interface)

**Future Light Mode Support:**
- All colors defined as CSS custom properties
- Light mode palette prepared but not implemented
- Toggle planned for accessibility preferences

---

## 10. Typography System

### 10.1 Font Stack

**Primary Font:** Inter

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
  'Helvetica Neue', Arial, sans-serif;
```

**Monospace Font:** JetBrains Mono (for code/logs)

```css
--font-mono: 'JetBrains Mono', 'Fira Code', Consolas, Monaco, monospace;
```

### 10.2 Type Scale

| Name | Size | Line Height | Letter Spacing | Weight | Usage |
|------|------|-------------|----------------|--------|-------|
| display-2xl | 72px | 1.0 | -0.02em | 700 | Hero metrics (ROI) |
| display-xl | 60px | 1.1 | -0.02em | 700 | Large numbers |
| display-lg | 48px | 1.1 | -0.01em | 600 | Section headings |
| heading-xl | 36px | 1.2 | -0.01em | 600 | Card headings |
| heading-lg | 30px | 1.2 | 0 | 600 | Subsection headings |
| heading-md | 24px | 1.3 | 0 | 500 | Small headings |
| body-xl | 20px | 1.5 | 0 | 400 | Large body text |
| body-lg | 18px | 1.5 | 0 | 400 | Body text (large) |
| body-md | 16px | 1.5 | 0 | 400 | Body text (default) |
| body-sm | 14px | 1.5 | 0 | 400 | Secondary text |
| caption | 12px | 1.4 | 0.02em | 500 | Labels, captions |
| overline | 10px | 1.6 | 0.1em | 600 | Overlines, tags |

### 10.3 Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Light | 300 | Large display text |
| Regular | 400 | Body text |
| Medium | 500 | Emphasized body, subheadings |
| Semibold | 600 | Headings, buttons |
| Bold | 700 | Large headings, hero text |

### 10.4 Typography in Context

#### 10.4.1 ROI Card Typography

```
ROI Este Mes                    ← caption, 500, slate-400
R$ 2.450                        ← display-2xl, 700, white
economizado                     ← body-lg, 400, slate-400
+23% vs. mes anterior           ← body-sm, 500, emerald-400
```

#### 10.4.2 Metric Card Typography

```
[Icon]  Conversas Hoje          ← body-sm, 500, slate-400
47                              ← heading-xl, 700, white
conversas                       ← body-sm, 400, slate-500
+12 vs. ontem                   ← caption, 500, emerald-400
```

#### 10.4.3 Activity Item Typography

```
14:32  Maria Silva              ← body-sm, 500, white
      Agendamento confirmado     ← body-sm, 400, slate-400
      [Scheduler Agent]          ← caption, 500, emerald-400
```

### 10.5 Number Formatting

**Currency (BRL):**
- Format: `R$ X.XXX`
- No cents for values > R$ 100
- Cents for values < R$ 100: `R$ 45,50`

**Percentages:**
- Format: `XX%` or `+XX%`
- No decimal places

**Counts:**
- Format with dots: `1.234`
- Short form for large: `1.2k`, `1.5M`

---

## 11. Iconography

### 11.1 Icon Library

**Primary Library:** Lucide Icons (consistent stroke width, tree-shakeable)

**Alternative:** Phosphor Icons (if needed for missing icons)

### 11.2 Icon Sizes

| Size | Dimensions | Usage |
|------|------------|-------|
| xs | 12px | Inline with text |
| sm | 16px | Buttons, badges |
| md | 20px | List items, cards |
| lg | 24px | Navigation, headings |
| xl | 32px | Feature icons |
| 2xl | 48px | Empty states |
| 3xl | 64px | Hero sections |

### 11.3 Icon Catalog

#### 11.3.1 Navigation Icons

| Icon Name | Usage | Size |
|-----------|-------|------|
| `layout-dashboard` | Dashboard | lg |
| `message-circle` | Conversations | lg |
| `users` | Patients | lg |
| `bar-chart-3` | Analytics | lg |
| `settings` | Settings | lg |
| `help-circle` | Help | lg |

#### 11.3.2 Metric Icons

| Icon Name | Usage | Color |
|-----------|-------|-------|
| `trending-up` | ROI | emerald-400 |
| `message-circle` | Conversations | indigo-400 |
| `calendar` | Appointments | emerald-400 |
| `alert-triangle` | Alerts | amber-400 |
| `star` | Satisfaction | yellow-400 |
| `zap` | Tokens | purple-400 |

#### 11.3.3 Action Icons

| Icon Name | Usage | Context |
|-----------|-------|---------|
| `plus` | Quick action | Primary CTA |
| `phone` | Call patient | Alert action |
| `message-square` | WhatsApp | Alert action |
| `x` | Dismiss/close | Cancel action |
| `check` | Confirm/success | Confirmations |
| `refresh-cw` | Refresh/undo | Data refresh |
| `download` | Export | Reports |
| `edit` | Edit | Modifications |

#### 11.3.4 Status Icons

| Icon Name | Status | Color |
|-----------|--------|-------|
| `check-circle` | Active/Success | emerald-400 |
| `alert-circle` | Warning | amber-400 |
| `x-circle` | Error | red-400 |
| `pause-circle` | Paused | slate-400 |
| `loader` | Loading | indigo-400 |

### 11.4 Icon Accessibility

**Decorative Icons:**
```html
<Icon name="trending-up" aria-hidden="true" />
```

**Functional Icons:**
```html
<button aria-label="Atualizar dados">
  <Icon name="refresh-cw" aria-hidden="true" />
</button>
```

**Status Icons with Labels:**
```html
<span role="status" aria-label="Status: ativo">
  <Icon name="check-circle" aria-hidden="true" />
  <span>Ativo</span>
</span>
```

---

## 12. Next Steps

### 12.1 Immediate Actions

| Priority | Action | Owner | Deadline |
|----------|--------|-------|----------|
| 1 | Create high-fidelity mockups in Figma | UX Designer | Week 1 |
| 2 | Conduct usability testing with 3 Dentistas | UX Researcher | Week 2 |
| 3 | Design component library in Figma | UX Designer | Week 2 |
| 4 | Create interactive prototype | UX Designer | Week 3 |
| 5 | Review and finalize specifications | Product + UX | Week 3 |

### 12.2 Handoff Requirements

**For Development:**

1. **Figma File** with:
   - All screen variants (desktop, tablet, mobile)
   - Component library with variants
   - Design tokens exported
   - Interaction annotations

2. **Asset Export:**
   - Icons in SVG format
   - Logo variations
   - Illustrations (if any)

3. **Documentation:**
   - This specification document
   - Accessibility checklist
   - Animation timing documentation

### 12.3 Design Tokens Export

**Format:** JSON for Tailwind CSS integration

```json
{
  "colors": {
    "brand": {
      "primary": "#818cf8",
      "secondary": "#a78bfa"
    },
    "bg": {
      "base": "#0f172a",
      "elevated": "#1e1b4b"
    }
  },
  "typography": {
    "fontFamily": {
      "sans": ["Inter", "sans-serif"]
    }
  }
}
```

### 12.4 Future Considerations

**Phase 2 Features:**
- Multi-clinic dashboard view
- Team collaboration interfaces
- Advanced analytics deep-dive
- Light mode theme
- Custom dashboard widgets

**Technical Considerations:**
- Performance optimization for charts
- Real-time data streaming
- Offline capability (PWA)
- Push notification integration

### 12.5 Success Metrics

**Design Success Criteria:**

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to ROI visibility | < 5 seconds | Usability testing |
| Task completion rate | > 95% | Usability testing |
| Accessibility score | WCAG AA | Automated + manual testing |
| User satisfaction | > 4.5/5 | Post-design survey |
| Development handoff clarity | > 90% | Dev team feedback |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| ROI | Return on Investment - valor economizado em R$ |
| No-show | Paciente que nao comparece a consulta |
| Token | Unidade de consumo da API de IA |
| Router Agent | Agente principal que direciona conversas |
| Glassmorphism | Design style using frosted glass effect |
| Sparkline | Small inline chart showing trend |
| Toast | Brief notification message |
| WCAG | Web Content Accessibility Guidelines |

## Appendix B: References

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Material Design - Dark Theme](https://material.io/design/color/dark-theme.html)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Lucide Icons](https://lucide.dev/)

---

**Document Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-25 | UX Team | Initial specification |

---

*End of Document*