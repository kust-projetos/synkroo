# Testing Strategy

**Versão:** 1.0.0
**Data:** 2026-03-27
**Responsável:** Winston (Arquiteto)

---

## Visão Geral

Estratégia de testes baseada na **Testing Trophy** com foco em testes de integração e E2E, priorizando confiança sobre cobertura.

---

## Testing Trophy

```
            ╭───────────────╮
            │      E2E      │  ← Few (5-10%)
            │   High value  │
            ╰───────┬───────╯
                    │
        ╭──────────┴──────────╮
        │    Integration      │  ← Many (40-50%)
        │   High confidence   │
        ╰──────────┬──────────╯
                   │
     ╭─────────────┴─────────────╮
     │       Unit Tests          │  ← Some (30-40%)
     │     Fast feedback         │
     ╰─────────────┬─────────────╯
                   │
  ╭────────────────┴────────────────╮
  │        Static Analysis          │  ← Most (10-20%)
  │   TypeScript, ESLint, Previews  │
  ╰─────────────────────────────────╯
```

---

## Tipos de Teste

### 1. Static Analysis

**Ferramentas:**
- **TypeScript:** Type checking
- **ESLint:** Code quality, best practices
- **Prettier:** Code formatting
- **tsc --noEmit:** CI type validation

**Configuração:**

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 2. Unit Tests

**Escopo:** Testar funções puras, utilitários, lógica de domínio

**Ferramentas:**
- **Vitest** (test runner)
- **@testing-library/react** (React components)
- **MSW** (API mocking)

**Convenções:**

```typescript
// ✅ Good: Test behavior, not implementation
describe('formatPhoneNumber', () => {
  it('should format Brazilian phone numbers', () => {
    const result = formatPhoneNumber('11999887766');
    expect(result).toBe('+55 11 99988-7766');
  });

  it('should return null for invalid numbers', () => {
    const result = formatPhoneNumber('invalid');
    expect(result).toBeNull();
  });
});

// ❌ Bad: Testing implementation details
describe('formatPhoneNumber', () => {
  it('should call cleanDigits function', () => {
    const spy = vi.spyOn(utils, 'cleanDigits');
    formatPhoneNumber('11999887766');
    expect(spy).toHaveBeenCalled();
  });
});
```

**O que testar:**
- ✅ Value objects (Email, Phone, Money)
- ✅ Domain logic (scheduling rules, availability)
- ✅ Utility functions (formatters, validators)
- ✅ React hooks (custom hooks logic)
- ✅ State machines

**O que NÃO testar:**
- ❌ Framework code (Next.js internals)
- ❌ Third-party libraries (already tested)
- ❌ Trivial getters/setters
- ❌ Implementation details

### 3. Integration Tests

**Escopo:** Testar interações entre componentes, APIs, banco de dados

**Ferramentas:**
- **Vitest** + **@testing-library/react**
- **Supertest** (API testing)
- **MSW** (HTTP mocking)
- **Testcontainers** (real database)

**API Integration Tests:**

```typescript
// __tests__/api/appointments.test.ts
import { createTestClient } from '@/test/utils';
import { createTestClinic, createTestPatient } from '@/test/fixtures';

describe('POST /api/v1/appointments', () => {
  it('should create appointment successfully', async () => {
    const clinic = await createTestClinic();
    const patient = await createTestPatient({ clinicId: clinic.id });

    const response = await createTestClient({ clinicId: clinic.id })
      .post('/api/v1/appointments')
      .send({
        patientId: patient.id,
        datetime: '2026-03-28T10:00:00Z',
        procedure: 'Limpeza',
        durationMinutes: 60,
      });

    expect(response.status).toBe(201);
    expect(response.body.appointment).toMatchObject({
      status: 'scheduled',
      procedure: 'Limpeza',
    });
  });

  it('should reject overlapping appointments', async () => {
    // ... test conflict handling
  });
});
```

**Database Integration Tests:**

```typescript
// __tests__/db/appointments-repo.test.ts
import { TestDatabase } from '@/test/containers';
import { AppointmentsRepository } from '@/lib/repositories';

describe('AppointmentsRepository', () => {
  let db: TestDatabase;
  let repo: AppointmentsRepository;

  beforeAll(async () => {
    db = await TestDatabase.start();
    repo = new AppointmentsRepository(db.pool);
  });

  afterAll(async () => {
    await db.stop();
  });

  it('should find available slots', async () => {
    const slots = await repo.findAvailability({
      dentistId: 'dentist-1',
      date: '2026-03-28',
      durationMinutes: 60,
    });

    expect(slots).toContainEqual({
      startTime: expect.any(String),
      endTime: expect.any(String),
      available: true,
    });
  });
});
```

**React Component Integration:**

```typescript
// __tests__/components/appointment-form.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppointmentForm } from '@/components/appointments';
import { server } from '@/test/mocks/server';

describe('AppointmentForm', () => {
  it('should submit valid appointment', async () => {
    const onSuccess = vi.fn();

    render(<AppointmentForm onSuccess={onSuccess} />);

    await userEvent.type(screen.getByLabelText('Paciente'), 'João Silva');
    await userEvent.type(screen.getByLabelText('Data'), '2026-03-28');
    await userEvent.selectOptions(screen.getByLabelText('Procedimento'), 'Limpeza');

    await userEvent.click(screen.getByText('Agendar'));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('should show error for invalid date', async () => {
    // ... test error handling
  });
});
```

### 4. E2E Tests

**Escopo:** Testar fluxos críticos do usuário end-to-end

**Ferramentas:**
- **Playwright** (browser automation)
- **Real database** (test environment)

**Fluxos Críticos:**

1. **Message Flow:** WhatsApp message → AI response → Appointment created
2. **Booking Flow:** Patient sends "quero agendar" → Slots shown → Confirmation
3. **Reminder Flow:** Appointment created → Reminder sent → Patient confirms

**E2E Test Example:**

```typescript
// e2e/booking-flow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Booking Flow', () => {
  test('should complete booking via WhatsApp simulation', async ({ page }) => {
    // Navigate to clinic dashboard
    await page.goto('/dashboard/test-clinic');

    // Open WhatsApp simulator
    await page.click('[data-testid="whatsapp-simulator"]');

    // Send message
    await page.fill('[data-testid="message-input"]', 'Quero agendar uma limpeza');
    await page.click('[data-testid="send-button"]');

    // Wait for AI response
    await expect(page.locator('[data-testid="ai-response"]')).toBeVisible({ timeout: 10000 });

    // Verify response contains scheduling options
    const response = await page.locator('[data-testid="ai-response"]').textContent();
    expect(response).toContain('horários');

    // Select slot
    await page.click('[data-testid="slot-10am"]');

    // Confirm
    await page.click('[data-testid="confirm-button"]');

    // Verify appointment created
    await expect(page.locator('[data-testid="appointment-created"]')).toBeVisible();
  });
});
```

---

## Test Fixtures & Factories

**Factory Pattern:**

```typescript
// test/fixtures/index.ts
import { faker } from '@faker-js/faker';

export function createTestClinic(overrides = {}) {
  return {
    id: faker.string.uuid(),
    name: faker.company.name(),
    whatsappNumber: faker.phone.number('+55###########'),
    settings: {
      businessHours: { start: '08:00', end: '18:00' },
      reminderEnabled: true,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function createTestPatient(overrides = {}) {
  return {
    id: faker.string.uuid(),
    clinicId: faker.string.uuid(),
    name: faker.person.fullName(),
    phone: faker.phone.number('+55###########'),
    email: faker.internet.email(),
    active: true,
    ...overrides,
  };
}

export function createTestAppointment(overrides = {}) {
  return {
    id: faker.string.uuid(),
    clinicId: faker.string.uuid(),
    patientId: faker.string.uuid(),
    datetime: faker.date.future(),
    procedure: 'Limpeza',
    durationMinutes: 60,
    status: 'scheduled',
    ...overrides,
  };
}
```

---

## Test Database

**Estratégia:** Testcontainers com PostgreSQL real

```typescript
// test/containers/database.ts
import { GenericContainer, Wait } from 'testcontainers';

export class TestDatabase {
  private container;
  public connectionString: string;

  async start() {
    this.container = await new GenericContainer('postgres:15-alpine')
      .withEnvironment('POSTGRES_USER', 'test')
      .withEnvironment('POSTGRES_PASSWORD', 'test')
      .withEnvironment('POSTGRES_DB', 'synkroo_test')
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage('database system is ready'))
      .start();

    this.connectionString = `postgresql://test:test@localhost:${this.container.getMappedPort(5432)}/synkroo_test`;
    await this.runMigrations();
  }

  async stop() {
    await this.container.stop();
  }

  private async runMigrations() {
    // Run Prisma migrations
    execSync(`npx prisma migrate deploy`, {
      env: { ...process.env, DATABASE_URL: this.connectionString },
    });
  }
}
```

---

## Mocking Strategy

### HTTP Mocking (MSW)

```typescript
// test/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.post('https://api.claude.ai/v1/messages', () => {
    return HttpResponse.json({
      content: [{ type: 'text', text: 'Claro! Tenho horários disponíveis...' }],
    });
  }),

  http.post('https://graph.facebook.com/v18.0/*/messages', () => {
    return HttpResponse.json({
      messages: [{ id: 'wamid.xxx' }],
    });
  }),
];
```

### Database Mocking

```typescript
// ❌ Don't mock database - use real database in tests
// ✅ Use test database with transactions

beforeEach(async () => {
  await db.query('BEGIN');
});

afterEach(async () => {
  await db.query('ROLLBACK');
});
```

---

## Coverage Targets

| Tipo | Target | Rationale |
|------|--------|-----------|
| Unit | 80% | Logic-heavy modules |
| Integration | 70% | API endpoints, critical paths |
| E2E | N/A | Quality over quantity |

**Exclusions from Coverage:**
- Type definitions
- Configuration files
- Generated code
- Test files themselves

---

## CI Integration

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: synkroo_test
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      - name: Run type check
        run: npm run typecheck

      - name: Run lint
        run: npm run lint

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/synkroo_test

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

---

## Testing Commands

```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch

# Update snapshots
npm run test:update-snapshots
```

---

## Referências

- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- [MSW Best Practices](https://mswjs.io/docs/best-practices/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Testing Library Principles](https://testing-library.com/docs/guiding-principles)