# Synkroo Agenda UX Design Specification

**Version:** 1.0
**Date:** March 26, 2026
**Status:** Draft
**Author:** UX Design Team (BMAD)

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [User Personas](#2-user-personas)
3. [Information Architecture](#3-information-architecture)
4. [Layout & Components](#4-layout--components)
5. [Interaction Patterns](#5-interaction-patterns)
6. [States & Variations](#6-states--variations)
7. [Accessibility Guidelines](#7-accessibility-guidelines)
8. [Mobile Responsiveness](#8-mobile-responsiveness)
9. [API Integration](#9-api-integration)

---

## 1. Overview & Goals

### 1.1 Purpose

A tela de **Agenda** permite visualizar, gerenciar e acompanhar todos os agendamentos da clínica. Integra-se com o agente IA para mostrar riscos de no-show, confirmações automáticas e oportunidades de otimização.

### 1.2 Primary Goals

| Goal | Success Metric | Priority |
|------|----------------|----------|
| **Visão do Dia** | Ver todos agendamentos do dia em um olhar | Critical |
| **Gestão de Risco** | Identificar pacientes de alto risco visualmente | Critical |
| **Agendamento Rápido** | Criar agendamento em < 30 segundos | High |
| **Otimização** | Verificar lacunas e oportunidades | Medium |
| **Confirmações** | Ver status de confirmação de cada paciente | High |

### 1.3 Key Questions This Screen Answers

1. "Quais consultas tenho hoje?"
2. "Quais pacientes podem faltar?"
3. "Há horários vagos para preencher?"
4. "Quem confirmou presença?"

---

## 2. User Personas

### 2.1 Primary: Dr. Ana Santos (Dentista)

**Cenários de uso:**

| Cenário | Frequência | Ação Principal |
|---------|------------|----------------|
| Check matinal | 1x/dia | Ver agenda do dia |
| During day | Constante | Checar próximo paciente |
| Marcar retorno | 3-5x/dia | Agendar rápido |
| Gestão risco | 2-3x/dia | Contatar pacientes risco |

### 2.2 Key Behaviors

- Olha para a agenda múltiplas vezes ao dia
- Precisa ver rapidamente quem vem em seguida
- Quer saber se pacientes confirmaram
- Fica preocupada com no-show

---

## 3. Information Architecture

### 3.1 Screen Structure

```
Agenda
├── Header
│   ├── Navegação de data (← Hoje →)
│   ├── Seletor de data
│   └── View toggle (Dia/Semana/Mês)
│
├── Sidebar (Lista de Profissionais)
│   ├── Dr. Ana Santos
│   ├── Dr. Paulo Canal
│   └── Dra. Maria Clara
│
├── Main Content (Calendário/Lista)
│   ├── Timeline (horários)
│   ├── Blocos de agendamento
│   │   ├── Paciente
│   │   ├── Procedimento
│   │   ├── Status
│   │   └── Risco
│   ├── Lacunas (horários vagos)
│   └── Bloqueios
│
└── Right Panel (Detalhes)
    ├── Info do agendamento
    ├── Paciente
    ├── Histórico
    └── Ações
```

### 3.2 Status de Agendamento

| Status | Cor | Ícone | Descrição |
|--------|-----|-------|-----------|
| `confirmado` | Verde | ✓ | Paciente confirmou |
| `agendado` | Azul | ○ | Aguardando confirmação |
| `risco_alto` | Vermelho | ⚠ | Alto risco de no-show |
| `risco_medio` | Amarelo | ! | Médio risco |
| `concluido` | Cinza | ● | Consulta realizada |
| `cancelado` | Vermelho | ✕ | Cancelado |
| `no_show` | Vermelho | ◌ | Paciente faltou |
| `bloqueado` | Cinza | █ | Horário bloqueado |

### 3.3 Risk Indicators

```
Score de Risco (0-100):
├── 0-30: Baixo (verde)
├── 31-60: Médio (amarelo)
└── 61-100: Alto (vermelho)

Fatores considerados:
- Histórico de no-show
- Tempo desde última consulta
- Status de confirmação
- Padrão de comportamento
- Dia da semana/horário
```

---

## 4. Layout & Components

### 4.1 Desktop Layout (1440px+)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  ← 26 de Março de 2026 (Quinta) →           [Dia] [Semana] [Mês]         │
├────────────────────────────────────────────────────────────────────────────┤
│                                    │                                       │
│  PROFISSIONAIS                     │   AGENDA DO DIA                       │
│  ┌─────────────────────────────┐   │   ┌───────────────────────────────┐  │
│  │ ✓ Dr. Ana Santos           │   │   │ 07:00                         │  │
│  │   Dr. Paulo Canal          │   │   │ 08:00 ┌──────────────────────┐│  │
│  │   Dra. Maria Clara         │   │   │       │ ✓ Maria Silva        ││  │
│  └─────────────────────────────┘   │   │       │   Limpeza • 60min    ││  │
│                                    │   │       │   Confirmado         ││  │
│  RESUMO DO DIA                     │   │ 09:00 └──────────────────────┘│  │
│  ┌─────────────────────────────┐   │   │ 10:00 ┌──────────────────────┐│  │
│  │ Total: 12 consultas        │   │   │       │ ⚠ João Pedro         ││  │
│  │ Confirmados: 8             │   │   │       │   Canal • 45min      ││  │
│  │ Risco alto: 2              │   │   │       │   RISCO 87%          ││  │
│  │ Lacunas: 3                 │   │   │ 11:00 └──────────────────────┘│  │
│  └─────────────────────────────┘   │   │ 12:00 ┌──────────────────────┐│  │
│                                    │   │       │ ○ Ana Paula          ││  │
│  LISTA DE ESPERA                   │   │       │   Clareamento • 90min││  │
│  ┌─────────────────────────────┐   │   │       │   Aguardando conf.   ││  │
│  │ + Carlos Mendes             │   │   │ 13:00 └──────────────────────┘│  │
│  │   Quer 14h ou 16h           │   │   │ 14:00 ┌──────────────────────┐│  │
│  │                             │   │   │       │ [DISPONÍVEL]         ││  │
│  │ + Fernanda Lima             │   │   │       │                      ││  │
│  │   Qualquer horário          │   │   │ 15:00 └──────────────────────┘│  │
│  └─────────────────────────────┘   │   │ 16:00 ┌──────────────────────┐│  │
│                                    │   │       │ ✓ Roberto Costa      ││  │
│                                    │   │       │   Extração • 30min   ││  │
│                                    │   │ 17:00 └──────────────────────┘│  │
│                                    │   │                               │  │
│                                    │   └───────────────────────────────┘  │
│                                    │                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component: Appointment Block

```html
<article
  class="appointment-block"
  role="button"
  tabindex="0"
  aria-label="Agendamento com Maria Silva às 8h, limpeza, confirmado">

  <div class="appointment-block__status">
    <span class="appointment-block__status-icon" aria-hidden="true">✓</span>
  </div>

  <div class="appointment-block__content">
    <header class="appointment-block__header">
      <span class="appointment-block__patient">Maria Silva</span>
      <span class="appointment-block__time">08:00 - 09:00</span>
    </header>

    <div class="appointment-block__details">
      <span class="appointment-block__procedure">Limpeza</span>
      <span class="appointment-block__duration">60min</span>
    </div>

    <footer class="appointment-block__footer">
      <span class="appointment-block__status-text">Confirmado</span>
      <span class="appointment-block__channel">WhatsApp</span>
    </footer>
  </div>

  <div class="appointment-block__risk" aria-label="Risco baixo: 15%">
    <div class="appointment-block__risk-bar" style="width: 15%"></div>
  </div>
</article>
```

**Variants:**

- `appointment-block--confirmed`: Border verde
- `appointment-block--pending`: Border azul
- `appointment-block--risk-high`: Border vermelha + pulse
- `appointment-block--risk-medium`: Border amarela
- `appointment-block--available`: Border tracejada, fundo neutro
- `appointment-block--blocked`: Fundo cinza, ícone cadeado

### 4.3 Component: Risk Alert Badge

```html
<div
  class="risk-badge risk-badge--high"
  role="status"
  aria-label="Risco alto de no-show: 87%">

  <span class="risk-badge__icon" aria-hidden="true">⚠</span>
  <span class="risk-badge__score">87%</span>
  <span class="risk-badge__label">RISCO ALTO</span>
</div>
```

### 4.4 Component: Waitlist Card

```html
<article
  class="waitlist-card"
  role="listitem"
  aria-label="Carlos Mendes na lista de espera, prefere 14h ou 16h">

  <div class="waitlist-card__patient">
    <span class="waitlist-card__name">Carlos Mendes</span>
    <span class="waitlist-card__phone">(11) 98888-7777</span>
  </div>

  <div class="waitlist-card__preference">
    <span class="waitlist-card__label">Preferência:</span>
    <span class="waitlist-card__times">14h ou 16h</span>
  </div>

  <div class="waitlist-card__actions">
    <button class="waitlist-card__contact" aria-label="Contatar Carlos Mendes">
      Contatar
    </button>
    <button class="waitlist-card__schedule" aria-label="Agendar Carlos Mendes">
      Agendar
    </button>
  </div>

  <time class="waitlist-card__since">
    Na lista há 2 dias
  </time>
</article>
```

### 4.5 Component: Time Slot (Available)

```html
<div
  class="time-slot time-slot--available"
  role="button"
  tabindex="0"
  aria-label="Horário disponível às 14h">

  <time class="time-slot__time">14:00</time>
  <span class="time-slot__label">Disponível</span>

  <div class="time-slot__hover-actions">
    <button class="time-slot__action">Agendar</button>
    <button class="time-slot__action">Bloquear</button>
  </div>
</div>
```

---

## 5. Interaction Patterns

### 5.1 Create Appointment

```
1. Usuário clica em horário vago
   ↓
2. Modal de agendamento:
   ┌────────────────────────────┐
   │ NOVO AGENDAMENTO           │
   │                            │
   │ Paciente: [Buscar...]      │
   │ Procedimento: [Lista]      │
   │ Profissional: [Dr. Ana]    │
   │ Horário: 14:00             │
   │ Duração: [30/45/60 min]    │
   │                            │
   │ Observações: [              │
   │                            │
   │ [Cancelar] [Agendar]       │
   └────────────────────────────┘
   ↓
3. Validação de conflito
   ↓
4. Criação + confirmação automática
   ↓
5. Toast: "Agendamento criado. Agente enviará lembrete."
```

### 5.2 Drag & Drop (Reschedule)

```
1. Usuário arrasta bloco de agendamento
   ↓
2. Mostra preview do movimento
   ↓
3. Validações em tempo real:
   - Horário disponível?
   - Duração compatível?
   - Profissional disponível?
   ↓
4. Ao soltar:
   - Se válido: Confirma reagendamento
   - Se inválido: Mostra erro + sugestões
   ↓
5. Agente envia notificação automática ao paciente
```

### 5.3 Risk Patient Action

```
1. Usuário vê paciente com risco alto
   ↓
2. Clica no bloco
   ↓
3. Painel de detalhes mostra:
   ┌────────────────────────────┐
   │ ⚠ JOÃO PEDRO              │
   │ RISCO: 87%                │
   │                            │
   │ Motivos:                   │
   │ • Faltou 2x últimos 30 dias│
   │ • Confirmou tarde ontem    │
   │ • Histórico de reagendamento│
   │                            │
   │ AÇÕES:                     │
   │ [Contatar agora]           │
   │ [Enviar lembrete extra]    │
   │ [Adicionar à lista espera] │
   │ [Cancelar]                 │
   └────────────────────────────┘
```

### 5.4 View Toggle

```
[Dia] - Timeline vertical (padrão)
[Semana] - Grid 7 dias × horários
[Mês] - Calendário mensal

Comportamento:
- Toggle instantâneo
- Animação suave entre views
- Mantém data selecionada
- Scroll position preservada
```

---

## 6. States & Variations

### 6.1 Empty Day

```
┌────────────────────────────────────────┐
│                                        │
│            📅                          │
│                                        │
│     Nenhum agendamento para este dia   │
│                                        │
│  Os agendamentos aparecerão aqui       │
│  conforme forem sendo criados.         │
│                                        │
│         [+ Criar agendamento]          │
│                                        │
└────────────────────────────────────────┘
```

### 6.2 No Professional Selected

```
┌────────────────────────────────────────┐
│                                        │
│            👨‍⚕️                        │
│                                        │
│     Selecione um profissional          │
│     para ver sua agenda                │
│                                        │
│  Use a lista à esquerda para           │
│  selecionar quem deseja visualizar.    │
│                                        │
└────────────────────────────────────────┘
```

### 6.3 Conflict Warning

```
┌────────────────────────────────────────┐
│                                        │
│  ⚠️ CONFLITO DETECTADO                 │
│                                        │
│  Já existe um agendamento neste        │
│  horário:                              │
│                                        │
│  Maria Silva - Limpeza - 08:00         │
│                                        │
│  Sugestões:                            │
│  • 07:30 (antes)                       │
│  • 09:15 (depois)                      │
│                                        │
│  [Cancelar] [Ver alternativas]         │
│                                        │
└────────────────────────────────────────┘
```

### 6.4 Week View

```
┌──────────────────────────────────────────────────────────────────────┐
│           SEG        TER        QUA        QUI        SEX        SAB  │
│                                                                      │
│  08:00  ┌────┐    ┌────┐    ┌────┐    ┌────┐    ┌────┐    ┌────┐  │
│         │ ✓  │    │ ⚠  │    │ ○  │    │ ✓  │    │ ○  │    │    │  │
│         │Maria│    │João │    │Ana │    │Maria│    │Paulo│    │    │  │
│         └────┘    └────┘    └────┘    └────┘    └────┘    └────┘  │
│                                                                      │
│  09:00  ┌────┐    ┌────┐    ┌────┐    ┌────┐    ┌────┐    ┌────┐  │
│         │ ○  │    │    │    │ ✓  │    │ ⚠  │    │    │    │    │  │
│         │Ana │    │    │    │Paulo│    │Carlos│   │    │    │    │  │
│         └────┘    └────┘    └────┘    └────┘    └────┘    └────┘  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. Accessibility Guidelines

### 7.1 Keyboard Navigation

| Tecla | Ação |
|-------|------|
| `Tab` | Navegar entre elementos |
| `↑` `↓` | Navegar entre horários |
| `←` `→` | Navegar entre dias (view semana) |
| `Enter` | Abrir detalhes do agendamento |
| `Space` | Selecionar horário |
| `Delete` | Cancelar agendamento (com confirmação) |
| `N` | Novo agendamento |

### 7.2 Screen Reader

```html
<!-- Agenda timeline -->
<div role="grid" aria-label="Agenda do dia 26 de Março">
  <div role="rowgroup">
    <!-- Time slots -->
  </div>
</div>

<!-- Appointment block -->
<div
  role="gridcell"
  aria-label="8 horas, Maria Silva, limpeza, 60 minutos, confirmado">

  <!-- Content -->
</div>
```

### 7.3 Color Independence

- Risk indicators must use both color AND icon
- Status badges must have text labels
- Important information not conveyed by color alone

---

## 8. Mobile Responsiveness

### 8.1 Mobile Layout (< 768px)

```
┌─────────────────────────────┐
│  ← 26 Mar (Qui) →   [+ Novo]│
├─────────────────────────────┤
│  [Dia] [Semana] [Mês]       │
├─────────────────────────────┤
│                             │
│  RESUMO                     │
│  12 consultas • 2 risco     │
│  8 confirmados • 3 vagos    │
│                             │
├─────────────────────────────┤
│                             │
│  08:00                      │
│  ┌─────────────────────────┐│
│  │ ✓ Maria Silva           ││
│  │ Limpeza • 60min         ││
│  │ Confirmado              ││
│  └─────────────────────────┘│
│                             │
│  10:00                      │
│  ┌─────────────────────────┐│
│  │ ⚠ João Pedro            ││
│  │ Canal • 45min           ││
│  │ RISCO 87%               ││
│  └─────────────────────────┘│
│                             │
│  12:00                      │
│  ┌─────────────────────────┐│
│  │ ○ Ana Paula             ││
│  │ Clareamento • 90min     ││
│  │ Aguardando confirmação  ││
│  └─────────────────────────┘│
│                             │
└─────────────────────────────┘
```

### 8.2 Touch Interactions

- Tap: Abrir detalhes
- Long press: Mostrar ações rápidas
- Swipe left: Cancelar (com confirmação)
- Swipe right: Confirmar
- Pinch: Zoom in/out (view semana/mês)

---

## 9. API Integration

### 9.1 Endpoints Used

| Endpoint | Use Case |
|----------|----------|
| `GET /appointments` | Listar agendamentos |
| `POST /appointments` | Criar agendamento |
| `PUT /appointments/:id` | Atualizar |
| `DELETE /appointments/:id` | Cancelar |
| `GET /appointments/available-slots` | Horários disponíveis |
| `POST /appointments/:id/confirm` | Confirmar |
| `POST /appointments/:id/reschedule` | Reagendar |

### 9.2 Real-time Updates

```javascript
// WebSocket for live updates
const ws = new WebSocket('wss://api.synkroo.com/appointments');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'appointment_created':
      // Add new appointment to view
      break;
    case 'appointment_confirmed':
      // Update status badge
      break;
    case 'risk_alert':
      // Show risk notification
      break;
    case 'no_show_detected':
      // Mark as no-show
      break;
  }
};
```

---

## Next Steps

- [ ] Criar protótipo interativo
- [ ] Testar drag & drop em mobile
- [ ] Validar indicadores de risco com dentistas
- [ ] Implementar notificações push