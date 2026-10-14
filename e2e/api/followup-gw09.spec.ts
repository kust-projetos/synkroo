/**
 * GW-09 follow-up/reativação — primeira cobertura E2E (lacuna total até aqui).
 *
 * Cobre os três GETs read-only do módulo followup + smoke da página stub:
 * - GET /api/patients/inactive (lista + stats_only + min_days inválido)
 * - GET /api/appointments/incomplete-treatments
 * - GET /api/budgets/followup
 * - GET /dashboard/followup (h1 "Follow-up")
 *
 * PROIBIDO aqui: POST /api/patients/inactive (reativação em massa — pode
 * processar pacientes reais do seed) e qualquer POST de followup. Só GETs.
 */
import { test, expect, request as playwrightRequest, type APIRequestContext } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

async function authedContext(baseURL: string | undefined): Promise<APIRequestContext> {
  if (!baseURL) {
    throw new Error('GW09: baseURL is undefined — sem baseURL não há origin same-origin p/ CSRF')
  }
  // Mesmo padrão de tenant-switch.spec.ts: shouldRejectCsrf compara Origin
  // contra request.nextUrl.origin (hostname canonizado p/ localhost; a porta
  // continua relevante). Deriva o origin da porta do baseURL.
  const port = new URL(baseURL).port || '3003'
  const origin = `http://localhost:${port}`
  return playwrightRequest.newContext({
    baseURL,
    storageState: path.join(__dirname, '../.auth/admin.json'),
    extraHTTPHeaders: { origin, referer: origin + '/' },
  })
}

async function getSessionClinicId(request: APIRequestContext): Promise<string> {
  const res = await request.get('/api/auth/session')
  expect(res.status()).toBe(200)
  const body = await res.json()
  expect(body.authenticated).toBe(true)
  expect(typeof body.profile?.clinic_id).toBe('string')
  return body.profile.clinic_id as string
}

t.describe('GW-09 follow-up/reactivation API', () => {
  // Teto único de timeout (sem retry): dev server com cold-compile + launch do
  // Chromium sob contenção de CPU excedem 30s nesta máquina; no CI tudo roda
  // em segundos — o teto nunca vincula lá.
  t.describe.configure({ timeout: 120_000 })
  t('GET /api/patients/inactive → 200 + envelope {total, patients} tenant-scoped', async ({ baseURL }) => {
    const authed = await authedContext(baseURL)
    try {
      const clinicId = await getSessionClinicId(authed)
      const res = await authed.get('/api/patients/inactive')
      expect(res.status()).toBe(200)
      const body = await res.json()
      expect(typeof body.total).toBe('number')
      expect(Array.isArray(body.patients)).toBe(true)
      expect(body.total).toBe(body.patients.length)
      for (const p of body.patients) {
        expect(p.clinicId).toBe(clinicId)
      }
      test.info().annotations.push({
        type: 'GW09-inactive',
        description: `total=${body.total} clinic_scoped=${clinicId}`,
      })
    } finally {
      await authed.dispose()
    }
  })

  t('GET /api/patients/inactive?stats_only=true → {stats:{totalInactive, bySegment}}', async ({ baseURL }) => {
    const authed = await authedContext(baseURL)
    try {
      const res = await authed.get('/api/patients/inactive?stats_only=true')
      expect(res.status()).toBe(200)
      const body = await res.json()
      expect(body.stats).toBeTruthy()
      expect(typeof body.stats.totalInactive).toBe('number')
      expect(typeof body.stats.bySegment).toBe('object')
      test.info().annotations.push({
        type: 'GW09-inactive-stats',
        description: `totalInactive=${body.stats.totalInactive} segments=${Object.keys(body.stats.bySegment).join(',') || '(none)'}`,
      })
    } finally {
      await authed.dispose()
    }
  })

  t('GET /api/patients/inactive?min_days=abc → erro de validação (>=400, nunca 500)', async ({ baseURL }) => {
    const authed = await authedContext(baseURL)
    try {
      // min_days=abc → parseInt=NaN → schema minDays falha → invalid_input (422).
      // Aceita qualquer 4xx (contrato de validação), mas nunca 500.
      const res = await authed.get('/api/patients/inactive?min_days=abc')
      expect(res.status()).toBeGreaterThanOrEqual(400)
      expect(res.status()).toBeLessThan(500)
    } finally {
      await authed.dispose()
    }
  })

  t('GET /api/appointments/incomplete-treatments → <500 + corpo JSON (forma real documentada)', async ({ baseURL }) => {
    const authed = await authedContext(baseURL)
    try {
      const res = await authed.get('/api/appointments/incomplete-treatments')
      const raw = await res.text()
      let body: unknown = null
      try { body = JSON.parse(raw) } catch { /* documentado abaixo */ }
      // Forma real (2026-10-14, via route-adapter canônico {data,meta?}|{error}):
      // listarTratamentosIncompletos retorna {treatments:[...]} (ou {alerts} com
      // ?alerts_only=true) → apiSuccess embrulha em {data:{treatments}}.
      // Evidência local: {"data":{"treatments":[]}} (seed sem tratamentos incompletos).
      test.info().annotations.push({
        type: 'GW09-incomplete-treatments-shape',
        description: `status=${res.status()} topKeys=${body && typeof body === 'object' ? Object.keys(body).join(',') : '(non-json)'} snippet=${raw.slice(0, 200)}`,
      })
      expect(res.status()).toBeLessThan(500)
      expect(typeof body).toBe('object')
    } finally {
      await authed.dispose()
    }
  })

  t('GET /api/budgets/followup → <500 + corpo JSON (forma real documentada)', async ({ baseURL }) => {
    const authed = await authedContext(baseURL)
    try {
      const res = await authed.get('/api/budgets/followup')
      const raw = await res.text()
      let body: unknown = null
      try { body = JSON.parse(raw) } catch { /* documentado abaixo */ }
      // Forma real (2026-10-14, via route-adapter canônico {data,meta?}|{error}):
      // listarOrcamentosPendentes retorna {budgets,total} → apiSuccess embrulha
      // em {data:{budgets,total}}.
      // Evidência local: {"data":{"budgets":[],"total":0}} (seed sem orçamentos pendentes).
      test.info().annotations.push({
        type: 'GW09-budgets-followup-shape',
        description: `status=${res.status()} topKeys=${body && typeof body === 'object' ? Object.keys(body).join(',') : '(non-json)'} snippet=${raw.slice(0, 200)}`,
      })
      expect(res.status()).toBeLessThan(500)
      expect(typeof body).toBe('object')
    } finally {
      await authed.dispose()
    }
  })

  t('GET /api/patients/inactive sem sessão → 307 redirect p/ /login', async ({ baseURL }) => {
    // Contrato real do middleware (mesmo de switch-clinic sem sessão): sem
    // sessão ele responde 307 redirect p/ /login e nunca chega ao handler
    // (o 401 UNAUTHORIZED só existe no handler isolado). maxRedirects: 0
    // impede o Playwright de seguir o redirect; contexto sem storageState.
    const anon = await playwrightRequest.newContext(
      baseURL ? { baseURL, storageState: { cookies: [], origins: [] } } : { storageState: { cookies: [], origins: [] } },
    )
    try {
      const res = await anon.get('/api/patients/inactive', { maxRedirects: 0 })
      expect(res.status()).toBe(307)
      expect(res.headers()['location']).toContain('/login')
    } finally {
      await anon.dispose()
    }
  })

  t('UI smoke: /dashboard/followup renderiza h1 "Follow-up"', async ({ page }) => {
    // domcontentloaded (não load): o bundle dev do dashboard é enorme e o
    // evento load pode demorar sob contenção; o h1 vem do SSR e a asserção
    // com retry cobre a hidratação (observada lenta: h1 ausente no complete
    // imediato, presente segundos depois).
    await page.goto('/dashboard/followup', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { name: 'Follow-up' })).toBeVisible({ timeout: 60_000 })
  })
})
