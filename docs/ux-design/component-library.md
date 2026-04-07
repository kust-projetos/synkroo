# Synkroo Component Library

## Overview

Biblioteca de componentes para o Dashboard do Synkroo - Plataforma de IA para Clínicas Odontológicas.

## Card Components

### 1. ROI Card

**Purpose**: Exibir retorno sobre investimento mensal em R$

**Structure**:
```html
<article class="roi-card" role="region" aria-label="Retorno sobre investimento mensal">
  <header class="roi-card__header">
    <span class="roi-card__label">ROI ESTE MÊS</span>
    <span class="roi-card__badge" aria-label="Top 10% das clínicas">Top 10%</span>
  </header>

  <div class="roi-card__value" aria-live="polite">
    <span class="roi-card__currency">R$</span>
    <span class="roi-card__amount">14.780</span>
    <span class="roi-card__change" aria-label="Aumento de 32%">+32%</span>
  </div>

  <div class="roi-card__progress">
    <span class="roi-card__progress-label">Meta mensal</span>
    <span class="roi-card__progress-value">74% de R$ 20.000</span>
    <progress
      class="roi-card__progress-bar"
      value="74"
      max="100"
      aria-label="74% da meta alcançada">
    </progress>
  </div>

  <ul class="roi-card__breakdown" aria-label="Detalhamento do ROI">
    <li>R$ 4.200 - No-show evitados</li>
    <li>R$ 8.500 - Novos agendamentos</li>
    <li>R$ 2.080 - Reativações</li>
  </ul>

  <div class="roi-card__streak" aria-live="polite">
    <span class="roi-card__streak-count">7</span>
    <span class="roi-card__streak-label">dias sem no-show</span>
  </div>
</article>
```

**States**:
- Default: Glassmorphism background
- Hover: Subtle scale (1.02) + enhanced glow
- Loading: Skeleton/shimmer

---

### 2. Metric Card

**Purpose**: Exibir métricas operacionais do dia

**Structure**:
```html
<article
  class="metric-card"
  role="listitem"
  aria-label="No-show evitado: 8, recuperando R$ 4.200">

  <header class="metric-card__header">
    <span class="metric-card__label">No-show Evitado</span>
    <svg class="metric-card__sparkline" aria-hidden="true">
      <!-- SVG sparkline -->
    </svg>
  </header>

  <div class="metric-card__value">
    <span class="metric-card__number">8</span>
  </div>

  <footer class="metric-card__footer">
    <span class="metric-card__detail">R$ 4.200 recuperado</span>
  </footer>
</article>
```

**Variants**:
- Positive (green accent): Success metrics
- Neutral (purple accent): Standard metrics
- Warning (amber accent): Attention needed

---

### 3. Activity Card

**Purpose**: Exibir atividades recentes do agente

**Structure**:
```html
<article
  class="activity-card"
  role="article"
  aria-label="SCHEDULER agendou limpeza com Maria, há 5 minutos">

  <div class="activity-card__agent">
    <span class="activity-card__agent-badge">SCHEDULER</span>
  </div>

  <div class="activity-card__content">
    <p class="activity-card__text">Agendou limpeza com Maria</p>
  </div>

  <time class="activity-card__time" datetime="2024-01-15T14:30:00">
    5min
  </time>
</article>
```

**Agent Types**:
- `ROUTER`: Primary routing agent (always active)
- `SCHEDULER`: Appointment scheduling
- `SALES`: Sales and reactivation
- `GENERALIST`: FAQ and general queries

---

### 4. Risk Alert Card

**Purpose**: Alertar sobre pacientes com alto risco de no-show

**Structure**:
```html
<article
  class="risk-card risk-card--high"
  role="alert"
  aria-live="assertive"
  aria-label="Ana Paula, risco alto de 87%, consulta hoje às 15h">

  <header class="risk-card__header">
    <span class="risk-card__patient">Ana Paula</span>
    <span class="risk-card__appointment">Hoje 15h • Canal com Dr. Paulo</span>
  </header>

  <div class="risk-card__risk">
    <span class="risk-card__risk-score">87%</span>
    <span class="risk-card__risk-label">ALTO RISCO</span>
  </div>

  <p class="risk-card__reason">
    Já faltou 2x • Confirmou tardiamente
  </p>

  <button
    class="risk-card__action"
    aria-label="Contatar paciente Ana Paula">
    Contatar paciente
  </button>
</article>
```

**Risk Levels**:
- High (87%+): Red accent, pulse animation
- Medium (60-86%): Amber accent
- Low (0-59%): Green accent

---

## Navigation Components

### 5. Sidebar Navigation

**Purpose**: Navegação principal da aplicação (desktop)

**Structure**:
```html
<nav class="sidebar" role="navigation" aria-label="Navegação principal">
  <div class="sidebar__brand">
    <a href="/" class="sidebar__logo">Synkroo</a>
  </div>

  <div class="sidebar__clinic" role="region" aria-label="Informações da clínica">
    <span class="sidebar__clinic-name">Odonto Sorriso</span>
    <span class="sidebar__clinic-plan">Growth</span>
  </div>

  <ul class="sidebar__menu" role="menubar">
    <li role="none">
      <a role="menuitem" href="/dashboard" aria-current="page">Dashboard</a>
    </li>
    <li role="none">
      <a role="menuitem" href="/conversas">
        Conversas
        <span class="sidebar__badge" aria-label="3 conversas não lidas">3</span>
      </a>
    </li>
    <!-- More items -->
  </ul>
</nav>
```

**Menu Items**:
- Dashboard
- Conversas (com badge de não lidas)
- Agenda (com badge de risco)
- Pacientes
- Canais
- Treinar Agente
- Configurações

---

### 6. Bottom Navigation (Mobile)

**Purpose**: Navegação principal em dispositivos móveis

**Structure**:
```html
<nav
  class="bottom-nav"
  role="navigation"
  aria-label="Navegação móvel">

  <a href="/dashboard" class="bottom-nav__item bottom-nav__item--active">
    <svg class="bottom-nav__icon" aria-hidden="true">
      <!-- Dashboard icon -->
    </svg>
    <span class="bottom-nav__label">Dashboard</span>
  </a>

  <!-- 4 more items max (total 5) -->
</nav>
```

**Constraints**:
- Maximum 5 items (Material Design guideline)
- Each item must have icon + label
- Active state: highlight color + bold label
- Touch target: minimum 44x44px

---

## Feedback Components

### 7. Toast Notification

**Purpose**: Feedback temporário para ações do usuário

**Structure**:
```html
<div
  class="toast"
  role="status"
  aria-live="polite"
  aria-label="Ação desfeita com sucesso">

  <p class="toast__message">Ação desfeita</p>
  <button class="toast__undo">Desfazer</button>
  <button class="toast__close" aria-label="Fechar notificação">×</button>
</div>
```

**Types**:
- Success: Green accent
- Error: Red accent
- Info: Blue accent
- Warning: Amber accent

**Behavior**:
- Auto-dismiss: 3-5 seconds
- Undo available for 5 seconds
- Stack from bottom on mobile

---

### 8. Confirmation Dialog

**Purpose**: Confirmar ações destrutivas

**Structure**:
```html
<div
  class="dialog-overlay"
  role="dialog"
  aria-modal="true"
  aria-labelledby="dialog-title"
  aria-describedby="dialog-description">

  <div class="dialog">
    <h2 id="dialog-title" class="dialog__title">
      Confirmar cancelamento?
    </h2>

    <p id="dialog-description" class="dialog__description">
      Esta ação não pode ser desfeita.
    </p>

    <div class="dialog__actions">
      <button class="dialog__button dialog__button--secondary">
        Cancelar
      </button>
      <button class="dialog__button dialog__button--danger">
        Confirmar
      </button>
    </div>
  </div>
</div>
```

**Accessibility**:
- Focus trap within dialog
- Escape key closes dialog
- Initial focus on destructive action
- `aria-modal="true"` prevents background interaction

---

## Data Visualization

### 9. Sparkline Chart

**Purpose**: Mini chart inline em cards de métricas

**Structure**:
```html
<svg
  class="sparkline"
  viewBox="0 0 100 30"
  aria-hidden="true">

  <polyline
    class="sparkline__line sparkline__line--positive"
    points="0,25 15,20 30,22 45,15 60,18 75,10 90,8 100,5"
    fill="none"
    stroke="#4ade80"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  />
</svg>
```

**Variants**:
- Positive: Green (`#4ade80`)
- Negative: Red (`#f87171`)
- Neutral: Purple (`#818cf8`)

---

### 10. Progress Bar

**Purpose**: Indicar progresso em direção a meta

**Structure**:
```html
<div class="progress">
  <div class="progress__label">
    <span>Meta mensal</span>
    <span>74% de R$ 20.000</span>
  </div>

  <progress
    class="progress__bar"
    value="74"
    max="100"
    aria-label="74% da meta alcançada">
    74%
  </progress>
</div>
```

**States**:
- Default: Purple fill
- Success: Green fill (100%+)
- Warning: Amber fill (below 50%)

---

## Utility Components

### 11. Badge

**Purpose**: Indicar contagem ou status

**Structure**:
```html
<span class="badge badge--primary" aria-label="3 conversas não lidas">
  3
</span>
```

**Variants**:
- Primary: Purple
- Success: Green
- Warning: Amber
- Danger: Red

---

### 12. Avatar

**Purpose**: Representar usuário ou agente

**Structure**:
```html
<div class="avatar" aria-hidden="true">
  <span class="avatar__initials">AS</span>
</div>
```

**Sizes**:
- Small: 32px
- Medium: 40px
- Large: 48px

---

### 13. Agent Status Indicator

**Purpose**: Mostrar status do agente no header

**Structure**:
```html
<div
  class="agent-status"
  role="status"
  aria-live="polite"
  aria-label="Status do agente: Router ativo, 94% confiança">

  <div class="agent-status__pulse"></div>

  <div class="agent-status__info">
    <span class="agent-status__label">AGENTE</span>
    <span class="agent-status__name">Router • 94%</span>
    <span class="agent-status__confidence">confiança</span>
  </div>
</div>
```

**States**:
- Active: Green pulse animation
- Processing: Purple pulse
- Idle: Gray, no animation

---

## Accessibility Checklist

All components must:

- [ ] Have proper ARIA roles and labels
- [ ] Support keyboard navigation
- [ ] Have visible focus states
- [ ] Meet WCAG AA color contrast (4.5:1)
- [ ] Support screen readers
- [ ] Respect `prefers-reduced-motion`
- [ ] Have touch targets ≥44x44px on mobile