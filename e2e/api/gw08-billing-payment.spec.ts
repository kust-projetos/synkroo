import { test, expect } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

t.describe('GW-08 cobrança / pagamento', () => {
  t('listar orçamentos retorna resposta', async ({ request }) => {
    const res = await request.get('/api/financeiro/budgets')
    expect(res.status()).toBeLessThan(500)
  })

  t('criar orçamento com payload inválido retorna erro', async ({ request }) => {
    const res = await request.post('/api/financeiro/budgets', {
      data: {},
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  t('pagamento em orçamento inexistente retorna erro', async ({ request }) => {
    const res = await request.post('/api/financeiro/budgets/00000000-0000-0000-0000-000000000099/payments', {
      data: { amount: 100 },
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })
})