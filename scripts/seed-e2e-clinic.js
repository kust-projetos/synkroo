const https = require('https');

const SB_URL = 'jlkifrngxxayjrfunuuz.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsa2lmcm5neHhheWpyZnVudXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYyMzMyOSwiZXhwIjoyMDkwMTk5MzI5fQ.FiFk9g4ThSEB-pOCsjEyaRM8tZwAY8bCNnrw17yVJWo';

const CLINIC_ID = '1e211b5d-d8a9-44ef-a5c7-5ce6c583218a';

function post(table, data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const req = https.request({
      hostname: SB_URL,
      path: `/rest/v1/${table}`,
      method: 'POST',
      headers: {
        'apikey': SB_KEY,
        'Authorization': `Bearer ${SB_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Seeding Clinica Demo...');

  // Dentists
  const dentists = [
    { id: 'd0eebc99-0001-4ef8-bb6d-6bb9bd380a11', name: 'Dra. Maria Silva', phone: '(11) 99999-0001', email: 'maria.silva@clinicademo.com', cro: 'CRO-SP 12345', specialty: 'Ortodontia' },
    { id: 'd0eebc99-0002-4ef8-bb6d-6bb9bd380a11', name: 'Dr. Joao Santos', phone: '(11) 99999-0002', email: 'joao.santos@clinicademo.com', cro: 'CRO-SP 54321', specialty: 'Implantodontia' },
    { id: 'd0eebc99-0003-4ef8-bb6d-6bb9bd380a11', name: 'Dra. Ana Oliveira', phone: '(11) 99999-0003', email: 'ana.oliveira@clinicademo.com', cro: 'CRO-SP 67890', specialty: 'Endodontia' },
    { id: 'd0eebc99-0004-4ef8-bb6d-6bb9bd380a11', name: 'Dr. Carlos Pereira', phone: '(11) 99999-0004', email: 'carlos.pereira@clinicademo.com', cro: 'CRO-SP 11111', specialty: 'Clinico Geral' },
  ];

  for (const d of dentists) {
    const r = await post('dentists', { ...d, clinic_id: CLINIC_ID, is_active: true });
    console.log(`dentist ${d.name}: ${r.status}`);
  }

  // Procedures
  const procedures = [
    { id: 'p1-0001-4ef8-bb6d-6bb9bd380a11', name: 'Limpeza (Profilaxia)', description: 'Limpeza profissional dos dentes', duration_minutes: 30, price: 150, category: 'Preventiva' },
    { id: 'p2-0001-4ef8-bb6d-6bb9bd380a11', name: 'Obturacao', description: 'Restauracao de dente cariado', duration_minutes: 45, price: 200, category: 'Restauradora' },
    { id: 'p3-0001-4ef8-bb6d-6bb9bd380a11', name: 'Tratamento de Canal', description: 'Tratamento endodontico', duration_minutes: 60, price: 500, category: 'Endodontia' },
    { id: 'p4-0001-4ef8-bb6d-6bb9bd380a11', name: 'Extracao Simples', description: 'Extracao de dente', duration_minutes: 30, price: 180, category: 'Cirurgica' },
    { id: 'p5-0001-4ef8-bb6d-6bb9bd380a11', name: 'Extracao Siso', description: 'Extracao de siso', duration_minutes: 60, price: 400, category: 'Cirurgica' },
    { id: 'p6-0001-4ef8-bb6d-6bb9bd380a11', name: 'Clareamento Dental', description: 'Clareamento profissional', duration_minutes: 45, price: 800, category: 'Estetica' },
    { id: 'p7-0001-4ef8-bb6d-6bb9bd380a11', name: 'Avaliacao Ortodontica', description: 'Avaliacao ortodontica inicial', duration_minutes: 30, price: 300, category: 'Ortodontia' },
    { id: 'p8-0001-4ef8-bb6d-6bb9bd380a11', name: 'Manutencao de Aparelho', description: 'Ajuste de aparelho', duration_minutes: 30, price: 150, category: 'Ortodontia' },
    { id: 'p9-0001-4ef8-bb6d-6bb9bd380a11', name: 'Consulta Implante', description: 'Avaliacao para implante', duration_minutes: 45, price: 350, category: 'Implantodontia' },
    { id: 'p10-0001-4ef8-bb6d-6bb9bd380a11', name: 'Coroa Provisoria', description: 'Coroa provisoria', duration_minutes: 45, price: 400, category: 'Restauradora' },
    { id: 'p11-0001-4ef8-bb6d-6bb9bd380a11', name: 'Raio-X Panoramico', description: 'Exame radiografico', duration_minutes: 15, price: 80, category: 'Diagnostica' },
    { id: 'p12-0001-4ef8-bb6d-6bb9bd380a11', name: 'Consulta de Retorno', description: 'Consulta de retorno', duration_minutes: 15, price: 0, category: 'Consulta' },
  ];

  for (const p of procedures) {
    const r = await post('procedures', { ...p, clinic_id: CLINIC_ID, is_active: true });
    console.log(`procedure ${p.name}: ${r.status}`);
  }

  // Patients
  const names = ['Luciana Ferreira','Roberto Almeida','Fernanda Costa','Carlos Eduardo Souza','Patricia Rocha','Marcos Vinicius Lima','Juliana Martins','Andrei Barbosa','Camila Rodrigues','Bruno Gomes','Isabela Nascimento','Thiago Ribeiro','Amanda Lopes','Rafael Carvalho','Beatriz Mendes'];
  for (let i = 0; i < names.length; i++) {
    const p = {
      id: `pat-e2e-${String(i+1).padStart(3,'0')}`,
      clinic_id: CLINIC_ID,
      name: names[i],
      phone: `(11) 9${String(Math.floor(Math.random()*90000000+10000000))}`,
      email: `${names[i].toLowerCase().replace(/ /,'.')}@email.com`,
      is_active: true
    };
    const r = await post('patients', p);
    console.log(`patient ${names[i]}: ${r.status}`);
  }

  console.log('\nDone!');
}

main().catch(console.error);
