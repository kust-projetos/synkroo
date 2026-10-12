import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// UUID válido que nenhuma clínica real usa (apenas membership negativa).
const UNKNOWN_CLINIC_ID = '00000000-0000-0000-0000-000000000000'

async function getSessionBody(request: APIRequestContext): Promise<any> {
  const res = await request.get('/api/auth/session')
  expect(res.status()).toBe(200)
  return res.json()
}

t.describe('GW-02 tenant switch API', () => {
  t('GET /api/auth/session expõe o clinic_id ativo (clinicA)', async ({ request }) => {
    const body = await getSessionBody(request)
    expect(body.authenticated).toBe(true)
    expect(body.profile).toBeTruthy()
    expect(typeof body.profile.clinic_id).toBe('string')
    expect(body.profile.clinic_id).toMatch(UUID_RE)
    expect(Array.isArray(body.profile.available_clinics)).toBe(true)
  })

  t('setup B1 (tentativo): não há endpoint viável p/ criar clínica + membership com role admin', async ({ request }) => {
    // BLOCKER GW02-B1 documentado no teste: o inventário de rotas mostra que
    // - /api/clinics/* expõe apenas GET/PUT settings (sem POST de criação);
    // - POST /api/admin/provision retorna 404 deliberado (provisionamento é
    //   owned by an external operational control plane).
    // Nenhum SQL cru / seed de prod / dado real é usado aqui (proibido).
    const createClinic = await request.post('/api/clinics', { data: { name: 'gw02-ephemeral' } })
    expect([404, 405]).toContain(createClinic.status())
    const provision = await request.post('/api/admin/provision', { data: {} })
    expect(provision.status()).toBe(404)
    // Segunda clínica só existe se o seed/ambiente já der ≥2 memberships ao admin.
    const session = await getSessionBody(request)
    const clinicA: string = session.profile.clinic_id
    const others = (session.profile.available_clinics as Array<{ id: string }>).filter((c) => c.id !== clinicA)
    test.info().annotations.push({
      type: 'GW02-B1',
      description: others.length > 0 ? `second-membership-available:${others[0].id}` : 'BLOCKER: sem segunda membership; testes de switch usam skip explícito',
    })
  })

  t('POST /api/auth/switch-clinic p/ clínica B → 200 sem set-cookie', async ({ request }) => {
    const session = await getSessionBody(request)
    const clinicA: string = session.profile.clinic_id
    const clinicB = (session.profile.available_clinics as Array<{ id: string }>)
      .map((c) => c.id)
      .find((id) => id !== clinicA)
    t.skip(!clinicB, 'BLOCKER GW02-B1: admin só tem membership em 1 clínica e não há endpoint p/ criar clínica B (ver teste setup B1)')
    const res = await request.post('/api/auth/switch-clinic', { data: { clinicId: clinicB } })
    expect(res.status()).toBe(200)
    expect(res.headers()['set-cookie']).toBeUndefined()
    const body = await res.json()
    expect(body.data.clinicId).toBe(clinicB)
    expect(typeof body.data.role).toBe('string')
    // Desvio documentado do enunciado ("GET session mostra clinic_id=B"):
    // a rota é validation-only — nunca emite cookie (contrato switch-clinic.ts
    // + route.test.ts:45-60); a clínica ativa vive no JWT e só muda via
    // NextAuth session.update no client. Via fixture request pura, o GET
    // seguinte ainda reflete a clínica do token; afirma-se que a sessão segue válida.
    const after = await getSessionBody(request)
    expect(after.authenticated).toBe(true)
    // Rota validation-only: não muda o tenant ativo — a sessão segue em clinicA.
    expect(after.profile.clinic_id).toBe(clinicA)
  })

  t('POST /api/auth/switch-clinic de volta p/ A → 200 sem set-cookie', async ({ request }) => {
    const session = await getSessionBody(request)
    const clinicA: string = session.profile.clinic_id
    const clinicB = (session.profile.available_clinics as Array<{ id: string }>)
      .map((c) => c.id)
      .find((id) => id !== clinicA)
    // Sempre exercitado: switch p/ a própria clínica (membership garantida do admin).
    const self = await request.post('/api/auth/switch-clinic', { data: { clinicId: clinicA } })
    expect(self.status()).toBe(200)
    expect(self.headers()['set-cookie']).toBeUndefined()
    const selfBody = await self.json()
    expect(selfBody.data.clinicId).toBe(clinicA)
    expect(typeof selfBody.data.role).toBe('string')
    // Condicional: A→B→A só com segunda membership (skip explícito só aqui).
    t.skip(!clinicB, 'BLOCKER GW02-B1: sem segunda membership p/ exercitar switch A→B→A (ver teste setup B1)')
    const go = await request.post('/api/auth/switch-clinic', { data: { clinicId: clinicB } })
    expect(go.status()).toBe(200)
    const back = await request.post('/api/auth/switch-clinic', { data: { clinicId: clinicA } })
    expect(back.status()).toBe(200)
    expect(back.headers()['set-cookie']).toBeUndefined()
    const body = await back.json()
    expect(body.data.clinicId).toBe(clinicA)
    expect(typeof body.data.role).toBe('string')
  })

  t('POST com uuid inexistente → 403 FORBIDDEN', async ({ request }) => {
    const res = await request.post('/api/auth/switch-clinic', { data: { clinicId: UNKNOWN_CLINIC_ID } })
    expect(res.status()).toBe(403)
    const body = await res.json()
    expect(body.error.code).toBe('FORBIDDEN')
  })

  t('POST com body inválido → 400 BAD_REQUEST', async ({ request }) => {
    const missing = await request.post('/api/auth/switch-clinic', { data: {} })
    expect(missing.status()).toBe(400)
    expect((await missing.json()).error.code).toBe('BAD_REQUEST')
    const malformed = await request.post('/api/auth/switch-clinic', { data: { clinicId: 'not-a-uuid' } })
    expect(malformed.status()).toBe(400)
    expect((await malformed.json()).error.code).toBe('BAD_REQUEST')
  })

  t('POST sem sessão → 401 UNAUTHORIZED', async ({ request, baseURL }) => {
    const session = await getSessionBody(request)
    const clinicA: string = session.profile.clinic_id
    const anon = await playwrightRequest.newContext(baseURL ? { baseURL } : {})
    try {
      const res = await anon.post('/api/auth/switch-clinic', { data: { clinicId: clinicA } })
      expect(res.status()).toBe(401)
      expect((await res.json()).error.code).toBe('UNAUTHORIZED')
    } finally {
      await anon.dispose()
    }
  })
})
