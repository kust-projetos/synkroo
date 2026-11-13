import { test, expect } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

t.describe('GW-07 campanha: segmento → disparo → métrica', () => {
  t('lista campanhas', async ({ request }) => {
    const res = await request.get('/api/campaigns')
    expect(res.status()).toBeLessThan(500)
  })

  t('criar campanha sem nome retorna erro', async ({ request }) => {
    const res = await request.post('/api/campaigns', {
      data: {},
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  t('preview de segmento com payload inválido retorna erro', async ({ request }) => {
    const res = await request.post('/api/campaigns/segments/preview', {
      data: {},
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })
})