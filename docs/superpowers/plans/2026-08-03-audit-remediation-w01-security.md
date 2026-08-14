# Audit Remediation W0–W1 Security Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [x]`) syntax for tracking.

**Goal:** Reproduzir e fechar cinco bloqueadores P0 sem alterar escopo de produto.

**Architecture:** Rotas passam somente dados não autoritativos; ActionContext define tenant.
Webhooks resolvem tenant por instalação do provider. Audit usa allowlist e eventos financeiros
são aplicados atomicamente.

**Tech Stack:** Next.js, NextAuth, Drizzle, PostgreSQL, Zod, Jest.

**Agent Orchestration:** Supervisor-Workers — tasks 2, 3 e 5 podem ser investigadas em paralelo;
commits entram serialmente e Task 6 roda após todas.

---

### Task 1: Congelar baseline e ledger

**Files:**
- Modify: `docs/superpowers/audits/goal-ledger.md`
- Create: `src/__tests__/security/audit-remediation-fixtures.ts`
- Test: `src/__tests__/security/audit-remediation-fixtures.test.ts`

- [x] **Step 1: escrever teste RED das fixtures**

```ts
it('creates attacker and victim in distinct clinics', async () => {
  const fixture = await seedAuditTenants(db)
  expect(fixture.attacker.clinicId).not.toBe(fixture.victim.clinicId)
})
```

- [x] **Step 2: executar e confirmar RED**

```bash
npm test -- src/__tests__/security/audit-remediation-fixtures.test.ts --runInBand
```

Expected: FAIL por `seedAuditTenants` ausente.

- [x] **Step 3: criar fixture mínima com duas clínicas, acessos, paciente, consulta e gateway**

```ts
export type AuditTenantFixture = {
  attacker: { userId: string; clinicId: string }
  victim: { userId: string; clinicId: string; patientId: string; appointmentId: string }
}
```

- [x] **Step 4: executar GREEN e registrar baseline no ledger**

```bash
npm test -- src/__tests__/security/audit-remediation-fixtures.test.ts --runInBand
```

- [x] **Step 5: commit**

```bash
git add docs/superpowers/audits/goal-ledger.md src/__tests__/security
git commit -m "test: add audit remediation fixtures"
```

### Task 2: Bloquear confirmação cross-clinic

**Files:**
- Modify: `src/modules/operacional/actions/processar-confirmacao-resposta.ts`
- Modify: `src/app/api/appointments/confirm-response/route.ts`
- Test: `src/modules/operacional/actions/__tests__/processar-confirmacao-resposta.security.test.ts`

- [x] **Step 1: escrever teste RED com payload forjado**

```ts
it('uses context clinic instead of payload clinic', async () => {
  const result = await runAction(processarConfirmacaoResposta, {
    patientPhone: victimPhone,
    message: 'SIM',
    clinicId: victimClinicId,
  }, attackerContext)
  expect(result).toEqual({ ok: false, error: expect.objectContaining({ code: 'not_found' }) })
})
```

- [x] **Step 2: executar e confirmar mutação indevida atual**

```bash
npm test -- processar-confirmacao-resposta.security.test.ts --runInBand
```

Expected: FAIL; consulta da vítima muda ou handler recebe `victimClinicId`.

- [x] **Step 3: remover tenant do schema e usar contexto**

```ts
input: z.object({
  patientPhone: z.string().min(8),
  message: z.string().min(1),
}),
handler: (input, ctx) =>
  processConfirmationResponse(ctx.clinicId, input.patientPhone, input.message),
```

- [x] **Step 4: testar ataque e fluxo legítimo**

```bash
npm test -- processar-confirmacao-resposta.security.test.ts --runInBand
npm test -- src/services/appointments/__tests__/confirmation-handler.service.test.ts --runInBand
```

- [x] **Step 5: commit**

```bash
git add src/modules/operacional/actions src/app/api/appointments/confirm-response
git commit -m "fix: scope confirmation replies to active clinic"
```

### Task 3: Derivar tenant do webhook inbound

**Files:**
- Modify: `src/app/api/messages/inbound/route.ts`
- Modify: `src/lib/db/schema/infra.ts`
- Create: `src/modules/atendimento/integrations/resolve-channel-installation.ts`
- Test: `src/app/api/messages/inbound/route.security.test.ts`
- Migration: `src/lib/db/migrations/0013_channel_installation.sql`
- Create: `src/lib/db/migrations/meta/0013_snapshot.json`
- Modify: `src/lib/db/migrations/meta/_journal.json`

- [x] **Step 1: escrever contrato RED**

```ts
it('ignores forged clinicId and resolves clinic by installation', async () => {
  const response = await POST(signedRequest({
    installationId: victimInstallationId,
    clinicId: attackerClinicId,
    from: '+5511999999999',
    message: 'Olá',
  }))
  expect(runAtendimentoSystemAction).toHaveBeenCalledWith(
    receberMensagem,
    expect.not.objectContaining({ clinicId: attackerClinicId }),
    victimClinicId,
    expect.anything(),
  )
})
```

- [x] **Step 2: confirmar RED**

```bash
npm test -- src/app/api/messages/inbound/route.security.test.ts --runInBand
```

- [x] **Step 3: implementar resolução fail-closed**

```ts
const installation = await resolveChannelInstallation({
  installationId: parsed.data.installationId,
  providedSecret: request.headers.get('x-webhook-secret') ?? '',
})
if (!installation) return apiFailure('FORBIDDEN', 'Invalid webhook', requestId, 403)
```

Migration adiciona hash/identificador único da instalação; segredo bruto não entra em DB ou log.

```bash
npm run db:generate -- --name=channel_installation
```

- [x] **Step 4: testar assinatura inválida, instalação desconhecida e body forjado**

```bash
npm test -- src/app/api/messages/inbound/route.security.test.ts --runInBand
npm run test:integration -- --runInBand resolve-channel-installation
```

- [x] **Step 5: commit**

```bash
git add src/app/api/messages/inbound src/modules/atendimento/integrations \
  src/lib/db/schema/infra.ts src/lib/db/migrations
git commit -m "fix: derive inbound tenant from installation"
```

### Task 4: Tornar Asaas replay-safe e atômico

**Files:**
- Modify: `src/modules/financeiro/gateways/providers/asaas/webhook.ts`
- Modify: `src/modules/financeiro/repositories/financeiro-repository.ts`
- Modify: `src/lib/db/schema/business.ts`
- Test: `src/modules/financeiro/gateways/__tests__/asaas-webhook.integration.test.ts`
- Migration: `src/lib/db/migrations/0014_gateway_event_atomicity.sql`
- Create: `src/lib/db/migrations/meta/0014_snapshot.json`
- Modify: `src/lib/db/migrations/meta/_journal.json`

- [x] **Step 1: escrever teste RED de falha intermediária + replay**

```ts
it('settles once after first transaction fails', async () => {
  await expect(processEventWithInjectedFailure(event)).rejects.toThrow('injected')
  await expect(processAsaasWebhook(event)).resolves.toMatchObject({ settled: true })
  expect(await countPayments(event.id)).toBe(1)
})
```

- [x] **Step 2: executar contra PostgreSQL real e confirmar RED**

```bash
npm run test:integration -- --runInBand asaas-webhook.integration.test.ts
```

- [x] **Step 3: mover claim, lookup, payment e processedAt para uma transaction**

```ts
await db.transaction(async (tx) => {
  const event = await claimGatewayEvent(tx, normalized)
  if (!event.claimed) return
  const charge = await findChargeForUpdate(tx, clinicId, normalized.externalChargeId)
  await settleChargeOnce(tx, charge, normalized)
  await markGatewayEventProcessed(tx, event.id)
})
```

`chargeId` referencia UUID local; `externalChargeId` permanece `text`. Unique:
`(provider, external_event_id)`.

```bash
npm run db:generate -- --name=gateway_event_atomicity
```

- [x] **Step 4: testar duplicata, concorrência, charge ausente e rollback**

```bash
npm run test:integration -- --runInBand asaas-webhook.integration.test.ts
npm test -- src/modules/financeiro/gateways/__tests__/asaas-webhook.test.ts --runInBand
```

- [x] **Step 5: commit**

```bash
git add src/modules/financeiro src/lib/db/schema/business.ts src/lib/db/migrations
git commit -m "fix: process Asaas events atomically"
```

### Task 5: Remover provisionamento privilegiado do app clínico

**Files:**
- Modify: `src/app/api/admin/provision/route.ts`
- Test: `src/app/api/admin/provision/route.test.ts`
- Modify: `docs/superpowers/audits/goal-ledger.md`

- [x] **Step 1: escrever RED para qualquer token clínico**

```ts
it.each(['active-master', 'inactive-master', 'stale-master'])
  ('does not provision with %s clinical token', async state => {
    const response = await POST(await provisionRequestFor(state))
    expect(response.status).toBe(404)
    expect(createUserWithClinic).not.toHaveBeenCalled()
  })
```

- [x] **Step 2: confirmar RED**

```bash
npm test -- src/app/api/admin/provision/route.test.ts --runInBand
```

- [x] **Step 3: desabilitar endpoint no app clínico**

```ts
export async function POST(): Promise<NextResponse> {
  return new NextResponse(null, { status: 404 })
}
```

Remover `isMaster` como autorização operacional. Provisionamento gerenciado externo permanece no
plano mestre e exige identidade operacional dedicada; não criar substituto inseguro nesta onda.

- [x] **Step 4: executar auth, route protection e provision**

```bash
npm test -- src/app/api/admin/provision/route.test.ts \
  src/__tests__/middleware.security.test.ts --runInBand
```

- [x] **Step 5: commit**

```bash
git add src/app/api/admin/provision docs/superpowers/audits/goal-ledger.md
git commit -m "fix: disable clinical master provisioning"
```

### Task 6: Trocar audit denylist por allowlist

**Files:**
- Modify: `src/core/actions/types.ts`
- Modify: `src/core/actions/run.ts`
- Modify: `src/core/actions/audit-writer.ts`
- Modify: Action definitions que precisam metadata não sensível
- Test: `src/core/actions/__tests__/audit-writer.test.ts`
- Test: `src/core/actions/__tests__/run.test.ts`

- [x] **Step 1: escrever teste RED com PII aninhada**

```ts
expect(allowlistInput({ name: 'Ana', cpf: '123', metadata: { phone: '999' } }, ['eventId']))
  .toEqual({})
```

- [x] **Step 2: confirmar que `runAction` ainda chama `redactInput`**

```bash
npm test -- src/core/actions/__tests__/audit-writer.test.ts \
  src/core/actions/__tests__/run.test.ts --runInBand
```

- [x] **Step 3: mudar contrato da Action**

```ts
// Replace `sensitiveFields?: string[]` in ActionDefinition with:
auditFields?: readonly string[]
```

`runAction` usa `allowlistInput(rawInput, action.auditFields ?? [])`. Remover `sensitiveFields` e
`redactInput` após migrar todos os consumidores.

- [x] **Step 4: executar scan e testes**

```bash
rg "sensitiveFields|redactInput" src && exit 1 || true
npm test -- src/core/actions --runInBand
npm run test:security
```

- [x] **Step 5: commit**

```bash
git add src/core/actions src/modules
git commit -m "fix: allowlist action audit metadata"
```

### Task 7: Gate W1

- [x] Executar migration em banco descartável e validar constraints.
- [x] Executar concorrência/replay com duas conexões.
- [x] Executar gates globais.
- [x] Atualizar ledger; zero P0 aberto.
- [x] Solicitar review correctness + AppSec.

```bash
npm run db:reset
npm run db:migrate
npm run test:integration
npm run test:security
npm run lint && npm run typecheck && npm test -- --runInBand && npm run build
```


## Checkbox reconciliation (2026-08-14)

All planned implementation steps are marked complete because the corresponding wave was previously completed and its gates are recorded in the audit ledger. This reconciliation does not claim new execution of historical steps.

W0-W1 security evidence is recorded in docs/superpowers/audits/2026-08-13-final-gate-results.json and the historical ledger; current candidate boundary evidence is in docs/superpowers/audits/2026-08-14-final-gate-results.json.

Current-candidate follow-up: the fail-closed API/cron implementation migration, Stryker, OpenNext build, Wrangler dry-run, and startup check are tracked in docs/superpowers/audits/2026-08-14-final-gate-results.json.
