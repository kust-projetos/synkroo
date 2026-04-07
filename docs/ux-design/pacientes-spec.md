# Synkroo Pacientes UX Design Specification

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

A tela de **Pacientes** funciona como um CRM simplificado, permitindo visualizar, buscar e gerenciar todos os pacientes da clínica. Mostra histórico, score de risco, tags e informações relevantes para atendimento.

### 1.2 Primary Goals

| Goal | Success Metric | Priority |
|------|----------------|----------|
| **Busca Rápida** | Encontrar paciente em < 5 segundos | Critical |
| **Contexto** | Ver histórico e interações anteriores | High |
| **Segmentação** | Filtrar por tags, risco, status | High |
| **Ação Rápida** | Contatar/agendar em 2 cliques | Medium |
| **Insights** | Ver padrões de comportamento | Medium |

### 1.3 Key Questions This Screen Answers

1. "Já cadastrei esse paciente?"
2. "Qual o histórico desse paciente?"
3. "Quais pacientes VIP tenho?"
4. "Quem são os pacientes inativos?"

---

## 2. User Personas

### 2.1 Primary: Dr. Ana Santos (Dentista)

**Cenários de uso:**

| Cenário | Frequência | Ação Principal |
|---------|------------|----------------|
| Busca paciente | 10-15x/dia | Encontrar para agendamento |
| Revisão histórico | 5-10x/dia | Ver tratamentos anteriores |
| Cadastro novo | 2-5x/dia | Cadastrar paciente novo |
| Segmentação | 1x/semana | Ver grupos de pacientes |

### 2.2 Pain Points Addressed

- "Não encontro o paciente no sistema"
- "Quero ver rapidamente o histórico"
- "Preciso saber quem são os pacientes inativos para reativar"

---

## 3. Information Architecture

### 3.1 Screen Structure

```
Pacientes
├── Header
│   ├── Busca
│   ├── Filtros
│   └── Ações (+ Novo paciente)
│
├── Sidebar (Filtros avançados)
│   ├── Por status
│   ├── Por tags
│   ├── Por risco
│   └── Por período
│
├── Main Content (Lista de Pacientes)
│   ├── Table view
│   │   ├── Nome
│   │   ├── Telefone
│   │   ├── Última consulta
│   │   ├── Status
│   │   └── Risco
│   └── Cards view (opcional)
│
└── Right Panel (Detalhes)
    ├── Dados pessoais
    ├── Histórico
    ├── Tags
    ├── Score de risco
    └── Ações
```

### 3.2 Patient Status

| Status | Cor | Descrição |
|--------|-----|-----------|
| `ativo` | Verde | Consulta nos últimos 6 meses |
| `inativo` | Amarelo | Sem consulta há 6-12 meses |
| `risco` | Vermelho | Alto risco de churn |
| `vip` | Roxo | Paciente VIP/destaque |
| `novo` | Azul | Primeira consulta recente |

### 3.3 Risk Score

```
Score de Risco (0-100):

BAIXO (0-30)
├── Frequente
├── Sempre confirma
├── Baixo no-show
└── Pagamento em dia

MÉDIO (31-60)
├── Irregular
├── Às vezes cancela
├── Atrasos ocasionais
└── 1-2 no-shows

ALTO (61-100)
├── Infrequente
├── Alto no-show
├── Atrasos frequentes
└── Risco de churn
```

---

## 4. Layout & Components

### 4.1 Desktop Layout (1440px+)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  PACIENTES                     🔊 Buscar...    [+ Novo paciente]          │
├────────────────────────────────────────────────────────────────────────────┤
│                                    │                                       │
│  FILTROS                           │   LISTA DE PACIENTES                  │
│  ┌─────────────────────────────┐   │   ┌───────────────────────────────┐  │
│  │ Status                      │   │   │ Nome        Telefone  Última   │  │
│  │ ☑ Ativos (150)              │   │   ├───────────────────────────────┤  │
│  │ ☑ Inativos (45)             │   │   │ ✓ Maria Silva              │  │
│  │ ☐ Risco (12)                │   │   │   (11) 99999-8888  15/03     │  │
│  │ ☐ Novos (8)                 │   │   │   Ativo • Risco: 15%         │  │
│  │                             │   │   ├───────────────────────────────┤  │
│  │ Tags                        │   │   │ ⚠ João Pedro               │  │
│  │ ☐ VIP (25)                  │   │   │   (11) 98888-7777  28/02     │  │
│  │ ☐ Retorno (30)              │   │   │   Ativo • Risco: 78%         │  │
│  │ ☐ Tratamento (18)           │   │   ├───────────────────────────────┤  │
│  │                             │   │   │ ○ Ana Paula                │  │
│  │ Risco                       │   │   │   (11) 97777-6666  10/01     │  │
│  │ ☐ Alto (12)                 │   │   │   Inativo • Risco: 45%       │  │
│  │ ☐ Médio (35)                │   │   ├───────────────────────────────┤  │
│  │ ☐ Baixo (166)               │   │   │ ★ Carlos Mendes            │  │
│  │                             │   │   │   (11) 96666-5555  20/03     │  │
│  │ Período                     │   │   │   VIP • Risco: 8%            │  │
│  │ Última consulta:            │   │   └───────────────────────────────┘  │
│  │ [30 dias] [90 dias] [1 ano] │   │                                       │
│  │                             │   │   Mostrando 1-25 de 215 pacientes    │
│  │ [Limpar filtros]            │   │   [Anterior] 1 2 3 ... [Próximo]     │
│  └─────────────────────────────┘   │                                       │
│                                    │   ┌───────────────────────────────┐  │
│                                    │   │ DETALHES: Maria Silva         │  │
│                                    │   │ ─────────────────────────────│  │
│                                    │   │ 📱 (11) 99999-8888            │  │
│                                    │   │ 📧 maria@email.com            │  │
│                                    │   │ 📅 Nasc: 15/03/1990           │  │
│                                    │   │ ─────────────────────────────│  │
│                                    │   │ HISTÓRICO                     │  │
│                                    │   │ • 15/03 - Limpeza             │  │
│                                    │   │ • 20/02 - Consulta            │  │
│                                    │   │ • 15/01 - Canal               │  │
│                                    │   │ ─────────────────────────────│  │
│                                    │   │ TAGS: VIP, Retorno            │  │
│                                    │   │ RISCO: 15% (Baixo)            │  │
│                                    │   │ ─────────────────────────────│  │
│                                    │   │ [Agendar] [Contatar] [Editar] │  │
│                                    │   └───────────────────────────────┘  │
│                                    │                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component: Patient Row

```html
<tr
  class="patient-row"
  role="row"
  tabindex="0"
  aria-label="Maria Silva, ativo, risco baixo 15%, última consulta 15 de março">

  <td class="patient-row__status">
    <span class="status-dot status-dot--active" aria-hidden="true"></span>
  </td>

  <td class="patient-row__name">
    <span class="patient-row__full-name">Maria Silva</span>
    <span class="patient-row__tags" aria-label="Tags: VIP">
      <span class="tag tag--vip">VIP</span>
    </span>
  </td>

  <td class="patient-row__phone">
    <a href="tel:+5511999998888">(11) 99999-8888</a>
  </td>

  <td class="patient-row__last-visit">
    <time datetime="2026-03-15">15/03</time>
  </td>

  <td class="patient-row__status-text">
    Ativo
  </td>

  <td class="patient-row__risk">
    <div class="risk-mini">
      <div class="risk-mini__bar" style="width: 15%"></div>
      <span class="risk-mini__text">15%</span>
    </div>
  </td>

  <td class="patient-row__actions">
    <button aria-label="Agendar com Maria Silva">
      <svg><!-- Calendar icon --></svg>
    </button>
    <button aria-label="Contatar Maria Silva via WhatsApp">
      <svg><!-- WhatsApp icon --></svg>
    </button>
  </td>
</tr>
```

### 4.3 Component: Patient Detail Panel

```html
<aside
  class="patient-panel"
  role="complementary"
  aria-label="Detalhes do paciente Maria Silva">

  <header class="patient-panel__header">
    <div class="patient-panel__avatar">
      <span aria-hidden="true">MS</span>
    </div>
    <div class="patient-panel__identity">
      <h2 class="patient-panel__name">Maria Silva</h2>
      <span class="patient-panel__status">Ativo</span>
    </div>
    <button class="patient-panel__close" aria-label="Fechar painel">×</button>
  </header>

  <section class="patient-panel__contact">
    <h3>Contato</h3>
    <div class="patient-panel__item">
      <span aria-hidden="true">📱</span>
      <a href="tel:+5511999998888">(11) 99999-8888</a>
    </div>
    <div class="patient-panel__item">
      <span aria-hidden="true">📧</span>
      <a href="mailto:maria@email.com">maria@email.com</a>
    </div>
    <div class="patient-panel__item">
      <span aria-hidden="true">📅</span>
      <span>Nasc: 15/03/1990 (36 anos)</span>
    </div>
  </section>

  <section class="patient-panel__history">
    <h3>Histórico</h3>
    <ul class="patient-panel__history-list">
      <li>
        <time>15/03/2026</time>
        <span>Limpeza</span>
        <span>Dr. Ana</span>
      </li>
      <li>
        <time>20/02/2026</time>
        <span>Consulta</span>
        <span>Dr. Ana</span>
      </li>
      <!-- More history items -->
    </ul>
    <button class="patient-panel__view-all">Ver histórico completo</button>
  </section>

  <section class="patient-panel__tags">
    <h3>Tags</h3>
    <div class="tag-list">
      <span class="tag tag--vip">VIP</span>
      <span class="tag tag--return">Retorno</span>
      <button class="tag tag--add" aria-label="Adicionar tag">+</button>
    </div>
  </section>

  <section class="patient-panel__risk">
    <h3>Score de Risco</h3>
    <div class="risk-score risk-score--low">
      <div class="risk-score__value">15%</div>
      <div class="risk-score__label">Baixo risco</div>
      <div class="risk-score__bar">
        <div class="risk-score__fill" style="width: 15%"></div>
      </div>
    </div>
    <p class="risk-score__explanation">
      Paciente frequente, sempre confirma, sem histórico de no-show.
    </p>
  </section>

  <section class="patient-panel__notes">
    <h3>Notas</h3>
    <textarea
      placeholder="Adicione notas sobre o paciente..."
      aria-label="Notas sobre o paciente">
Prefere agendamentos à tarde. Sensível a anestesia.
    </textarea>
  </section>

  <footer class="patient-panel__actions">
    <button class="btn btn--primary">Agendar</button>
    <button class="btn btn--secondary">Contatar</button>
    <button class="btn btn--ghost">Editar</button>
  </footer>
</aside>
```

### 4.4 Component: Search Bar

```html
<div class="patient-search" role="search">
  <label for="patient-search-input" class="sr-only">Buscar pacientes</label>
  <input
    type="search"
    id="patient-search-input"
    class="patient-search__input"
    placeholder="Buscar por nome, telefone ou email..."
    aria-describedby="search-help"
  />
  <span id="search-help" class="sr-only">
    Digite para buscar. Resultados aparecem em tempo real.
  </span>
  <button class="patient-search__clear" aria-label="Limpar busca">×</button>
</div>
```

---

## 5. Interaction Patterns

### 5.1 Search & Filter

```
Busca em tempo real:
1. Usuário digita no campo de busca
   ↓
2. Resultados filtrados instantaneamente
   ↓
3. Matching highlight no termo
   ↓
4. Contador atualizado

Filtros combinados:
1. Selecionar múltiplos filtros
   ↓
2. Aplicar AND entre categorias
   ↓
3. Aplicar OR dentro de categoria
   ↓
4. Mostrar contador de resultados

Exemplo:
Status: Ativo OR Inativo
Tags: VIP
Risco: Alto
→ Mostra pacientes ativos OU inativos, com tag VIP, de alto risco
```

### 5.2 Create New Patient

```
1. Clicar [+ Novo paciente]
   ↓
2. Modal de cadastro:
   ┌────────────────────────────┐
   │ NOVO PACIENTE              │
   │                            │
   │ Nome: [                    │
   │ Telefone: [                │
   │ Email: [                   │
   │ Data nasc: [               │
   │                            │
   │ Tags: [                    │
   │ Notas: [                   │
   │                            │
   │ [Cancelar] [Cadastrar]     │
   └────────────────────────────┘
   ↓
3. Validação de duplicados
   - Se telefone existe: sugerir atualização
   ↓
4. Toast: "Paciente cadastrado com sucesso"
```

### 5.3 Quick Actions

```
Ao clicar no paciente:
- Painel lateral abre com detalhes
- Ações rápidas visíveis:
  • Agendar
  • Contatar (WhatsApp)
  • Editar
  • Ver histórico

Atalhos de teclado:
- A: Agendar
- W: WhatsApp
- E: Editar
- H: Histórico
```

### 5.4 Bulk Actions

```
1. Selecionar múltiplos pacientes (checkboxes)
   ↓
2. Barra de ações aparece:
   ┌────────────────────────────────────┐
   │ 3 selecionados                     │
   │ [Agendar] [Contatar] [Add Tag] [X] │
   └────────────────────────────────────┘
   ↓
3. Ação aplicada a todos selecionados
   ↓
4. Toast: "Ação aplicada a 3 pacientes"
```

---

## 6. States & Variations

### 6.1 Empty State

```
┌────────────────────────────────────────┐
│                                        │
│            👥                          │
│                                        │
│     Nenhum paciente encontrado         │
│                                        │
│  Tente ajustar os filtros ou busque    │
│  por outro termo.                      │
│                                        │
│         [Limpar filtros]               │
│         [+ Novo paciente]              │
│                                        │
└────────────────────────────────────────┘
```

### 6.2 Loading State

```html
<div class="patient-row skeleton">
  <div class="skeleton__avatar"></div>
  <div class="skeleton__content">
    <div class="skeleton__title"></div>
    <div class="skeleton__text"></div>
  </div>
</div>
```

### 6.3 Duplicate Detection

```
Ao cadastrar paciente com telefone existente:

┌────────────────────────────────────────┐
│                                        │
│  ⚠️ PACIENTE JÁ CADASTRADO             │
│                                        │
│  Encontrado paciente com mesmo         │
│  telefone:                             │
│                                        │
│  Maria Silva                           │
│  (11) 99999-8888                       │
│  Última consulta: 15/03/2026           │
│                                        │
│  [Ver paciente existente]              │
│  [Atualizar dados]                     │
│  [Cadastrar mesmo assim]               │
│                                        │
└────────────────────────────────────────┘
```

---

## 7. Accessibility Guidelines

### 7.1 Table Accessibility

```html
<table role="grid" aria-label="Lista de pacientes">
  <thead>
    <tr>
      <th scope="col">Status</th>
      <th scope="col">Nome</th>
      <th scope="col">Telefone</th>
      <th scope="col">Última consulta</th>
      <th scope="col">Risco</th>
      <th scope="col">Ações</th>
    </tr>
  </thead>
  <tbody>
    <!-- Patient rows -->
  </tbody>
</table>
```

### 7.2 Keyboard Navigation

| Tecla | Ação |
|-------|------|
| `Tab` | Navegar entre elementos |
| `↑` `↓` | Navegar entre linhas |
| `Enter` | Abrir detalhes |
| `Space` | Selecionar checkbox |
| `Escape` | Fechar painel |
| `/` | Focar busca |

---

## 8. Mobile Responsiveness

### 8.1 Mobile Layout (< 768px)

```
┌─────────────────────────────┐
│  PACIENTES        [+ Novo]  │
├─────────────────────────────┤
│  🔍 Buscar paciente...      │
│  [Filtros]                  │
├─────────────────────────────┤
│                             │
│  ┌─────────────────────────┐│
│  │ ✓ Maria Silva           ││
│  │ (11) 99999-8888         ││
│  │ Ativo • 15/03           ││
│  │ ⭐ VIP                  ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ ⚠ João Pedro            ││
│  │ (11) 98888-7777         ││
│  │ Ativo • 28/02           ││
│  │ Risco: 78%              ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ ○ Ana Paula             ││
│  │ (11) 97777-6666         ││
│  │ Inativo • 10/01         ││
│  │ Risco: 45%              ││
│  └─────────────────────────┘│
│                             │
│  [Carregar mais]            │
│                             │
└─────────────────────────────┘
```

### 8.2 Mobile Detail (Bottom Sheet)

```
Ao tocar em um paciente:

┌─────────────────────────────┐
│  ─────                       │
│                             │
│  MARIA SILVA                │
│  Ativo • Risco: 15%         │
│                             │
│  📱 (11) 99999-8888         │
│  📧 maria@email.com         │
│  📅 Nasc: 15/03/1990        │
│                             │
│  ───────────────────────────│
│                             │
│  HISTÓRICO                  │
│  • 15/03 - Limpeza          │
│  • 20/02 - Consulta         │
│  • 15/01 - Canal            │
│                             │
│  ───────────────────────────│
│                             │
│  🏷️ VIP, Retorno            │
│                             │
│  [Agendar] [WhatsApp]       │
│                             │
└─────────────────────────────┘
```

---

## 9. API Integration

### 9.1 Endpoints Used

| Endpoint | Use Case |
|----------|----------|
| `GET /patients` | Listar pacientes |
| `POST /patients` | Criar paciente |
| `GET /patients/:id` | Detalhes |
| `PUT /patients/:id` | Atualizar |
| `DELETE /patients/:id` | Remover (soft delete) |
| `GET /patients/:id/history` | Histórico |
| `GET /patients/:id/appointments` | Agendamentos |

### 9.2 Search Parameters

```javascript
// Search query
GET /patients?search=maria&status=active&tags=vip&risk=high&page=1&limit=25

// Response
{
  patients: [...],
  total: 215,
  page: 1,
  limit: 25,
  filters: {
    status: { active: 150, inactive: 45, ... },
    tags: { vip: 25, retorno: 30, ... },
    risk: { high: 12, medium: 35, low: 166 }
  }
}
```

---

## Next Steps

- [ ] Criar protótipo interativo
- [ ] Testar busca com dados reais
- [ ] Validar bulk actions com dentistas
- [ ] Implementar infinite scroll mobile