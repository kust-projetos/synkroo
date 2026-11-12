import { test, expect } from '@playwright/test'
import path from 'path'

const t = test.extend({ storageState: path.join(__dirname, '../.auth/admin.json') })
const DENTIST_ID = '00000000-0000-4000-8000-000000000010'
const PROCEDURE_ID = '00000000-0000-4000-8000-000000000020'

t.describe('GW-03 lead → paciente → agendamento', () => {
  t('captura lead, vincula paciente e agenda uma consulta única', async ({ request }) => {
    const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`
    const name = `GW03 E2E ${suffix}`
    const phone = `119${suffix.slice(-8).padStart(8, '0')}`

    const leadResponse = await request.post('/api/leads', {
      data: { name, phone, source: 'web' },
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect([200, 201]).toContain(leadResponse.status())
    const leadBody = await leadResponse.json()
    const leadId = leadBody.data?.leadId
    expect(typeof leadId).toBe('string')

    const duplicateLeadResponse = await request.post('/api/leads', {
      data: { name, phone, source: 'web' },
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect([200, 201]).toContain(duplicateLeadResponse.status())
    expect((await duplicateLeadResponse.json()).data?.leadId).toBe(leadId)

    const pipelineResponse = await request.get('/api/leads?limit=100')
    expect(pipelineResponse.status()).toBe(200)
    const pipelineBody = await pipelineResponse.json()
    const leads = pipelineBody.data?.leads ?? pipelineBody.leads
    expect(leads).toEqual(expect.arrayContaining([expect.objectContaining({ id: leadId })]))

    const patientResponse = await request.post('/api/patients', {
      data: { name, phone, email: `gw03.${suffix}@example.test` },
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect(patientResponse.status()).toBe(201)
    const patientId = (await patientResponse.json()).data?.id
    expect(typeof patientId).toBe('string')

    const conversionResponse = await request.post(`/api/leads/${leadId}/convert`, {
      data: { patient_id: patientId },
      headers: { Origin: 'http://127.0.0.1:3003' },
    })
    expect(conversionResponse.status()).toBe(200)
    expect((await conversionResponse.json()).data).toMatchObject({
      id: leadId,
      status: 'converted',
    })

    const convertedLeadResponse = await request.get(`/api/leads/${leadId}`)
    expect(convertedLeadResponse.status()).toBe(200)
    expect((await convertedLeadResponse.json()).data).toMatchObject({
      id: leadId,
      status: 'converted',
      patientId,
    })

    const timelineResponse = await request.get(`/api/contacts/${leadId}/timeline?type=lead`)
    expect(timelineResponse.status()).toBe(200)
    const timelineBody = await timelineResponse.json()
    const timeline = timelineBody.data ?? timelineBody
    expect(Array.isArray(timeline)).toBe(true)
    expect(timeline.map((entry: { type: string }) => entry.type)).toEqual(
      expect.arrayContaining(['lead_captured', 'lead_converted']),
    )

    const scheduledAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    scheduledAt.setUTCHours(14, 0, 0, 0)
    const appointmentPayload = {
      patientId,
      dentistId: DENTIST_ID,
      procedureId: PROCEDURE_ID,
      scheduledAt: scheduledAt.toISOString(),
      durationMinutes: 30,
    }
    const idempotencyKey = `gw03-${suffix}`
    const appointmentResponse = await request.post('/api/appointments', {
      data: appointmentPayload,
      headers: { 'Idempotency-Key': idempotencyKey, Origin: 'http://127.0.0.1:3003' },
    })
    expect(appointmentResponse.status()).toBe(201)
    const appointmentId = (await appointmentResponse.json()).data?.id
    expect(typeof appointmentId).toBe('string')

    const replayResponse = await request.post('/api/appointments', {
      data: appointmentPayload,
      headers: { 'Idempotency-Key': idempotencyKey, Origin: 'http://127.0.0.1:3003' },
    })
    expect(replayResponse.status()).toBe(201)
    expect((await replayResponse.json()).data?.id).toBe(appointmentId)

    const day = scheduledAt.toISOString().slice(0, 10)
    const calendarResponse = await request.get(
      `/api/appointments?patient_id=${patientId}&date=${day}`,
    )
    expect(calendarResponse.status()).toBe(200)
    const calendarBody = await calendarResponse.json()
    const appointments = calendarBody.data?.appointments ?? calendarBody.appointments
    const matchingAppointments = appointments.filter(
      (appointment: { id: string }) => appointment.id === appointmentId,
    )
    expect(matchingAppointments).toHaveLength(1)
    expect(matchingAppointments[0]).toMatchObject({
      id: appointmentId,
      patientId,
      status: 'scheduled',
    })
  })
})
