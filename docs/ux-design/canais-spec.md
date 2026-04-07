# Synkroo Canais UX Design Specification

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

A tela de **Canais** gerencia todas as conexões de comunicação da clínica: WhatsApp, Instagram DM e Chat Widget. Permite configurar, monitorar e troubleshoot cada canal de atendimento.

### 1.2 Primary Goals

| Goal | Success Metric | Priority |
|------|----------------|----------|
| **Status Claro** | Ver status de todos canais em 1 olhar | Critical |
| **Setup Fácil** | Conectar novo canal em < 5 minutos | Critical |
| **Troubleshooting** | Identificar e resolver problemas rapidamente | High |
| **Templates** | Gerenciar mensagens reutilizáveis | Medium |
| **Métricas** | Ver performance por canal | Medium |

### 1.3 Supported Channels

| Canal | Tipo | Status MVP |
|-------|------|------------|
| **WhatsApp Web** | Playwright automation | ✅ Principal |
| **WhatsApp API** | Meta Business API | 🔜 Opcional |
| **Instagram DM** | Graph API | 🔜 Pós-MVP |
| **Chat Widget** | JavaScript embed | ✅ Secundário |

---

## 2. User Personas

### 2.1 Primary: Dr. Ana Santos (Dentista)

**Cenários de uso:**

| Cenário | Frequência | Ação Principal |
|---------|------------|----------------|
| Verificar conexão | 1x/dia | Confirmar canais ativos |
| Reconectar | Ocasional | Resolver desconexão |
| Configurar novo | 1x/setup | Adicionar canal |
| Ver métricas | 1x/semana | Comparar performance |

### 2.2 Pain Points Addressed

- "Meu WhatsApp parou de funcionar?"
- "Quero adicionar Instagram para captar mais leads"
- "Preciso de um chat no meu site"

---

## 3. Information Architecture

### 3.1 Screen Structure

```
Canais
├── Header
│   ├── Título
│   └── [+ Adicionar canal]
│
├── Main Content
│   ├── Card: WhatsApp
│   │   ├── Status
│   │   ├── Número
│   │   ├── Métricas
│   │   └── Ações
│   │
│   ├── Card: Instagram
│   │   ├── Status
│   │   ├── Conta
│   │   ├── Métricas
│   │   └── Ações
│   │
│   └── Card: Chat Widget
│       ├── Status
│       ├── Código embed
│       └── Ações
│
└── Right Panel (Configuração)
    ├── Setup wizard
    ├── Templates
    └── Logs
```

### 3.2 Channel Status

| Status | Cor | Descrição | Ação |
|--------|-----|-----------|------|
| `connected` | Verde | Canal ativo e funcionando | Nenhuma |
| `connecting` | Azul | Tentando conectar | Aguardar |
| `disconnected` | Amarelo | Precisa reconectar | Reconectar |
| `error` | Vermelho | Erro crítico | Resolver |
| `rate_limited` | Laranja | Rate limit atingido | Aguardar |
| `banned` | Vermelho escuro | Número banido | Contatar suporte |

---

## 4. Layout & Components

### 4.1 Desktop Layout (1440px+)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  CANAIS                                          [+ Adicionar canal]      │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  WHATSAPP WEB                                           ● Conectado  │  │
│  │                                                                       │  │
│  │  📱 (11) 99999-0001                                                   │  │
│  │  Conectado há 5 dias                    Última sync: 2 min atrás     │  │
│  │                                                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────┐    │  │
│  │  │  HOJE                                                        │    │  │
│  │  │  47 conversas  •  12 agendamentos  •  98% taxa de resposta  │    │  │
│  │  └─────────────────────────────────────────────────────────────┘    │  │
│  │                                                                       │  │
│  │  [Configurar] [Ver conversas] [Testar] [Desconectar]                │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  INSTAGRAM DM                                          ○ Desconectado│  │
│  │                                                                       │  │
│  │  📷 @odontosorriso                                                    │  │
│  │  Desconectado - Token expirado                                        │  │
│  │                                                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────┐    │  │
│  │  │  Última conexão: 3 dias atrás                                │    │  │
│  │  │  0 conversas  •  0 agendamentos  •  -- taxa de resposta     │    │  │
│  │  └─────────────────────────────────────────────────────────────┘    │  │
│  │                                                                       │  │
│  │  [Reconectar] [Configurar] [Remover]                                 │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  CHAT WIDGET                                           ● Ativo       │  │
│  │                                                                       │  │
│  │  🌐 odontosorriso.com.br                                              │  │
│  │  Incorporado no site                   Última visita: 10 min atrás   │  │
│  │                                                                       │  │
│  │  ┌─────────────────────────────────────────────────────────────┐    │  │
│  │  │  HOJE                                                        │    │  │
│  │  │  8 conversas  •  3 agendamentos  •  75% taxa de resposta    │    │  │
│  │  └─────────────────────────────────────────────────────────────┘    │  │
│  │                                                                       │  │
│  │  [Copiar código] [Personalizar] [Ver conversas] [Desativar]          │  │
│  │                                                                       │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  TEMPLATES DE MENSAGEM                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Nome                Canal           Uso        Ações                │  │
│  │  ───────────────────────────────────────────────────────────────────│  │
│  │  Boas-vindas         WhatsApp        145x       [Editar] [Excluir]   │  │
│  │  Lembrete 24h        WhatsApp        89x        [Editar] [Excluir]   │  │
│  │  Pós-consulta        WhatsApp        67x        [Editar] [Excluir]   │  │
│  │  [+ Novo template]                                                    │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Component: Channel Card

```html
<article
  class="channel-card channel-card--connected"
  role="region"
  aria-label="WhatsApp Web, conectado">

  <header class="channel-card__header">
    <div class="channel-card__icon">
      <svg aria-hidden="true"><!-- WhatsApp icon --></svg>
    </div>
    <div class="channel-card__title">
      <h2 class="channel-card__name">WHATSAPP WEB</h2>
      <span class="channel-card__status channel-card__status--connected">
        ● Conectado
      </span>
    </div>
  </header>

  <div class="channel-card__info">
    <div class="channel-card__phone">
      <span aria-hidden="true">📱</span>
      <span>(11) 99999-0001</span>
    </div>
    <div class="channel-card__timing">
      <span>Conectado há 5 dias</span>
      <span>Última sync: 2 min atrás</span>
    </div>
  </div>

  <div class="channel-card__metrics">
    <h3 class="channel-card__metrics-title">HOJE</h3>
    <dl class="channel-card__metrics-list">
      <div>
        <dt>Conversas</dt>
        <dd>47</dd>
      </div>
      <div>
        <dt>Agendamentos</dt>
        <dd>12</dd>
      </div>
      <div>
        <dt>Taxa resposta</dt>
        <dd>98%</dd>
      </div>
    </dl>
  </div>

  <footer class="channel-card__actions">
    <button class="btn btn--ghost">Configurar</button>
    <button class="btn btn--ghost">Ver conversas</button>
    <button class="btn btn--ghost">Testar</button>
    <button class="btn btn--danger">Desconectar</button>
  </footer>
</article>
```

### 4.3 Component: QR Code Scanner (WhatsApp Setup)

```html
<div
  class="qr-setup"
  role="dialog"
  aria-labelledby="qr-title"
  aria-describedby="qr-instructions">

  <h2 id="qr-title">Conectar WhatsApp</h2>
  <p id="qr-instructions">
    Escaneie o QR Code com o WhatsApp do seu celular
  </p>

  <div class="qr-setup__code">
    <img src="qr-code.png" alt="QR Code para escanear" />
  </div>

  <div class="qr-setup__timer">
    <span>Expira em:</span>
    <span class="qr-setup__countdown">2:45</span>
  </div>

  <div class="qr-setup__steps">
    <ol>
      <li>Abra o WhatsApp no celular</li>
      <li>Toque em Menu > Aparelhos conectados</li>
      <li>Toque em "Conectar um aparelho"</li>
      <li>Aponte a câmera para o QR Code</li>
    </ol>
  </div>

  <div class="qr-setup__status">
    <span class="qr-setup__status-indicator qr-setup__status-indicator--waiting">
      Aguardando escaneamento...
    </span>
  </div>
</div>
```

### 4.4 Component: Template Manager

```html
<article
  class="template-item"
  role="listitem"
  aria-label="Template Boas-vindas, usado 145 vezes">

  <div class="template-item__info">
    <h3 class="template-item__name">Boas-vindas</h3>
    <div class="template-item__meta">
      <span class="template-item__channel">WhatsApp</span>
      <span class="template-item__usage">145 usos</span>
    </div>
  </div>

  <div class="template-item__preview">
    <p>Olá, {nome}! Seja bem-vindo à Clínica Odonto Sorriso...</p>
  </div>

  <div class="template-item__actions">
    <button aria-label="Editar template Boas-vindas">Editar</button>
    <button aria-label="Excluir template Boas-vindas">Excluir</button>
  </div>
</article>
```

---

## 5. Interaction Patterns

### 5.1 Connect WhatsApp

```
1. Clicar [+ Adicionar canal] > WhatsApp
   ↓
2. Modal de setup:
   ┌────────────────────────────┐
   │ CONECTAR WHATSAPP          │
   │                            │
   │ [QR Code exibido]          │
   │                            │
   │ Passos:                    │
   │ 1. Abra WhatsApp           │
   │ 2. Menu > Aparelhos        │
   │ 3. Conectar aparelho       │
   │ 4. Escaneie QR             │
   │                            │
   │ Aguardando escaneamento... │
   │                            │
   │ [Cancelar]                 │
   └────────────────────────────┘
   ↓
3. Polling de status:
   - qr_scanned: "QR escaneado, conectando..."
   - connected: Sucesso!
   - error: Mostrar erro
   ↓
4. Toast: "WhatsApp conectado com sucesso!"
```

### 5.2 Handle Disconnection

```
Quando canal desconecta:

1. Notificação push:
   "WhatsApp desconectado. Clique para reconectar."

2. Card atualiza para status amarelo
   ↓
3. Usuário clica [Reconectar]
   ↓
4. Novo QR Code gerado
   ↓
5. Fluxo normal de conexão
```

### 5.3 Template Variables

```
Variáveis disponíveis:
{nome} - Nome do paciente
{procedimento} - Nome do procedimento
{data} - Data da consulta
{hora} - Hora da consulta
{profissional} - Nome do dentista
{clinica} - Nome da clínica

Exemplo template:
"Olá, {nome}! Lembrete: sua consulta de {procedimento}
 está agendada para {data} às {hora} com {profissional}."

Preview em tempo real:
"Olá, Maria! Lembrete: sua consulta de Limpeza
 está agendada para 27/03 às 14:00 com Dra. Ana."
```

### 5.4 Chat Widget Setup

```
1. Clicar [+ Adicionar canal] > Chat Widget
   ↓
2. Configuração:
   ┌────────────────────────────┐
   │ CONFIGURAR CHAT WIDGET     │
   │                            │
   │ Cor do botão: [●]          │
   │ Posição: (●) Direita       │
   │           ( ) Esquerda     │
   │                            │
   │ Mensagem inicial:          │
   │ [Olá! Como posso ajudar?]  │
   │                            │
   │ Horário de atendimento:    │
   │ [08:00] às [18:00]         │
   │                            │
   │ [Gerar código]             │
   └────────────────────────────┘
   ↓
3. Código gerado:
   ┌────────────────────────────┐
   │ COPIE E COLE NO SEU SITE   │
   │                            │
   │ <script>                   │
   │   src="https://..."        │
   │   data-clinic="..."        │
   │ </script>                  │
   │                            │
   │ [Copiar código]            │
   │                            │
   │ Testar em: [Preview]       │
   └────────────────────────────┘
```

---

## 6. States & Variations

### 6.1 No Channels

```
┌────────────────────────────────────────┐
│                                        │
│            📱                          │
│                                        │
│     Nenhum canal conectado             │
│                                        │
│  Conecte um canal para começar a       │
│  receber mensagens dos pacientes.      │
│                                        │
│         [+ Adicionar canal]            │
│                                        │
│  Canais disponíveis:                   │
│  • WhatsApp                            │
│  • Instagram DM                        │
│  • Chat Widget                         │
│                                        │
└────────────────────────────────────────┘
```

### 6.2 Error State

```
┌──────────────────────────────────────────────────────────────────────┐
│  WHATSAPP WEB                                           ✕ Erro       │
│                                                                       │
│  📱 (11) 99999-0001                                                   │
│                                                                       │
│  ⚠️ ERRO: Número banido pelo WhatsApp                                 │
│                                                                       │
│  Possíveis causas:                                                    │
│  • Muitas mensagens enviadas rapidamente                             │
│  • Conteúdo reportado por usuários                                   │
│  • Violação dos termos de uso                                        │
│                                                                       │
│  Soluções:                                                            │
│  1. Aguarde 24-48 horas para ban temporário                          │
│  2. Contate suporte do WhatsApp                                      │
│  3. Use um novo número                                                │
│                                                                       │
│  [Contatar suporte] [Tentar novo número] [Ver logs]                  │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.3 Rate Limited

```
┌──────────────────────────────────────────────────────────────────────┐
│  WHATSAPP WEB                                     ⏳ Rate Limited    │
│                                                                       │
│  ⚠️ Limite de mensagens atingido                                      │
│                                                                       │
│  Mensagens hoje: 1,247 / 1,000 (limite)                              │
│  Reset em: 4 horas 23 minutos                                        │
│                                                                       │
│  Recomendações:                                                       │
│  • Aguarde o reset do limite                                         │
│  • Considere upgrade para WhatsApp Business API                      │
│  • Otimize templates para mensagens mais curtas                      │
│                                                                       │
│  [Ver detalhes] [Upgrade para API]                                   │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 7. Accessibility Guidelines

### 7.1 Status Indicators

- Use color AND text for status
- Include aria-live regions for status changes
- Provide audible alerts for disconnections

```html
<div role="status" aria-live="polite" aria-atomic="true">
  <span class="sr-only">WhatsApp desconectado</span>
  <span class="channel-status channel-status--disconnected">
    ○ Desconectado
  </span>
</div>
```

### 7.2 Keyboard Navigation

| Tecla | Ação |
|-------|------|
| `Tab` | Navegar entre cards |
| `Enter` | Abrir configuração |
| `Escape` | Fechar modal |

---

## 8. Mobile Responsiveness

### 8.1 Mobile Layout (< 768px)

```
┌─────────────────────────────┐
│  CANAIS          [+ Adic.]  │
├─────────────────────────────┤
│                             │
│  ┌─────────────────────────┐│
│  │ WHATSAPP WEB            ││
│  │ ● Conectado              ││
│  │                          ││
│  │ 📱 (11) 99999-0001       ││
│  │ Sync: 2 min atrás        ││
│  │                          ││
│  │ 47 conversas hoje        ││
│  │ 98% resposta             ││
│  │                          ││
│  │ [Configurar] [Testar]    ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ INSTAGRAM DM             ││
│  │ ○ Desconectado           ││
│  │                          ││
│  │ 📷 @odontosorriso        ││
│  │ Token expirado           ││
│  │                          ││
│  │ [Reconectar]             ││
│  └─────────────────────────┘│
│                             │
│  ┌─────────────────────────┐│
│  │ CHAT WIDGET              ││
│  │ ● Ativo                  ││
│  │                          ││
│  │ 🌐 odontosorriso.com.br  ││
│  │ 8 conversas hoje         ││
│  │                          ││
│  │ [Copiar código]          ││
│  └─────────────────────────┘│
│                             │
└─────────────────────────────┘
```

---

## 9. API Integration

### 9.1 Endpoints Used

| Endpoint | Use Case |
|----------|----------|
| `GET /whatsapp/instances` | Listar números |
| `POST /whatsapp/connect` | Conectar número |
| `POST /whatsapp/disconnect` | Desconectar |
| `GET /whatsapp/qr` | Obter QR Code |
| `POST /whatsapp/webhook` | Receber eventos |

### 9.2 WebSocket Events

```javascript
const ws = new WebSocket('wss://api.synkroo.com/channels');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'channel_connected':
      // Update status to connected
      break;
    case 'channel_disconnected':
      // Show reconnection prompt
      break;
    case 'rate_limit_warning':
      // Show warning banner
      break;
    case 'qr_scanned':
      // Update setup wizard
      break;
  }
};
```

---

## Next Steps

- [ ] Criar protótipo de QR Code scanner
- [ ] Testar fluxo de reconexão
- [ ] Validar templates com dentistas
- [ ] Implementar preview de chat widget