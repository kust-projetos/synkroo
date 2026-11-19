import { createHash, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { test, expect } from '@playwright/test'
import { loadEnvConfig } from '@next/env'
import { assertDisposableE2EDatabaseUrl } from '../../src/lib/e2e-database-safety'

test('inbound de pedido humano registra encaminhamento e escalonamento', async ({ request }) => {
  loadEnvConfig(process.cwd())
  const databaseUrl = process.env.DATABASE_URL
  assertDisposableE2EDatabaseUrl(databaseUrl)
  const cronSecret = process.env.CRON_SECRET
  expect(databaseUrl, 'DATABASE_URL do banco E2E').toBeTruthy()
  expect(cronSecret, 'CRON_SECRET já configurado para o ambiente E2E').toBeTruthy()

  const clinicId = randomUUID()
  const installationId = `e2e-handoff-${clinicId}`
  const webhookSecret = randomUUID()
  const externalMessageId = `e2e-handoff-${clinicId}`
  const sender = `5511${clinicId.replaceAll('-', '').slice(0, 10)}`
  const pool = new Pool({ connectionString: databaseUrl })
  try {
    await pool.query(
      `INSERT INTO clinics (id, name, slug, phone, email)
       VALUES ($1, 'E2E Human Handoff', $2, '+5500000000000', $3)`,
      [clinicId, `e2e-handoff-${clinicId}`, `${clinicId}@e2e.invalid`],
    )
    await pool.query(
      `INSERT INTO channel_installations
         (clinic_id, provider, installation_id, secret_hash, enabled)
       VALUES ($1, 'evolution', $2, $3, true)`,
      [clinicId, installationId, createHash('sha256').update(webhookSecret).digest('hex')],
    )

    const inbound = await request.post('/api/messages/inbound', {
      headers: { 'x-webhook-secret': webhookSecret },
      data: {
        installationId,
        from: sender,
        message: 'quero falar com um atendente humano',
        externalMessageId,
        channel: 'whatsapp',
      },
    })
    expect(inbound.status()).toBe(201)
    const inboundBody = await inbound.json()
    const conversationId = inboundBody.data?.conversationId ?? inboundBody.conversationId
    expect(conversationId).toBeTruthy()

    const cron = await request.post('/api/cron/outbox?limit=25', {
      headers: { Authorization: `Bearer ${cronSecret}` },
    })
    expect(cron.ok()).toBeTruthy()

    const history = await pool.query(
      `SELECT content FROM messages
       WHERE conversation_id = $1 AND direction = 'outbound'
       ORDER BY created_at DESC`,
      [conversationId],
    )
    expect(history.rows.map((row) => row.content)).toContain(
      'Com certeza! Estou transferindo o seu atendimento para um de nossos atendentes humanos da clínica. Um momento, por favor.',
    )

    const status = await pool.query(
      'SELECT status FROM conversations WHERE id = $1 AND clinic_id = $2',
      [conversationId, clinicId],
    )
    expect(status.rows[0]?.status).toBe('escalated')
  } finally {
    await pool.query('DELETE FROM clinics WHERE id = $1', [clinicId])
    await pool.end()
  }
})
