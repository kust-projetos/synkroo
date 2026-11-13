import { test, expect } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

t.describe('GW-06 pipeline drag / conversão', () => {
  t('lista etapas do pipeline', async ({ request }) => {
    const res = await request.get('/api/pipeline/stages')
    expect(res.status()).toBeLessThan(500)
  })

  t('criar etapa com nome vazio retorna erro', async ({ request }) => {
    const res = await request.post('/api/pipeline/stages', {
      data: { name: '' },
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  t('reorder com payload inválido retorna erro', async ({ request }) => {
    const res = await request.post('/api/pipeline/stages/reorder', {
      data: {},
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })
})