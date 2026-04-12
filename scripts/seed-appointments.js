// scripts/seed-appointments.js
// Seeds demo appointments directly into Supabase (service role)
// Usage: node scripts/seed-appointments.js

const path = require('path')
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') })

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const CLINIC_SLUG = 'clinica-demo'

function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function makeDate(dayOffset, time) {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  const [h, m] = time.split(':').map(Number)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}

async function seed() {
  console.log('Seeding appointments...\n')

  // Get clinic
  const { data: clinic } = await supabase.from('clinics').select('id').eq('slug', CLINIC_SLUG).single()
  if (!clinic) { console.error('Clinic not found'); process.exit(1) }
  const cid = clinic.id

  // Get existing data
  const { data: dentists } = await supabase.from('dentists').select('id, name').eq('clinic_id', cid).eq('is_active', true)
  const { data: procedures } = await supabase.from('procedures').select('id, name, duration_minutes').eq('clinic_id', cid).eq('is_active', true)
  const { data: patients } = await supabase.from('patients').select('id').eq('clinic_id', cid)

  const dentistIds = dentists?.map(d => d.id) || []
  const procedureIds = procedures?.map(p => p.id) || []
  const patientIds = patients?.map(p => p.id) || []
  const procMap = new Map(procedures?.map(p => [p.id, p]) || [])

  console.log(`Clinic: ${cid}`)
  console.log(`Dentists: ${dentistIds.length}, Procedures: ${procedureIds.length}, Patients: ${patientIds.length}\n`)

  if (dentistIds.length === 0 || patientIds.length === 0) {
    console.error('Need at least 1 dentist and 1 patient. Run the main seed first.')
    process.exit(1)
  }

  // Delete existing seed appointments (by notes pattern)
  const { error: delErr } = await supabase
    .from('appointments')
    .delete()
    .eq('clinic_id', cid)
    .not('notes', 'is', null)
  if (delErr) console.log('Note: could not clean old appointments:', delErr.message)

  const notes = [
    'Primeira consulta do paciente', 'Retorno para acompanhamento',
    'Avaliação inicial', 'Procedimento agendado pelo WhatsApp',
    'Urgência — dor relatada', 'Check-up de rotina',
    'Retorno pós-cirúrgico', 'Paciente solicitou horário cedo',
  ]

  // Time slots from 08:00 to 17:30
  const timeSlots = []
  for (let h = 8; h <= 17; h++) {
    timeSlots.push(String(h).padStart(2, '0') + ':00')
    timeSlots.push(String(h).padStart(2, '0') + ':30')
  }

  let ok = 0, err = 0
  const today = new Date()

  // Generate for each day: past 3 days + today + future 7 days
  for (let dayOffset = -3; dayOffset <= 7; dayOffset++) {
    const dow = new Date(today)
    dow.setDate(dow.getDate() + dayOffset)
    const dayOfWeek = dow.getDay() // 0=Sun

    // Skip Sundays, only morning on Saturdays
    const isSaturday = dayOfWeek === 6
    const isSunday = dayOfWeek === 0
    if (isSunday) continue

    const daySlots = isSaturday
      ? timeSlots.filter(t => parseInt(t) < 12)
      : timeSlots

    for (const dentistId of dentistIds) {
      const count = 2 + randomInt(0, 3)
      const shuffled = [...daySlots].sort(() => Math.random() - 0.5)
      const selected = shuffled.slice(0, Math.min(count, shuffled.length))

      for (const time of selected) {
        const procedureId = randomPick(procedureIds)
        const procInfo = procMap.get(procedureId)
        const duration = procInfo?.duration_minutes || 30

        let status
        if (dayOffset < -1) {
          status = randomPick(['completed', 'completed', 'completed', 'cancelled'])
        } else if (dayOffset === -1) {
          status = randomPick(['completed', 'completed', 'no_show', 'cancelled'])
        } else if (dayOffset === 0) {
          status = randomPick(['confirmed', 'confirmed', 'scheduled', 'in_progress'])
        } else {
          status = randomPick(['scheduled', 'scheduled', 'confirmed', 'confirmed'])
        }

        const { error } = await supabase.from('appointments').insert({
          clinic_id: cid,
          patient_id: randomPick(patientIds),
          dentist_id: dentistId,
          procedure_id: procedureId,
          scheduled_at: makeDate(dayOffset, time),
          duration_minutes: duration,
          status,
          notes: randomPick(notes),
        })

        if (error) { err++; if (err <= 5) console.error('Error:', error.message) }
        else ok++
      }
    }
  }

  console.log(`\nDone! Created ${ok} appointments (${err} errors)`)
}

seed().catch(e => { console.error(e); process.exit(1) })
