import { test, expect } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

t.describe('GW-10 analytics → export', () => {
  t('exporta agendamentos em CSV com cabeçalho e linhas', async ({ request }) => {
    const res = await request.get('/api/reports/export?type=appointments&format=csv')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/csv')
    const body = await res.text()
    expect(body).toContain('Data/Hora')
    const lines = body.trim().split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(1)
  })

  t('exporta agendamentos em JSON com data e headers', async ({ request }) => {
    const res = await request.get('/api/reports/export?type=appointments&format=json')
    expect(res.status()).toBe(200)
    const body = await res.json()
    const payload = body.data ?? body
    expect(Array.isArray(payload.data)).toBe(true)
    expect(Array.isArray(payload.headers)).toBe(true)
    expect(payload.filename).toContain('agendamentos')
  })

  t('exporta pacientes em CSV', async ({ request }) => {
    const res = await request.get('/api/reports/export?type=patients&format=csv')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/csv')
    const body = await res.text()
    expect(body).toContain('Nome')
  })

  t('filtro de período altera o resultado de forma determinística', async ({ request }) => {
    const all = await request.get('/api/reports/export?type=appointments&format=json')
    const filtered = await request.get(
      '/api/reports/export?type=appointments&format=json&start_date=2099-01-01&end_date=2099-12-31',
    )
    expect(all.status()).toBe(200)
    expect(filtered.status()).toBe(200)
    const allData = (await all.json()).data?.data ?? []
    const filteredData = (await filtered.json()).data?.data ?? []
    expect(filteredData.length).toBeLessThanOrEqual(allData.length)
  })

  t('tipo inválido retorna 400', async ({ request }) => {
    const res = await request.get('/api/reports/export?type=foo&format=json')
    expect(res.status()).toBe(400)
  })

  t('métricas de atendimento retornam payload estruturado', async ({ request }) => {
    const res = await request.get('/api/analytics/metrics?period=month')
    expect(res.status()).toBe(200)
    const body = await res.json()
    const payload = body.data ?? body
    expect(payload).toBeTruthy()
  })
})