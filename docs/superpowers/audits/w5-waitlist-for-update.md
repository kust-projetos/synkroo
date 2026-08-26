# W5 Waitlist FOR UPDATE — AUDIT 2026-08-25

> F5.04 idempotente + clinicId scoped + transaction `FOR UPDATE`.

## Implementação
- `src/services/waitlist/waitlist.service.ts:373` `fillWaitlistSlot` delega a `repositories/waitlist:fillSlot` que faz:
  ```sql
  BEGIN;
  SELECT * FROM waitlist WHERE id=:waitlistId AND clinicId=:clinicId FOR UPDATE;
  -- se já scheduled, retorna { alreadyScheduled: true, appointmentId }
  -- senão INSERT appointment + UPDATE waitlist SET status='scheduled' + UPDATE slot
  COMMIT;
  ```
- `addToWaitlist:100` checa `findByPatientClinicDate({ clinicId, patientId, preferredDate })` antes de `createWaitlistEntry` — `Patient already on waitlist for this date` fail-closed.
- Todos os reads filtram `WHERE clinicId=:clinicId` (tenant isolation).

## Testes
- `src/services/waitlist/__tests__/waitlist.fill.test.ts` 6/6 PASS:
  - `calls repository fillSlot and returns result`
  - `returns error when repository rejects`
  - **F5.04 `fill idempotent: a.id==b.id alreadyScheduled false→true, clinicId scoped`** — `Promise.all` duplicado
  - `getWaitlistEntryById` mapped/null
  - `updateWaitlistEntry`
- `e2e/journey-patient.spec.ts` (lista→detalhe→create→edit→dedup tenant isolation) + smoke `waitlist` navegação

## Pendente para 10/10
- `npm run test:integration:run` 8-way `fillWaitlistSlot` concorrente + `npm run test:e2e -- --grep J-04` contra DB isolado `synkroo_test` — exige `db:up` + `seed-test-clinic` + loopback, não executado neste runner Windows (documentado como integration, não unit).

*Audit 2026-08-25 — unit 6/6 verde, integração pendente.*
