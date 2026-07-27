# API Contracts & Schemas

**Versão:** 1.0.0
**Data:** 2026-03-27
**Formato:** OpenAPI 3.1.0 + TypeScript

---

## Visão Geral

O Synkroo expõe APIs REST para integração com canais externos (WhatsApp, Instagram, Chat Widget) e para o dashboard administrativo. Este documento define os contratos estáveis.

---

## Base URL

```
Production: https://api.synkroo.com/v1
Staging:    https://api-staging.synkroo.com/v1
Local:      http://localhost:3000/api/v1
```

---

## Autenticação

### Bearer Token (JWT)

```http
Authorization: Bearer <jwt_token>
```

### Headers Obrigatórios

```http
Content-Type: application/json
X-Clinic-ID: <clinic_uuid>
X-Request-ID: <correlation_uuid>
```

---

## Schemas Comuns

### Error Response

```typescript
interface APIError {
  error: {
    code: string;          // "INVALID_INPUT", "UNAUTHORIZED", "NOT_FOUND"
    message: string;       // Human-readable message
    details?: Record<string, unknown>;
    requestId: string;     // Correlation ID
    timestamp: string;     // ISO 8601
  };
}
```

### Pagination

```typescript
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}
```

### Timestamps

```typescript
interface Timestamps {
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}
```

---

## Endpoints

### 1. Mensagens (Messages)

#### POST /messages/incoming

Recebe mensagens de webhooks externos (WhatsApp, Instagram).

**Request:**

```typescript
interface IncomingMessageRequest {
  channel: 'whatsapp' | 'instagram' | 'chat_widget';
  from: string;           // Phone number or user ID
  to: string;             // Clinic's WhatsApp number or Instagram account
  content: {
    type: 'text' | 'image' | 'audio' | 'document';
    text?: string;
    mediaUrl?: string;
    mimeType?: string;
  };
  timestamp: string;      // ISO 8601
  metadata?: {
    messageId?: string;   // Platform message ID
    replyTo?: string;     // If replying to a message
  };
}
```

**Response:**

```typescript
interface IncomingMessageResponse {
  success: boolean;
  messageId: string;      // Internal message ID
  status: 'queued' | 'processing';
}
```

#### POST /messages/outgoing

Envia mensagem para um paciente.

**Request:**

```typescript
interface OutgoingMessageRequest {
  patientId: string;
  channel: 'whatsapp' | 'instagram' | 'chat_widget';
  content: {
    type: 'text' | 'template' | 'image' | 'document';
    text?: string;
    templateId?: string;
    templateParams?: Record<string, string>;
    mediaUrl?: string;
  };
  metadata?: {
    appointmentId?: string;
    automated?: boolean;
  };
}
```

**Response:**

```typescript
interface OutgoingMessageResponse {
  success: boolean;
  messageId: string;
  externalMessageId?: string;  // Platform message ID
  status: 'sent' | 'delivered' | 'failed';
  error?: string;
}
```

---

### 2. Agendamentos (Appointments)

#### GET /appointments

Lista agendamentos com filtros.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `patientId` | UUID | Não | Filtrar por paciente |
| `dentistId` | UUID | Não | Filtrar por dentista |
| `status` | Enum | Não | `scheduled`, `confirmed`, `completed`, `cancelled`, `no_show` |
| `dateFrom` | Date | Não | Data início (YYYY-MM-DD) |
| `dateTo` | Date | Não | Data fim (YYYY-MM-DD) |
| `page` | Number | Não | Página (default: 1) |
| `pageSize` | Number | Não | Itens por página (default: 20, max: 100) |

**Response:**

```typescript
interface Appointment {
  id: string;
  clinicId: string;
  patientId: string;
  dentistId?: string;
  datetime: string;       // ISO 8601
  durationMinutes: number;
  procedure: string;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  notes?: string;
  reminderSentAt?: string;
  confirmedAt?: string;
  createdAt: string;
  updatedAt: string;
}

type AppointmentListResponse = PaginatedResponse<Appointment>;
```

#### POST /appointments

Cria novo agendamento.

**Request:**

```typescript
interface CreateAppointmentRequest {
  patientId: string;
  dentistId?: string;
  datetime: string;       // ISO 8601
  durationMinutes: number;
  procedure: string;
  notes?: string;
  sendReminder?: boolean; // Default: true
}
```

**Response:**

```typescript
interface CreateAppointmentResponse {
  success: boolean;
  appointment: Appointment;
  conflicts?: string[];   // IDs of conflicting appointments if any
}
```

#### PATCH /appointments/:id

Atualiza agendamento existente.

**Request:**

```typescript
interface UpdateAppointmentRequest {
  datetime?: string;
  durationMinutes?: number;
  procedure?: string;
  status?: Appointment['status'];
  notes?: string;
  dentistId?: string;
}
```

#### GET /appointments/availability

Consulta disponibilidade.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `dentistId` | UUID | Sim | ID do dentista |
| `date` | Date | Sim | Data (YYYY-MM-DD) |
| `durationMinutes` | Number | Não | Duração (default: 60) |

**Response:**

```typescript
interface AvailabilitySlot {
  startTime: string;      // ISO 8601
  endTime: string;        // ISO 8601
  available: boolean;
}

interface AvailabilityResponse {
  date: string;
  dentistId: string;
  slots: AvailabilitySlot[];
}
```

---

### 3. Pacientes (Patients)

#### GET /patients

Lista pacientes.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `search` | String | Não | Busca por nome, telefone, email |
| `active` | Boolean | Não | Filtrar pacientes ativos |
| `page` | Number | Não | Página |
| `pageSize` | Number | Não | Itens por página |

**Response:**

```typescript
interface Patient {
  id: string;
  clinicId: string;
  name: string;
  phone: string;
  email?: string;
  birthDate?: string;
  notes?: string;
  lastAppointmentAt?: string;
  totalAppointments: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

type PatientListResponse = PaginatedResponse<Patient>;
```

#### POST /patients

Cria novo paciente.

**Request:**

```typescript
interface CreatePatientRequest {
  name: string;
  phone: string;
  email?: string;
  birthDate?: string;
  notes?: string;
}
```

---

### 4. Conversas (Conversations)

#### GET /conversations

Lista conversas.

**Query Parameters:**

| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|-------------|-----------|
| `status` | Enum | Não | `active`, `resolved`, `pending` |
| `patientId` | UUID | Não | Filtrar por paciente |
| `page` | Number | Não | Página |

**Response:**

```typescript
interface Conversation {
  id: string;
  clinicId: string;
  patientId?: string;
  channel: 'whatsapp' | 'instagram' | 'chat_widget';
  status: 'active' | 'resolved' | 'pending';
  lastMessageAt: string;
  messageCount: number;
  unreadCount: number;
  patient?: Patient;
  createdAt: string;
  updatedAt: string;
}

type ConversationListResponse = PaginatedResponse<Conversation>;
```

#### GET /conversations/:id/messages

Lista mensagens de uma conversa.

**Response:**

```typescript
interface Message {
  id: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  content: {
    type: 'text' | 'image' | 'audio' | 'document';
    text?: string;
    mediaUrl?: string;
  };
  status: 'sent' | 'delivered' | 'read' | 'failed';
  createdAt: string;
}

type MessageListResponse = PaginatedResponse<Message>;
```

---

### 5. Webhooks

#### POST /webhooks/whatsapp

Recebe webhooks do WhatsApp Business API.

**Headers:**

```http
X-Hub-Signature-256: sha256=<signature>
```

**Payload:** Segue especificação Meta WhatsApp Business API

#### POST /webhooks/instagram

Recebe webhooks do Instagram Messaging.

**Headers:**

```http
X-Hub-Signature-256: sha256=<signature>
```

---

## Rate Limiting

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| `/messages/*` | 100 requests | 1 minute |
| `/appointments/*` | 60 requests | 1 minute |
| `/patients/*` | 60 requests | 1 minute |
| `/conversations/*` | 60 requests | 1 minute |

**Response Headers:**

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1648771200
```

---

## Versioning

- API versionada via URL path (`/v1/`, `/v2/`)
- Breaking changes = nova versão major
- Non-breaking changes = backward compatible

---

## OpenAPI Specification

Arquivo completo disponível em: `docs/api/openapi.yaml`

```yaml
openapi: 3.1.0
info:
  title: Synkroo API
  version: 1.0.0
  description: API para plataforma de automação de clínicas odontológicas

servers:
  - url: https://api.synkroo.com/v1
    description: Production
  - url: https://api-staging.synkroo.com/v1
    description: Staging

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

security:
  - bearerAuth: []

paths:
  # ... (full specification in openapi.yaml)
```

---

## TypeScript Types

Todos os tipos TypeScript estão disponíveis em: `src/types/api.ts`

```typescript
// Re-export all API types
export * from './api/messages';
export * from './api/appointments';
export * from './api/patients';
export * from './api/conversations';
export * from './api/common';
```

---

## Contratos de Eventos (Event Contracts)

### Eventos Publicados

| Evento | Schema | Consumidores |
|--------|--------|--------------|
| `message.received` | `{ messageId, channel, from, content }` | Orchestrator, Analytics |
| `message.sent` | `{ messageId, channel, to, status }` | Analytics, Notifications |
| `appointment.created` | `{ appointmentId, patientId, datetime }` | Reminder Worker, Analytics |
| `appointment.updated` | `{ appointmentId, changes }` | Reminder Worker |
| `appointment.cancelled` | `{ appointmentId, reason }` | Analytics, Waitlist |
| `patient.created` | `{ patientId, name, phone }` | CRM Sync, Analytics |

### Schema Registry

Todos os eventos seguem schema versionado:

```typescript
interface Event<T> {
  id: string;              // Event ID
  type: string;            // Event type
  version: string;         // Schema version (e.g., "1.0.0")
  timestamp: string;       // ISO 8601
  source: string;          // Service that emitted the event
  clinicId: string;        // Tenant ID
  correlationId: string;   // Request correlation
  data: T;                 // Event payload
}
```

---

## Referências

- [OpenAPI Specification](https://spec.openapis.org/oas/v3.1.0)
- [AsyncAPI for Events](https://www.asyncapi.com/)
- [JSON Schema](https://json-schema.org/)