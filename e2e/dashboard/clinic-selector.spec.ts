import { test, expect, type Page } from '@playwright/test'
import path from 'path'

type SessionProfile = {
  clinic_id: string
  role: string
  available_clinics: Array<{ id: string; name: string; role: string }>
}

async function readSession(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/auth/session')
    return response.json()
  }) as Promise<{ authenticated: boolean; profile?: SessionProfile }>
}

async function readPatientRows(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/patients?limit=100')
    const body = await response.json()
    return { status: response.status, data: body.data ?? body }
  }) as Promise<{
    status: number
    data: { patients: Array<{ id: string; clinicId: string }> }
  }>
}

async function selectClinic(page: Page, clinicId: string) {
  await page.locator('[data-testid="clinic-selector-trigger"]:visible').click()
  await page.getByTestId(`clinic-option-${clinicId}`).click()
}

// #61: sessão DEDICADA multi-clínica (multiclinica@clinicademo.com, via
// e2e/.auth/multiclinica.json do global-setup) — o admin demo permanece
// single-clinic para não quebrar o resto da suíte. Com availableClinics>1 o
// ClinicSelector (F4.09) deve renderizar no header do dashboard.
const t = test.extend({ storageState: path.join(__dirname, '../.auth/multiclinica.json') })

t.describe('ClinicSelector multi-clínica (#61 / F4.09)', () => {
  t.beforeEach(async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'networkidle' })
  })

  t('sessão multi-clínica expõe ≥2 clínicas em available_clinics', async ({ page }) => {
    const session = await page.evaluate(async () => {
      const res = await fetch('/api/auth/session')
      return res.json()
    })
    expect(session.authenticated).toBe(true)
    expect(Array.isArray(session.profile?.available_clinics)).toBe(true)
    expect(session.profile.available_clinics.length).toBeGreaterThanOrEqual(2)
  })

  t('exibe data-testid="clinic-selector" com sessão multi-clínica', async ({ page }) => {
    // O layout monta o seletor nos headers mobile e desktop (2 elementos);
    // ao menos um está visível em qualquer viewport com sessão multi-clínica.
    await expect(page.locator('[data-testid="clinic-selector"]:visible')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('[data-testid="clinic-selector-trigger"]:visible')).toBeVisible()
  })

  t('troca a clínica ativa sem expor pacientes da clínica anterior', async ({ page }) => {
    const before = await readSession(page)
    expect(before.authenticated).toBe(true)
    const clinicA = before.profile?.clinic_id
    const clinicB = before.profile?.available_clinics.find((clinic) => clinic.id !== clinicA)
    expect(clinicA).toBeTruthy()
    expect(clinicB).toBeTruthy()

    const patientsA = await readPatientRows(page)
    expect(patientsA.status).toBe(200)
    expect(patientsA.data.patients.length).toBeGreaterThan(0)
    expect(patientsA.data.patients.every((patient) => patient.clinicId === clinicA)).toBe(true)
    const patientIdsA = patientsA.data.patients.map((patient) => patient.id)

    await selectClinic(page, clinicB!.id)
    await expect.poll(async () => (await readSession(page)).profile?.clinic_id, { timeout: 20_000 }).toBe(clinicB!.id)

    const after = await readSession(page)
    expect(after.profile?.role).toBe(clinicB!.role)
    const patientsB = await readPatientRows(page)
    expect(patientsB.status).toBe(200)
    expect(patientsB.data.patients.every((patient) => patient.clinicId === clinicB!.id)).toBe(true)
    expect(patientsB.data.patients.some((patient) => patientIdsA.includes(patient.id))).toBe(false)

    await selectClinic(page, clinicA!)
    await expect.poll(async () => (await readSession(page)).profile?.clinic_id, { timeout: 20_000 }).toBe(clinicA)
  })

  t('permissões re-resolvidas após switch (GW-02 critério #3)', async ({ page }) => {
    const before = await readSession(page)
    expect(before.authenticated).toBe(true)
    const clinicA = before.profile?.clinic_id
    const clinicB = before.profile?.available_clinics.find((clinic) => clinic.id !== clinicA)
    expect(clinicA).toBeTruthy()
    expect(clinicB).toBeTruthy()

    // Clínica A concede Recepcionista (sem financeiro:view) → negado.
    const deniedInA = await page.evaluate(async () => {
      const res = await fetch('/api/reports/financial?period=month')
      return res.status
    })
    expect(deniedInA).toBe(403)

    // Troca para clínica B (Owner) → permitido.
    await selectClinic(page, clinicB!.id)
    await expect.poll(async () => (await readSession(page)).profile?.clinic_id, { timeout: 20_000 }).toBe(clinicB!.id)

    const allowedInB = await page.evaluate(async () => {
      const res = await fetch('/api/reports/financial?period=month')
      return res.status
    })
    expect(allowedInB).toBe(200)

    // Volta para A → negado novamente.
    await selectClinic(page, clinicA!)
    await expect.poll(async () => (await readSession(page)).profile?.clinic_id, { timeout: 20_000 }).toBe(clinicA)

    const deniedAgain = await page.evaluate(async () => {
      const res = await fetch('/api/reports/financial?period=month')
      return res.status
    })
    expect(deniedAgain).toBe(403)
  })
})
