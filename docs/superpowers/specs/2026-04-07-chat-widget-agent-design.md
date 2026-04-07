# Chat Widget + Notificações do Agente - Design Spec

**Versão:** 1.0
**Data:** 2026-04-07
**Status:** Aprovado
**Baseado em:** Brainstorming com Walis

---

## 1. Visão Geral

O ChatWidget é a interface principal para comunicação entre o usuário da clínica (recepcionista) e o Agente IA. O agente SDK controla todo o sistema, e o widget permite que o usuário interaja com ele de forma intuitiva para:

- Gerenciar pacientes (agendar, cancelar, remarcar)
- Visualizar ações do agente em tempo real
- Receber notificações visuais das ações executadas

**Público-alvo:** Recepcionistas sem conhecimento técnico
**Princípio:** Interface simples, visual, intuitiva - sem complexidade desnecessária

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DASHBOARD (React)                            │
│                                                                      │
│  ┌──────────────────┐    ┌──────────────────────────────────────┐   │
│  │   ChatWidget     │    │     NotificationCard (Toast)        │   │
│  │   (Floating)     │    │     ┌────────────────────────┐     │   │
│  │                  │    │     │ 📅 AGENDA      14:32 │     │   │
│  │  💬 [Botão]     │    │     ├────────────────────────┤     │   │
│  │                  │    │     │ Maria Silva - Consulta│     │   │
│  │  ┌────────────┐  │    │     │ agendada             │     │   │
│  │  │ Olá!       │  │    │     │ Qui, 27/03 14:00    │     │   │
│  │  │ Como posso  │  │    │     │ Dr. Roberto         │     │   │
│  │  │ ajudar?    │  │    │     ├────────────────────────┤     │   │
│  │  └────────────┘  │    │     │[Ver] [Cancelar]      │     │   │
│  │                  │    │     └────────────────────────┘     │   │
│  │  ┌────────────┐  │    │                                      │   │
│  │  │ Digite...  │  │    └──────────────────────────────────────┘   │
│  │  └────────────┘  │                                               │
│  └──────────────────┘                                               │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  NotificationPreferences (Settings Modal)                      │  │
│  │  ☑ Agenda (agendamentos, cancelamentos, remarques)         │  │
│  │  ☑ Pacientes (novos pacientes, reativações)                  │  │
│  │  ☐ Lembretes (lembretes enviados)                            │  │
│  │  ☐ Campanhas (ações de marketing)                            │  │
│  │  ☐ Financeiro (orçamentos, pagamentos)                     │  │
│  │  ☑ Sistema (erros, alertas técnicos)                         │  │
│  └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                   │
│                                                                      │
│  POST /api/widget/messages    → Chat messages                       │
│  GET  /api/notifications     → Poll notifications                   │
│  GET  /api/notifications/preferences → Get preferences             │
│  PUT  /api/notifications/preferences → Update preferences          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      AGENT SERVICE                                   │
│                                                                      │
│  AgentService (Singleton)                                            │
│  ├── processMessage()           → Processa mensagem do widget       │
│  ├── emitNotification()        → Emite notificação após ação        │
│  └── NotificationService        → Gerencia preferências             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Componentes

### 3.1 ChatWidget

**Localização:** `src/components/chat-widget/ChatWidget.tsx`

**Estado:**
- `messages: Message[]` - Histórico de mensagens
- `isOpen: boolean` - Widget aberto/fechado
- `isLoading: boolean` - Aguardando resposta
- `conversationId: string | null` - ID da conversa

**Fluxo:**
1. Usuário envia mensagem
2. Widget faz POST para `/api/widget/messages`
3. Mensagem otimista adicionada ao estado
4. Aguarda resposta do agente
5. Resposta adicionada ao chat

### 3.2 NotificationCard

**Localização:** `src/components/notifications/NotificationCard.tsx`

**Props:**
```typescript
interface NotificationCardProps {
  notification: Notification
  onDismiss: () => void
  onAction: (action: NotificationAction) => void
}
```

**Estrutura Visual:**
```
┌─────────────────────────────────────┐
│ 📅 AGENDA                    14:32  │
├─────────────────────────────────────┤
│ Maria Silva - Consulta agendada      │
│ Quinta, 27/03 às 14:00            │
│ Dr. Roberto                         │
├─────────────────────────────────────┤
│ [Ver paciente]    [Cancelar]       │
└─────────────────────────────────────┘
```

**Tipos de Notificação:**
| Tipo | Ícone | Cor | Ações |
|------|--------|-----|-------|
| agenda | 📅 | Azul | Ver paciente, Cancelar |
| paciente | 👤 | Verde | Ver paciente |
| lembrete | 🔔 | Amarelo | Ver detalhes |
| campanha | 📣 | Roxo | Ver detalhes |
| financeiro | 💰 | Verde | Ver detalhes |
| sistema | ⚠️ | Vermelho | Ver detalhes |

### 3.3 NotificationPreferences

**Localização:** `src/components/notifications/NotificationPreferences.tsx`

**Categorias:**
```typescript
interface NotificationPreferences {
  agenda: boolean       // default: true
  pacientes: boolean   // default: true
  lembretes: boolean   // default: false
  campanhas: boolean    // default: false
  financeiro: boolean   // default: false
  sistema: boolean     // default: true
}
```

**Persistência:** localStorage (v1), futura migration para banco

---

## 4. API Endpoints

### 4.1 POST /api/widget/messages

Envia mensagem e recebe resposta do agente + notificações.

**Request:**
```json
{
  "clinic_id": "uuid",
  "visitor_id": "string",
  "message": "Quero agendar uma consulta",
  "conversation_id": "uuid (opcional)"
}
```

**Response:**
```json
{
  "conversation_id": "uuid",
  "user_message": {
    "id": "uuid",
    "content": "Quero agendar uma consulta"
  },
  "bot_response": {
    "id": "uuid",
    "content": "Para qual dia você gostaria de agendar?",
    "intent": "agendamento"
  },
  "notifications": [
    {
      "id": "uuid",
      "type": "agenda",
      "title": "Consulta agendada",
      "message": "Maria Silva - Quinta, 27/03 às 14:00",
      "data": { /* dados da ação */ },
      "timestamp": "2026-04-07T14:32:00Z"
    }
  ]
}
```

### 4.2 GET /api/notifications/preferences

**Response:**
```json
{
  "agenda": true,
  "pacientes": true,
  "lembretes": false,
  "campanhas": false,
  "financeiro": false,
  "sistema": true
}
```

### 4.3 PUT /api/notifications/preferences

**Request:**
```json
{
  "agenda": true,
  "pacientes": false,
  "lembretes": false,
  "campanhas": false,
  "financeiro": false,
  "sistema": true
}
```

---

## 5. Fluxo de Notificações

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FLUXO DE NOTIFICAÇÃO                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. USUÁRIO ENVIA MENSAGEM                                         │
│     └─→ ChatWidget → POST /api/widget/messages                      │
│                                                                      │
│  2. AGENTE PROCESSA                                                 │
│     └─→ AgentService.processMessage()                               │
│         ├── Classifica intenção                                    │
│         ├── Executa ação                                           │
│         └── Verifica preferências de notificação                    │
│                                                                      │
│  3. NOTIFICAÇÃO GERADA (dentro do response)                        │
│     └─→ Notifications[] inclusas na response                        │
│         └── Sem persistência no banco (v1)                         │
│                                                                      │
│  4. CHATWIDGET EXIBE                                               │
│     └─→ Response含着notifications[]                                │
│         ├── Mensagem do bot no chat                                 │
│         └── NotificationCard(s) na tela                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6. Modelo de Dados

### 6.1 Simplificado (v1)

Sem tabela no banco. Notificações são geradas e retornadas diretamente na response.

### 6.2 Tipo: Notification

```typescript
interface Notification {
  id: string
  type: 'agenda' | 'paciente' | 'lembrete' | 'campanha' | 'financeiro' | 'sistema'
  title: string
  message: string
  data: Record<string, any>
  timestamp: string
}
```

### 6.3 Futura Tabela (v2)

```sql
CREATE TABLE pending_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  data JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT now() + INTERVAL '24 hours'
);
```

---

## 7. AgentService - Emissão de Notificações

### 7.1 Integração Simplificada (v1)

AgentService.processMessage() retorna notifications[] diretamente na response:

```typescript
// Exemplo de fluxo
async processMessage(conversationId, message, metadata) {
  const response = await this.executeAction(intent, entities)

  // Gerar notificações baseadas na ação
  const notifications = []
  if (shouldNotify(response.action)) {
    notifications.push({
      id: generateUUID(),
      type: mapActionToType(response.action),
      title: getNotificationTitle(response.action),
      message: getNotificationMessage(response),
      data: response.data,
      timestamp: new Date().toISOString()
    })
  }

  return { ...response, notifications }
}
```

### 7.2 Mapeamento Ação → Notificação

| Ação | Tipo | Título |
|------|------|--------|
| book_appointment | agenda | Consulta agendada |
| cancel_appointment | agenda | Consulta cancelada |
| reschedule_appointment | agenda | Consulta remarcada |
| create_patient | paciente | Novo paciente |
| reactivate_patient | paciente | Paciente reativado |
| send_reminder | lembrete | Lembrete enviado |
| send_campaign | campanha | Campanha iniciada |
| create_quote | financeiro | Orçamento criado |

---

## 8. Persistência de Preferências (v1)

**localStorage key:** `synkroo_notification_preferences`

```typescript
// Estrutura
{
  agenda: true,
  pacientes: true,
  lembretes: false,
  campanhas: false,
  financeiro: false,
  sistema: true
}
```

**Futura migração:** Salvar no banco de dados por clínica para persistência cross-device.

---

## 9. Implementação - Prioridades

### Fase 1: Core (esse PR)
- [ ] NotificationCard component
- [ ] NotificationPreferences modal
- [ ] AgentService.processMessage() retorna notifications[] na response
- [ ] ChatWidget exibe NotificationCards baseado na response
- [ ] Auto-dismiss após 30 segundos
- [ ] Badge no ícone do chat (contador de não-lidas)

### Simplificações v1:
- Sem polling (notificações retornadas na response)
- Sem tabela `pending_notifications` (notificações fluem diretamente)
- Preferências em localStorage (futuro: migrar para banco)

### Fase 2: Melhorias (PR futuro)
- [ ] Sound notification (opcional)
- [ ] Histórico de notificações
- [ ] Snooze functionality

---

## 10. Considerações Técnicas

### 10.1 Performance
- Polling: 10 segundos (não agressivo)
- Notification cards: máximo 3 simultâneas
- Auto-dismiss: 10 segundos

### 10.2 LGPD
- Notificações não contêm dados sensíveis
- Dados de pacientes minimizados (apenas nome + ação)
- Preferências salvas localmente (v1)

### 10.3 Offline/Degraded
- Se API falhar: silently fail, não mostrar erro
- Notificações são "nice to have", não críticas

---

## 11. Contexto: Arquitetura Agent SDK

Este design está alinhado com a arquitetura 4+1 do Agent SDK (docs/superpowers/specs/2026-03-25-agent-design.md):

- **Orchestrator Agent:** Recebe mensagens via ChatWidget
- **Router Agent:** Classifica intenção
- **Scheduler/Sales/Generalist:** Executam ações
- **NotificationService:** Emite notificações pós-ação
- **Memory Layers:** Continuam funcionando (L1-L5)

O ChatWidget é apenas a **interface de comunicação**, não altera a arquitetura interna do agente.

---

## 12. Screenshots/Mockups (Futuro)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│                                              ┌─────────────────────┐│
│                                              │ 📅 AGENDA    14:32 ││
│  ┌─────────────────────────────────────┐    ├─────────────────────┤│
│  │ Synkroo - Chat do Agente       [−]  │    │Maria Silva          ││
│  ├─────────────────────────────────────┤    │Consulta agendada    ││
│  │                                       │    │Qui, 27/03 14:00   ││
│  │  ┌─────────────────────────────────┐│    │Dr. Roberto         ││
│  │  │ Olá! Sou o assistente Synkroo. ││    ├─────────────────────┤│
│  │  │ Como posso ajudar sua clínica?  ││    │[Ver]    [Cancelar] ││
│  │  └─────────────────────────────────┘│    └─────────────────────┘│
│  │                                       │                        │
│  │              ┌────────────────────┐   │    ┌─────────────────┐ │
│  │              │ Quero agendar uma  │   │    │ ⚠️ SISTEMA 14:30│ │
│  │              │ consulta para o    │   │    ├─────────────────┤ │
│  │              │ Dr. Roberto       │   │    │Erro ao conectar │ │
│  │              └────────────────────┘   │    │com WhatsApp     │ │
│  │                                       │    ├─────────────────┤ │
│  │  ┌─────────────────────────────────┐│    │[Ver detalhes]    │ │
│  │  │ Vou agendar para quinta às 14h  ││    └─────────────────┘ │
│  │  │ com o Dr. Roberto. Confirma?   ││                        │
│  │  └─────────────────────────────────┘│                        │
│  │                                       │                        │
│  ├─────────────────────────────────────┤                        │
│  │ [Digite sua mensagem...]        [➤] │                        │
│  └─────────────────────────────────────┘                        │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ 🔔 Notificações                              [⚙️ Configurar] │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

**Aprovado por:** Walis
**Data:** 2026-04-07
