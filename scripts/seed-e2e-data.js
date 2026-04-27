/**
 * Seed script for E2E tests
 * Applies minimal demo data directly via Supabase REST API
 */
const SUPABASE_URL = 'https://jlkifrngxxayjrfunuuz.supabase.co'
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsa2lmcm5neHhheWpyZnVudXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYyMzMyOSwiZXhwIjoyMDkwMTk5MzI5fQ.FiFk9g4ThSEB-pOCsjEyaRM8tZwAY8bCNnrw17yVJWo'

async function query(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql })
  })
  return res.json()
}

async function insert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(data)
  })
  return res.ok
}

async function main() {
  console.log('Getting clinic ID...')

  // Get demo clinic
  const clinicRes = await fetch(`${SUPABASE_URL}/rest/v1/clinics?slug=eq.clinica-demo`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  })
  const clinics = await clinicRes.json()
  if (!clinics || clinics.length === 0) {
    console.log('Clinic not found. Creating...')
    return
  }
  const clinicId = clinics[0].id
  console.log(`Clinic ID: ${clinicId}`)

  // Check if dentists exist
  const dentRes = await fetch(`${SUPABASE_URL}/rest/v1/dentists?clinic_id=eq.${clinicId}&limit=1`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  })
  const dentists = await dentRes.json()
  console.log(`Existing dentists: ${dentists.length}`)

  if (dentists.length === 0) {
    console.log('Inserting dentists...')
    await insert('dentists', { clinic_id: clinicId, name: 'Dra. Carolina Mendes', cro: 'CRO-SP 54321', specialty: 'Clínico Geral', is_active: true })
    await insert('dentists', { clinic_id: clinicId, name: 'Dr. Ricardo Santos', cro: 'CRO-SP 67890', specialty: 'Implantodontista', is_active: true })
  }

  // Check if patients exist
  const patRes = await fetch(`${SUPABASE_URL}/rest/v1/patients?clinic_id=eq.${clinicId}&limit=1`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  })
  const patients = await patRes.json()
  console.log(`Existing patients: ${patients.length}`)

  if (patients.length === 0) {
    console.log('Inserting patients...')
    const patientData = [
      { clinic_id: clinicId, name: 'Ana Paula Ferreira', phone: '11988881001', email: 'ana@test.com', cpf: '12345678001', birth_date: '1985-03-15', risk_score: 0.1 },
      { clinic_id: clinicId, name: 'Carlos Eduardo Silva', phone: '11988881002', email: 'carlos@test.com', cpf: '12345678002', birth_date: '1978-07-22', risk_score: 0.15 },
      { clinic_id: clinicId, name: 'Fernanda Lima', phone: '11988881003', email: 'fernanda@test.com', cpf: '12345678003', birth_date: '1995-02-14', risk_score: 0.12 },
      { clinic_id: clinicId, name: 'Roberto Almeida', phone: '11988881004', email: 'roberto@test.com', cpf: '12345678004', birth_date: '1982-05-30', risk_score: 0.2 },
    ]
    for (const p of patientData) {
      await insert('patients', p)
    }
  }

  // Check if appointments exist
  const apptRes = await fetch(`${SUPABASE_URL}/rest/v1/appointments?clinic_id=eq.${clinicId}&limit=1`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  })
  const appointments = await apptRes.json()
  console.log(`Existing appointments: ${appointments.length}`)

  if (appointments.length === 0) {
    console.log('Inserting appointments for today...')
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    // Get patients for appointments
    const allPats = await (await fetch(`${SUPABASE_URL}/rest/v1/patients?clinic_id=eq.${clinicId}`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    })).json()

    const allDents = await (await fetch(`${SUPABASE_URL}/rest/v1/dentists?clinic_id=eq.${clinicId}`, {
      headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
    })).json()

    if (allPats.length > 0 && allDents.length > 0) {
      const appts = [
        { clinic_id: clinicId, patient_id: allPats[0].id, dentist_id: allDents[0].id, scheduled_at: `${today}T09:00:00`, duration_minutes: 40, status: 'confirmed', notes: 'Limpeza' },
        { clinic_id: clinicId, patient_id: allPats[1].id, dentist_id: allDents[0].id, scheduled_at: `${today}T10:00:00`, duration_minutes: 60, status: 'confirmed', notes: 'Clareamento' },
        { clinic_id: clinicId, patient_id: allPats[2].id, dentist_id: allDents[1].id, scheduled_at: `${today}T11:00:00`, duration_minutes: 90, status: 'scheduled', notes: 'Tratamento de canal' },
        { clinic_id: clinicId, patient_id: allPats[3].id, dentist_id: allDents[0].id, scheduled_at: `${today}T14:00:00`, duration_minutes: 40, status: 'scheduled', notes: 'Retorno' },
        { clinic_id: clinicId, patient_id: allPats[0].id, dentist_id: allDents[1].id, scheduled_at: `${today}T15:00:00`, duration_minutes: 30, status: 'confirmed', notes: 'Restauração' },
      ]
      for (const a of appts) {
        await insert('appointments', a)
      }
      console.log(`Inserted ${appts.length} appointments`)
    }
  }

  // Check if leads exist
  const leadsRes = await fetch(`${SUPABASE_URL}/rest/v1/leads?clinic_id=eq.${clinicId}&limit=1`, {
    headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}` }
  })
  const leads = await leadsRes.json()
  console.log(`Existing leads: ${leads.length}`)

  if (leads.length === 0) {
    console.log('Inserting leads...')
    const leadData = [
      { clinic_id: clinicId, name: 'Marina Ribeiro', phone: '11977770011', email: 'marina@test.com', source: 'instagram', status: 'qualified', temperature: 'hot', score: 85 },
      { clinic_id: clinicId, name: 'Fábio Nascimento', phone: '11977770012', email: 'fabio@test.com', source: 'whatsapp', status: 'proposal', temperature: 'hot', score: 78 },
      { clinic_id: clinicId, name: 'Carla Duarte', phone: '11977770013', email: 'carla@test.com', source: 'referral', status: 'negotiation', temperature: 'hot', score: 92 },
      { clinic_id: clinicId, name: 'Ricardo Veiga', phone: '11977770014', email: 'ricardo@test.com', source: 'web', status: 'contacted', temperature: 'warm', score: 55 },
      { clinic_id: clinicId, name: 'Juliana Mars', phone: '11977770015', email: 'juliana@test.com', source: 'instagram', status: 'new', temperature: 'warm', score: 48 },
    ]
    for (const l of leadData) {
      await insert('leads', l)
    }
  }

  console.log('Seed complete!')
}

main().catch(console.error)
