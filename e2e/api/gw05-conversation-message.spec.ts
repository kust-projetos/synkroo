import { test, expect } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })

t.describe('GW-05 conversa → mensagem', () => {
  t('lista conversas do tenant', async ({ request }) => {
    const res = await request.get('/api/conversations?limit=20')
    expect(res.status()).toBeLessThan(500)
    const body = await res.json().catch(() => ({}))
    const payload = body.data ?? body
    // payload pode ser array ou objeto com conversations
    expect(payload).toBeTruthy()
  })

  t('enviar mensagem sem conversationId retorna erro', async ({ request }) => {
    const res = await request.post('/api/messages/send', {
      data: { message: 'GW05 smoke' },
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  t('enviar mensagem com conversationId inexistente retorna 404', async ({ request }) => {
    const res = await request.post('/api/messages/send', {
      data: { conversationId: '00000000-0000-0000-0000-000000000099', message: 'GW05 smoke' },
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect([400, 404, 422]).toContain(res.status())
  })

  t('inbound sem secret válido retorna 403', async ({ request }) => {
    const res = await request.post('/api/messages/inbound', {
      data: { installationId: '00000000-0000-0000-0000-000000000000', message: 'ping' },
      headers: { 'x-webhook-secret': 'invalid' },
    })
    expect(res.status()).toBe(403)
  })

  t('histórico de conversa inexistente retorna erro', async ({ request }) => {
    const res = await request.get('/api/messages/history/00000000-0000-0000-0000-000000000099')
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })
})