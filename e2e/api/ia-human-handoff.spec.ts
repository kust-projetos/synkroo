import { createHash, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { test, expect } from '@playwright/test'
import { loadEnvConfig } from '@next/env'
import { assertDisposableE2EDatabaseUrl } from '../../src/lib/e2e-database-safety'
import { E2E_CRON_SECRET } from '../../playwright.config'

test('inbound de pedido humano registra encaminhamento e escalonamento', async ({ request }) => {
  loadEnvConfig(process.cwd())
  const origin = new URL(
    test.info().project.use.baseURL ?? 'http://127.0.0.1:3003',
  ).origin
  const databaseUrl = process.env.DATABASE_URL
  assertDisposableE2EDatabaseUrl(databaseUrl)
  expect(databaseUrl, 'DATABASE_URL do banco E2E').toBeTruthy()

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
    await pool.query(
      `INSERT INTO permissions (key, module, label)
       VALUES ('atendimento:manage_webhooks', 'atendimento', 'Gerenciar webhooks')
       ON CONFLICT (key) DO NOTHING`,
    )
    const agentRoleId = randomUUID()
    await pool.query(
      `INSERT INTO roles (id, clinic_id, name, description, is_system)
       VALUES ($1, $2, 'Agente', 'E2E synthetic handoff role', true)`,
      [agentRoleId, clinicId],
    )
    await pool.query(
      `INSERT INTO role_permissions (role_id, permission_key)
       VALUES ($1, 'atendimento:manage_webhooks')
       ON CONFLICT (role_id, permission_key) DO NOTHING`,
      [agentRoleId],
    )

    const inbound = await request.post('/api/messages/inbound', {
      headers: {
        Origin: origin,
        'x-webhook-secret': webhookSecret,
      },
      data: {
        installationId,
        from: sender,
        message: 'quero falar com um atendente humano',
        externalMessageId,
        channel: 'whatsapp',
      },
    })
    const inboundBody = await inbound.json()
    expect(inbound.status(), JSON.stringify(inboundBody)).toBe(201)
    const conversationId = inboundBody.data?.conversationId ?? inboundBody.conversationId
    expect(conversationId).toBeTruthy()

    const cron = await request.post('/api/cron/outbox?limit=25', {
      headers: {
        Origin: origin,
        Authorization: `Bearer ${E2E_CRON_SECRET}`,
      },
    })
    expect(cron.ok(), `cron outbox: ${cron.status()} ${await cron.text()}`).toBeTruthy()

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
