# Synkroo Conversas UX Design Specification

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

A tela de **Conversas** é o centro de operações do agente IA. Permite ao dentista monitorar, supervisionar e intervir em conversas entre o agente e pacientes em tempo real.

### 1.2 Primary Goals

| Goal | Success Metric | Priority |
|------|----------------|----------|
| **Visibilidade** | Ver todas conversas ativas em um olhar | Critical |
| **Intervenção Rápida** | Assumir conversa em < 3 cliques | Critical |
| **Contexto** | Entender histórico antes de intervir | High |
| **Filtros Eficientes** | Encontrar conversa específica em < 10s | High |
| **Aprovações** | Ver pendências e aprovar rapidamente | Medium |

### 1.3 Key Questions This Screen Answers

1. "Quais conversas estão acontecendo agora?"
2. "Preciso intervir em alguma?"
3. "O que o agente disse/falou?"
4. "Há pendências de aprovação?"

---

## 2. User Personas

### 2.1 Primary: Dr. Ana Santos (Dentista)

**Cenários de uso:**

| Cenário | Frequência | Ação Principal |
|---------|------------|----------------|
| Check matinal | 1x/dia | Ver conversas da noite, pendências |
| Intervenção urgente | 2-3x/dia | Assumir conversa problemática |
| Revisão de qualidade | 1x/semana | Auditar respostas do agente |
| Treino do agente | Ocasional | Corrigir/responder como exemplo |

### 2.2 Pain Points Addressed

- "Não sei o que o agente está falando com meus pacientes"
- "Preciso assumir quando o paciente pede falar comigo"
- "Quero ver se as respostas estão boas"

---

## 3. Information Architecture

### 3.1 Screen Structure

```
Conversas
├── Header
│   ├── Título + Contador
│   ├── Filtros rápidos
│   └── Ações (Nova conversa)
│
├── Sidebar (Lista de Conversas)
│   ├── Busca
│   ├── Filtros avançados
│   └── Lista conversas
│       ├── Avatar paciente
│       ├── Nome + canal
│       ├── Última mensagem (preview)
│       ├── Status badge
│       └── Timestamp
│
├── Main Content (Chat)
│   ├── Header da conversa
│   │   ├── Dados paciente
│   │   ├── Status agente
│   │   └── Ações (Assumir, Transferir)
│   │
│   ├── Mensagens
│   │   ├── Bubbles (paciente/agente)
│   │   ├── Timestamps
│   │   ├── Status (enviada, lida)
│   │   └── Anotações
│   │
│   └── Input (se ativo)
│       ├── Campo texto
│       ├── Anexos
│       └── Enviar
│
└── Right Panel (Contexto)
    ├── Perfil paciente
    ├── Histórico
    ├── Tags
    └── Notas
```

### 3.2 Status de Conversas

| Status | Cor | Descrição | Ação |
|--------|-----|-----------|------|
| `ativa` | Verde | Agente respondendo ativamente | Monitorar |
| `aguardando` | Amarelo | Paciente respondeu, agente processando | Aguardar |
| `pausada` | Cinza | Aguardando paciente | Nenhuma |
| `humano` | Roxo | Humano assumiu | Responder |
| `pendente` | Laranja | Aguardando aprovação | Aprovar |
| `encerrada` | -- | Conversa finalizada | Reabrir |

---

## 4. Layout & Components

### 4.1 Desktop Layout (1440px+)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  CONVERSAS                              🔍 Buscar    [+ Nova]              │
├────────────────────────────────────────────────────────────────────────────┤
│                                    │                                       │
│  ┌─────────────────────────────┐   │   ┌───────────────────────────────┐  │
│  │ 🔍 Buscar conversas...      │   │   │  ← Maria Silva                │  │
│  │                             │   │   │  WhatsApp • Router ativo      │  │
│  │ FILTROS                     │   │   │  ─────────────────────────────│  │
│  │ ○ Todas  ○ Ativas  ○ Pend.  │   │   │                               │  │
│  │                             │   │   │  [Agente] Olá! Como posso     │  │
│  │ LISTA                       │   │   │  ajudar?           14:32      │  │
│  │ ┌─────────────────────────┐ │   │   │                               │  │
│  │ │ 👤 Maria Silva          │ │   │   │  [Paciente] Quero agendar    │  │
│  │ │ WhatsApp • Ativa        │ │   │   │  uma limpeza        14:33      │  │
│  │ │ "Quero agendar..."      │ │   │   │                               │  │
│  │ │ 14:33                   │ │   │   │  [Agente] Perfeito! Tenho     │  │
│  │ └─────────────────────────┘ │   │   │  horários disponíveis...      │  │
│  │ ┌─────────────────────────┐ │   │   │                     14:34      │  │
│  │ │ 👤 João Pedro           │ │   │   │                               │  │
│  │ │ Instagram • Pendente    │ │   │   │  ─────────────────────────────│  │
│  │ │ "Aprovar desconto"      │ │   │   │  [APROVAR] [REJEITAR]         │  │
│  │ │ 14:20                   │ │   │   │                               │  │
│  │ └─────────────────────────┘ │   │   │───────────────────────────────│  │
│  │ ┌─────────────────────────┐ │   │   │  💬 Digite mensagem...        │  │
│  │ │ 👤 Ana Paula            │ │   │   │  [ASSUMIR CONVERSA]           │  │
│  │ │ WhatsApp • Humano       │ │   │   │                               │  │
│  │ │ "Obrigada doutora"      │ │   │   └───────────────────────────────┘  │
│  │ │ 14:10                   │ │   │                                       │
│  │ └─────────────────────────┘ │   │   ┌───────────────────────────────┐  │
│  │                             │   │   │  PACIENTE                     │  │
│  └─────────────────────────────┘   │   │  Maria Silva                  │  │
│                                    │   │  (11) 99999-8888              │  │
│                                    │   │  Paciente desde: Jan 2024     │  │
│                                    │   │  ─────────────────────────────│  │
│                                    │   │  Última consulta: 15/03       │  │
│                                    │   │  Procedimento: Limpeza        │  │
│                                    │   │  ─────────────────────────────│  │
│                                    │   │  🏷️ tags: VIP, Retorno        │  │
│                                    │   │  📝 Nota: Prefere tarde       │  │
│                                    │   └───────────────────────────────┘  │
│                                    │                                       │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component: Conversation List Item

```html
<article
  class="conversation-item"
  role="button"
  tabindex="0"
  aria-label="Conversa com Maria Silva, WhatsApp, ativa, última mensagem às 14:33">

  <div class="conversation-item__avatar">
    <img src="avatar.jpg" alt="" aria-hidden="true" />
    <span class="conversation-item__channel" aria-label="WhatsApp">
      <!-- WhatsApp icon -->
    </span>
  </div>

  <div class="conversation-item__content">
    <header class="conversation-item__header">
      <span class="conversation-item__name">Maria Silva</span>
      <time class="conversation-item__time">14:33</time>
    </header>

    <p class="conversation-item__preview">
      Quero agendar uma limpeza...
    </p>

    <footer class="conversation-item__footer">
      <span class="conversation-item__status conversation-item__status--active">
        Ativa
      </span>
      <span class="conversation-item__agent">
        Router
      </span>
    </footer>
  </div>
</article>
```

### 4.3 Component: Message Bubble

```html
<div
  class="message message--agent"
  role="article"
  aria-label="Mensagem do agente às 14:32">

  <div class="message__header">
    <span class="message__sender">Router</span>
    <time class="message__time">14:32</time>
  </div>

  <div class="message__content">
    <p>Olá! Como posso ajudar?</p>
  </div>

  <div class="message__status" aria-label="Mensagem lida">
    <svg><!-- Read icon --></svg>
  </div>
</div>
```

**Variants:**
- `message--patient`: Alinhado à esquerda, fundo escuro
- `message--agent`: Alinhado à direita, fundo com accent
- `message--human`: Alinhado à direita, fundo roxo (humano assumiu)
- `message--system`: Centralizado, fundo neutro (notificações)

### 4.4 Component: Approval Card

```html
<article
  class="approval-card"
  role="alert"
  aria-label="Aprovação pendente: desconto de 10% para João Pedro">

  <header class="approval-card__header">
    <span class="approval-card__type">Desconto</span>
    <span class="approval-card__risk">Baixo risco</span>
  </header>

  <div class="approval-card__content">
    <p><strong>Solicitado:</strong> Desconto de 10%</p>
    <p><strong>Procedimento:</strong> Clareamento</p>
    <p><strong>Valor original:</strong> R$ 800</p>
    <p><strong>Valor com desconto:</strong> R$ 720</p>
  </div>

  <div class="approval-card__context">
    <p>Paciente: João Pedro (2 consultas, sem inadimplência)</p>
  </div>

  <div class="approval-card__actions">
    <button class="approval-card__reject" aria-label="Rejeitar desconto">
      Rejeitar
    </button>
    <button class="approval-card__approve" aria-label="Aprovar desconto">
      Aprovar
    </button>
  </div>

  <div class="approval-card__reason">
    <label for="rejection-reason">Motivo (opcional):</label>
    <input type="text" id="rejection-reason" placeholder="Explique por que rejeitou..." />
  </div>
</article>
```

---

## 5. Interaction Patterns

### 5.1 Take Over Conversation (Intervenção)

```
1. Usuário clica [ASSUMIR CONVERSA]
   ↓
2. Modal de confirmação:
   "Você assumirá esta conversa. O agente pausará automaticamente."
   [Cancelar] [Assumir]
   ↓
3. Status muda para "humano"
   ↓
4. Input de mensagem habilitado
   ↓
5. Usuário responde como humano
   ↓
6. Ao finalizar, usuário pode:
   - [DEVOLVER AO AGENTE]
   - [ENCERRAR CONVERSSA]
```

### 5.2 Filter & Search

```
Filtros Rápidos:
[Todas] [Ativas] [Pendentes] [Humanas]

Filtros Avançados (sidebar):
□ Canal: WhatsApp, Instagram, Chat
□ Agente: Router, Scheduler, Sales, Generalist
□ Período: Hoje, 7 dias, 30 dias
□ Status: Ativa, Aguardando, Pausada, Encerrada
□ Paciente: [Busca por nome/telefone]

Busca:
- Busca em tempo real
- Matching em: nome paciente, telefone, mensagens
- Highlight do termo encontrado
```

### 5.3 Keyboard Navigation

| Tecla | Ação |
|-------|------|
| `Tab` | Navegar entre lista e chat |
| `↑` `↓` | Navegar entre conversas |
| `Enter` | Abrir conversa selecionada |
| `Escape` | Fechar filtros/modal |
| `/` | Focar busca |
| `A` | Assumir conversa (quando ativa) |

---

## 6. States & Variations

### 6.1 Empty State

```
┌────────────────────────────────────────┐
│                                        │
│            📭                          │
│                                        │
│     Nenhuma conversa encontrada        │
│                                        │
│  As conversas aparecerão aqui quando   │
│  pacientes entrarem em contato.        │
│                                        │
│         [Ver como funciona]            │
│                                        │
└────────────────────────────────────────┘
```

### 6.2 Loading State

```html
<div class="conversation-item skeleton">
  <div class="skeleton__avatar"></div>
  <div class="skeleton__content">
    <div class="skeleton__title"></div>
    <div class="skeleton__text"></div>
  </div>
</div>
```

### 6.3 Error State

```
┌────────────────────────────────────────┐
│                                        │
│            ⚠️                          │
│                                        │
│     Não foi possível carregar          │
│     as conversas                       │
│                                        │
│  Verifique sua conexão e tente         │
│  novamente.                            │
│                                        │
│         [Tentar novamente]             │
│                                        │
└────────────────────────────────────────┘
```

### 6.4 Approval Pending State

```
Indicador visual no header:
┌────────────────────────────────────────┐
│  CONVERSAS    ⚠️ 2 pendentes           │
└────────────────────────────────────────┘

Badge na lista:
┌─────────────────────────────┐
│ João Pedro                  │
│ Instagram • Pendente  [!]   │
│ "Aprovar desconto"          │
└─────────────────────────────┘
```

---

## 7. Accessibility Guidelines

### 7.1 ARIA Labels

```html
<!-- Lista de conversas -->
<nav aria-label="Lista de conversas">
  <ul role="listbox" aria-label="Conversas">
    <li role="option" aria-selected="true">
      <!-- Conversation item -->
    </li>
  </ul>
</nav>

<!-- Chat area -->
<main aria-label="Conversa com Maria Silva">
  <div role="log" aria-label="Mensagens" aria-live="polite">
    <!-- Messages -->
  </div>
</main>

<!-- Context panel -->
<aside aria-label="Informações do paciente">
  <!-- Patient info -->
</aside>
```

### 7.2 Live Updates

```html
<!-- Nova mensagem recebida -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
  Nova mensagem de Maria Silva
</div>

<!-- Status de envio -->
<div aria-live="assertive" aria-atomic="true">
  Mensagem enviada
</div>
```

### 7.3 Focus Management

- Ao abrir conversa: foco no input de mensagem
- Ao fechar modal: retornar foco ao elemento anterior
- Ao usar busca: foco no primeiro resultado
- Ao assumir conversa: foco no input

---

## 8. Mobile Responsiveness

### 8.1 Mobile Layout (< 768px)

```
┌─────────────────────────────┐
│  CONVERSAS        🔍  [+]   │
├─────────────────────────────┤
│                             │
│  ┌───────────────────────┐  │
│  │ 👤 Maria Silva        │  │
│  │ WhatsApp • Ativa      │  │
│  │ "Quero agendar..."    │  │
│  │ 14:33                 │  │
│  └───────────────────────┘  │
│                             │
│  ┌───────────────────────┐  │
│  │ 👤 João Pedro         │  │
│  │ Instagram • Pendente  │  │
│  │ "Aprovar desconto"    │  │
│  └───────────────────────┘  │
│                             │
└─────────────────────────────┘

Ao clicar em uma conversa:

┌─────────────────────────────┐
│  ← Maria Silva              │
│  WhatsApp • Router ativo    │
├─────────────────────────────┤
│                             │
│  [Agente] Olá! Como posso   │
│  ajudar?           14:32    │
│                             │
│  [Paciente] Quero agendar   │
│  uma limpeza       14:33    │
│                             │
│  [Agente] Perfeito! Tenho   │
│  horários disponíveis...    │
│                             │
├─────────────────────────────┤
│  💬 Digite mensagem...      │
│  [ASSUMIR]                  │
└─────────────────────────────┘
```

### 8.2 Bottom Sheet para Contexto

```
Ao tocar no nome do paciente:

┌─────────────────────────────┐
│  ─────                       │
│                             │
│  MARIA SILVA                │
│  (11) 99999-8888            │
│  Paciente desde: Jan 2024   │
│                             │
│  ───────────────────────────│
│                             │
│  Última consulta: 15/03     │
│  Procedimento: Limpeza      │
│                             │
│  🏷️ VIP, Retorno            │
│  📝 Prefere tarde           │
│                             │
│  [Ver perfil completo]      │
│                             │
└─────────────────────────────┘
```

---

## 9. API Integration

### 9.1 Endpoints Used

| Endpoint | Use Case |
|----------|----------|
| `GET /agent/conversations` | Listar conversas |
| `POST /agent/chat` | Enviar mensagem |
| `POST /agent/intervene` | Assumir conversa |
| `GET /patients/:id` | Dados do paciente |

### 9.2 Real-time Updates

```javascript
// WebSocket connection for live updates
const ws = new WebSocket('wss://api.synkroo.com/conversations');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'new_message':
      // Append message to chat
      break;
    case 'conversation_status':
      // Update status badge
      break;
    case 'approval_needed':
      // Show approval notification
      break;
  }
};
```

### 9.3 Optimistic Updates

- Enviar mensagem: mostrar imediatamente como "enviando"
- Atualizar para "enviada" quando servidor confirmar
- Em caso de erro, mostrar indicador e opção de retry

---

## Next Steps

- [ ] Criar protótipo interativo
- [ ] Testes de usabilidade com dentistas
- [ ] Validar fluxo de intervenção
- [ ] Implementar versão mobile-first