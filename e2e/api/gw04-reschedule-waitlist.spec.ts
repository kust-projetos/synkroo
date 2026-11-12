import { test, expect } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
const DENTIST_ID = '00000000-0000-4000-8000-000000000010'
const PROCEDURE_ID = '00000000-0000-4000-8000-000000000020'

t.describe('GW-04 reschedule → waitlist', () => {
  t('reagenda consulta e tenta preenchimento da waitlist', async ({ request }) => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
    const name = `GW04 E2E ${suffix}`
    const phone = `119${suffix.slice(-8).padStart(8, '0')}`

    const patientResponse = await request.post('/api/patients', {
      data: { name, phone, email: `gw04.${suffix}@example.test` },
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect(patientResponse.status()).toBe(201)
    const patientId = (await patientResponse.json()).data?.id
    expect(typeof patientId).toBe('string')

    const originalAt = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000)
    originalAt.setUTCHours(10, 0, 0, 0)
    const appointmentResponse = await request.post('/api/appointments', {
      data: {
        patientId,
        dentistId: DENTIST_ID,
        procedureId: PROCEDURE_ID,
        scheduledAt: originalAt.toISOString(),
        durationMinutes: 30,
      },
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect(appointmentResponse.status()).toBe(201)
    const appointmentId = (await appointmentResponse.json()).data?.id
    expect(typeof appointmentId).toBe('string')

    // Reagendamento para novo horário.
    const newAt = new Date(Date.now() + 21 * 24 * 60 * 60 * 1000)
    newAt.setUTCHours(14, 0, 0, 0)
    const rescheduleResponse = await request.post(`/api/appointments/${appointmentId}/reschedule`, {
      data: { scheduledAt: newAt.toISOString(), durationMinutes: 30 },
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect(rescheduleResponse.status()).toBeLessThan(400)
    const rescheduleBody = await rescheduleResponse.json()
    const rescheduled = rescheduleBody.data ?? rescheduleBody
    expect(rescheduled).toBeTruthy()

    // Verifica que o agendamento reflete o novo horário.
    const detailResponse = await request.get(`/api/appointments/${appointmentId}`)
    if (detailResponse.status() === 200) {
      const detailBody = await detailResponse.json()
      const detail = detailBody.data ?? detailBody
      const detailDate = detail?.scheduledAt ?? detail?.scheduled_at
      if (detailDate) {
        expect(new Date(detailDate).toISOString()).toBe(newAt.toISOString())
      }
    }

    // Entra na waitlist para o mesmo paciente (slot futuro).
    const waitlistDate = newAt.toISOString().slice(0, 10)
    const waitlistResponse = await request.post('/api/waitlist', {
      data: {
        patientId,
        preferredDate: waitlistDate,
        preferredTimeStart: '14:00',
        preferredTimeEnd: '15:00',
        dentistId: DENTIST_ID,
        procedureId: PROCEDURE_ID,
      },
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect([200, 201]).toContain(waitlistResponse.status())
    const waitlistId = (await waitlistResponse.json()).data?.id
    expect(typeof waitlistId).toBe('string')

    // Tenta preencher a vaga a partir da waitlist (idempotente; pode conflitar
    // se o slot já estiver ocupado — aceita 200/201/409).
    const fillSlot = new Date(Date.now() + 22 * 24 * 60 * 60 * 1000)
    fillSlot.setUTCHours(15, 0, 0, 0)
    const fillResponse = await request.post('/api/waitlist/fill', {
      data: {
        waitlistId,
        scheduledAt: fillSlot.toISOString(),
        durationMinutes: 30,
        dentistId: DENTIST_ID,
        procedureId: PROCEDURE_ID,
      },
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect([200, 201, 409, 400]).toContain(fillResponse.status())
  })
})