import { test, expect } from '@playwright/test'
import path from 'path'

// #61: o seed (scripts/seed-test-clinic.mjs) dá ao admin demo membership em
// 2 clínicas (clinica-demo + clinica-demo-filial); com availableClinics>1 o
// ClinicSelector (F4.09) deve renderizar no header do dashboard.
const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

t.describe('ClinicSelector multi-clínica (#61 / F4.09)', () => {
  t.beforeEach(async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
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
    await expect(page.getByTestId('clinic-selector')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('clinic-selector-trigger')).toBeVisible()
  })
})
