#!/usr/bin/env node

/**
 * Synkroo - Scale Demo Data Seeder
 * Inserts large-scale test data for the demo clinic via Supabase REST API
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://jlkifrngxxayjrfunuuz.supabase.co';
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impsa2lmcm5neHhheWpyZnVudXV6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDYyMzMyOSwiZXhwIjoyMDkwMTk5MzI5fQ.FiFk9g4ThSEB-pOCsjEyaRM8tZwAY8bCNnrw17yVJWo';

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const SLUG = 'clinica-demo';

// --- Data arrays ---

const ADDITIONAL_DENTISTS = [
  { name: 'Dr. Felipe Andrade', phone: '(11) 99999-1004', email: 'felipe@clinicademo.com', cro: 'CRO-SP 22222', specialty: 'Endodontista', is_active: true },
  { name: 'Dra. Bianca Rocha', phone: '(11) 99999-1005', email: 'bianca@clinicademo.com', cro: 'CRO-SP 33333', specialty: 'Protesista', is_active: true },
];

const ADDITIONAL_PROCEDURES = [
  { name: 'Faceta de Porcelana', description: 'Faceta laminada em porcelana', duration_minutes: 60, price: 2500.00, category: 'Estética', is_active: true },
  { name: 'Profilaxia com AirFlow', description: 'Limpeza com jato de bicarbonato', duration_minutes: 30, price: 249.00, category: 'Prevenção', is_active: true },
  { name: 'Pulpoterapia', description: 'Tratamento de polpa dentária em crianças', duration_minutes: 45, price: 450.00, category: 'Endodontia', is_active: true },
  { name: 'Prótese Total', description: 'Prótese dentária total removível', duration_minutes: 90, price: 3200.00, category: 'Prótese', is_active: true },
  { name: 'Lente de Contato Dental', description: 'Lentes de contato ultrafinas', duration_minutes: 60, price: 3000.00, category: 'Estética', is_active: true },
];

const PATIENTS_BATCH_1 = [
  // Active patients (recent visits)
  { name: 'Adriana Figueiredo', phone: '11988882001', email: 'adriana.figueiredo@email.com', cpf: '23456789001', birth_date: '1986-04-12', tags: ['VIP'], risk_score: 0.08, notes: 'Almente fiel' },
  { name: 'Bruno Augusto', phone: '11988882002', email: 'bruno.augusto@email.com', cpf: '23456789002', birth_date: '1991-08-23', tags: ['Frequente'], risk_score: 0.15, notes: null },
  { name: 'Cássia Mello', phone: '11988882003', email: 'cassia.mello@email.com', cpf: '23456789003', birth_date: '1994-01-07', tags: ['Frequente'], risk_score: 0.12, notes: 'Ormiodontia em tratamento' },
  { name: 'Diego Tavares', phone: '11988882004', email: 'diego.tavares@email.com', cpf: '23456789004', birth_date: '1983-05-19', tags: [], risk_score: 0.22, notes: null },
  { name: 'Elaine Cardoso', phone: '11988882005', email: 'elaine.cardoso@email.com', cpf: '23456789005', birth_date: '1979-09-30', tags: ['VIP', 'Convênio'], risk_score: 0.10, notes: 'Amil' },
  { name: 'Flávio Peixoto', phone: '11988882006', email: 'flavio.peixoto@email.com', cpf: '23456789006', birth_date: '1988-12-14', tags: [], risk_score: 0.25, notes: null },
  { name: 'Gabriela Neves', phone: '11988882007', email: 'gabriela.neves@email.com', cpf: '23456789007', birth_date: '1996-03-28', tags: ['Novo'], risk_score: 0.05, notes: 'Primeira consulta ótima' },
  { name: 'Hugo Renan', phone: '11988882008', email: 'hugo.renan@email.com', cpf: '23456789008', birth_date: '1990-07-05', tags: [], risk_score: 0.28, notes: null },
  { name: 'Ingrid Sampaio', phone: '11988882009', email: 'ingrid.sampaio@email.com', cpf: '23456789009', birth_date: '1993-11-18', tags: ['Frequente'], risk_score: 0.14, notes: null },
  { name: 'Jorge Rangel', phone: '11988882010', email: 'jorge.rangel@email.com', cpf: '23456789010', birth_date: '1981-02-22', tags: [], risk_score: 0.30, notes: null },
];

const PATIENTS_BATCH_2 = [
  { name: 'Karen Braga', phone: '11988882011', email: 'karen.braga@email.com', cpf: '23456789011', birth_date: '1997-06-09', tags: ['Jovem'], risk_score: 0.09, notes: 'Estudante universitária' },
  { name: 'Leonardo Pinto', phone: '11988882012', email: 'leonardo.pinto@email.com', cpf: '23456789012', birth_date: '1985-10-01', tags: [], risk_score: 0.32, notes: null },
  { name: 'Monica Sales', phone: '11988882013', email: 'monica.sales@email.com', cpf: '23456789013', birth_date: '1992-04-15', tags: ['Frequente'], risk_score: 0.11, notes: null },
  { name: 'Nicolas Duarte', phone: '11988882014', email: 'nicolas.duarte@email.com', cpf: '23456789014', birth_date: '1989-08-27', tags: [], risk_score: 0.26, notes: null },
  { name: 'Olga Monteiro', phone: '11988882015', email: 'olga.monteiro@email.com', cpf: '23456789015', birth_date: '1975-12-03', tags: ['Convênio'], risk_score: 0.18, notes: 'SulAmérica' },
  { name: 'Priscila Gusmão', phone: '11988882016', email: 'priscila.gusmao@email.com', cpf: '23456789016', birth_date: '1998-01-20', tags: ['Novo'], risk_score: 0.06, notes: null },
  { name: 'Quentin Torres', phone: '11988882017', email: 'quentin.torres@email.com', cpf: '23456789017', birth_date: '1987-05-12', tags: [], risk_score: 0.35, notes: null },
  { name: 'Regina Lemos', phone: '11988882018', email: 'regina.lemos@email.com', cpf: '23456789018', birth_date: '1980-09-24', tags: ['VIP'], risk_score: 0.07, notes: 'Indica muitas pacientes' },
  { name: 'Samuel Cavalcanti', phone: '11988882019', email: 'samuel.cavalcanti@email.com', cpf: '23456789019', birth_date: '1994-02-08', tags: [], risk_score: 0.24, notes: null },
  { name: 'Tatiane Viana', phone: '11988882020', email: 'tatiane.viana@email.com', cpf: '23456789020', birth_date: '1991-06-30', tags: ['Frequente'], risk_score: 0.13, notes: null },
];

const PATIENTS_BATCH_3_INACTIVE = [
  // Moderate inactive (30-60 days)
  { name: 'Ulisses Barros', phone: '11988882021', email: 'ulisses.barros@email.com', cpf: '23456789021', birth_date: '1984-10-14', tags: ['Inativo'], risk_score: 0.50, notes: 'Ligar para reagendar' },
  { name: 'Valéria Soares', phone: '11988882022', email: 'valeria.soares@email.com', cpf: '23456789022', birth_date: '1978-03-28', tags: ['Inativo'], risk_score: 0.55, notes: 'Mudou de telefone' },
  { name: 'Wagner Macedo', phone: '11988882023', email: 'wagner.macedo@email.com', cpf: '23456789023', birth_date: '1990-07-10', tags: ['Inativo'], risk_score: 0.48, notes: null },
  { name: 'Xuxa Meneghel', phone: '11988882024', email: 'xuxa.meneghel@email.com', cpf: '23456789024', birth_date: '1962-11-22', tags: ['Inativo', 'VIP'], risk_score: 0.45, notes: 'Verificar retorno' },
  { name: 'Yuri Machado', phone: '11988882025', email: 'yuri.machado@email.com', cpf: '23456789025', birth_date: '1996-04-05', tags: ['Inativo'], risk_score: 0.52, notes: null },
  { name: 'Zuleica Ferri', phone: '11988882026', email: 'zuleica.ferri@email.com', cpf: '23456789026', birth_date: '1982-08-18', tags: ['Inativo'], risk_score: 0.53, notes: 'Faltou 2x seguidas' },
  { name: 'Alberto Lage', phone: '11988882027', email: 'alberto.lage@email.com', cpf: '23456789027', birth_date: '1977-01-30', tags: ['Inativo'], risk_score: 0.56, notes: null },
  { name: 'Bianca Teles', phone: '11988882028', email: 'bianca.teles@email.com', cpf: '23456789028', birth_date: '1995-06-12', tags: ['Inativo'], risk_score: 0.49, notes: null },
  { name: 'Cesar Mourão', phone: '11988882029', email: 'cesar.mourao@email.com', cpf: '23456789029', birth_date: '1988-10-25', tags: ['Inativo'], risk_score: 0.51, notes: 'Solicitar retorno urgente' },
  { name: 'Debora Accioly', phone: '11988882030', email: 'debora.accioly@email.com', cpf: '23456789030', birth_date: '1993-03-07', tags: ['Inativo'], risk_score: 0.47, notes: null },
];

const PATIENTS_BATCH_4_VERY_INACTIVE = [
  // Very inactive (60-180 days)
  { name: 'Eriberto Nogueira', phone: '11988882031', email: 'eriberto.nogueira@email.com', cpf: '23456789031', birth_date: '1974-07-19', tags: ['Muito Inativo'], risk_score: 0.70, notes: 'Cliente antigo, tentar reativar' },
  { name: 'Flora Diniz', phone: '11988882032', email: 'flora.diniz@email.com', cpf: '23456789032', birth_date: '1969-11-01', tags: ['Muito Inativo', 'Idoso'], risk_score: 0.75, notes: 'Precisa de prótese' },
  { name: 'Geraldo Vilaça', phone: '11988882033', email: 'geraldo.vilaca@email.com', cpf: '23456789033', birth_date: '1981-04-14', tags: ['Muito Inativo'], risk_score: 0.68, notes: null },
  { name: 'Helena Gouveia', phone: '11988882034', email: 'helena.gouveia@email.com', cpf: '23456789034', birth_date: '1990-08-27', tags: ['Muito Inativo'], risk_score: 0.72, notes: 'Mudou de cidade' },
  { name: 'Ivanilde Pontes', phone: '11988882035', email: 'ivanilde.pontes@email.com', cpf: '23456789035', birth_date: '1965-12-09', tags: ['Muito Inativo', 'Idoso'], risk_score: 0.80, notes: 'Não responde mensagens' },
  { name: 'José Américo', phone: '11988882036', email: 'jose.americo@email.com', cpf: '23456789036', birth_date: '1986-05-22', tags: ['Muito Inativo'], risk_score: 0.65, notes: 'Extração pendente' },
  { name: 'Kátia Rendeiro', phone: '11988882037', email: 'katia.rendeiro@email.com', cpf: '23456789037', birth_date: '1973-09-03', tags: ['Muito Inativo'], risk_score: 0.73, notes: 'Retorno após tratamento longo' },
  { name: 'Luiz Fernando', phone: '11988882038', email: 'luiz.fernando@email.com', cpf: '23456789038', birth_date: '1992-01-16', tags: ['Muito Inativo'], risk_score: 0.67, notes: null },
  { name: 'Marlene Bittencourt', phone: '11988882039', email: 'marlene.bittencourt@email.com', cpf: '23456789039', birth_date: '1958-06-29', tags: ['Muito Inativo', 'Idoso'], risk_score: 0.82, notes: 'Familia ainda é paciente' },
  { name: 'Nelson Prado', phone: '11988882040', email: 'nelson.prado@email.com', cpf: '23456789040', birth_date: '1979-10-11', tags: ['Muito Inativo'], risk_score: 0.69, notes: null },
];

const PATIENTS_BATCH_5_NEW = [
  // New patients (last 7 days)
  { name: 'Osvaldo Menezes', phone: '11988882041', email: 'osvaldo.menezes@email.com', cpf: '23456789041', birth_date: '1998-03-24', tags: ['Novo'], risk_score: 0.04, notes: 'Veio pelo Google' },
  { name: 'Paula Antunes', phone: '11988882042', email: 'paula.antunes@email.com', cpf: '23456789042', birth_date: '1995-07-08', tags: ['Novo', 'Indicação'], risk_score: 0.05, notes: 'Indicado pela Regina Lemos' },
  { name: 'Queila Furtado', phone: '11988882043', email: 'queila.furtado@email.com', cpf: '23456789043', birth_date: '1989-11-20', tags: ['Novo'], risk_score: 0.03, notes: 'Primeira consulta' },
  { name: 'Renato Filipe', phone: '11988882044', email: 'renato.filipe@email.com', cpf: '23456789044', birth_date: '1997-04-02', tags: ['Novo'], risk_score: 0.04, notes: null },
  { name: 'Solange Martins', phone: '11988882045', email: 'solange.martins@email.com', cpf: '23456789045', birth_date: '1984-08-15', tags: ['Novo', 'Convênio'], risk_score: 0.06, notes: 'Bradesco Saúde' },
  { name: 'Thales Medeiros', phone: '11988882046', email: 'thales.medeiros@email.com', cpf: '23456789046', birth_date: '1991-12-28', tags: ['Novo'], risk_score: 0.03, notes: null },
  { name: 'Ursula Marinho', phone: '11988882047', email: 'ursula.marinho@email.com', cpf: '23456789047', birth_date: '1996-05-10', tags: ['Novo'], risk_score: 0.05, notes: 'Instagram' },
];

const PATIENTS_BATCH_6_MISC = [
  { name: 'Vera Tomaz', phone: '11988882048', email: 'vera.tomaz@email.com', cpf: '23456789048', birth_date: '1980-09-22', tags: [], risk_score: 0.30, notes: null },
  { name: 'William Brandão', phone: '11988882049', email: 'william.brandao@email.com', cpf: '23456789049', birth_date: '1987-01-05', tags: [], risk_score: 0.33, notes: null },
  { name: 'Ximena Luz', phone: '11988882050', email: 'ximena.luz@email.com', cpf: '23456789050', birth_date: '1994-06-18', tags: [], risk_score: 0.27, notes: null },
  { name: 'Yasmin Rocha', phone: '11988882051', email: 'yasmin.rocha@email.com', cpf: '23456789051', birth_date: '1999-10-01', tags: ['Jovem'], risk_score: 0.08, notes: 'Universitária' },
  { name: 'Zeca Baleiro', phone: '11988882052', email: 'zeca.baleiro@email.com', cpf: '23456789052', birth_date: '1982-03-14', tags: [], risk_score: 0.36, notes: null },
  { name: 'Aline Souza', phone: '11988882053', email: 'aline.souza@email.com', cpf: '23456789053', birth_date: '1993-07-26', tags: [], risk_score: 0.23, notes: null },
  { name: 'Breno Aguiar', phone: '11988882054', email: 'breno.aguiar@email.com', cpf: '23456789054', birth_date: '1988-11-08', tags: [], risk_score: 0.29, notes: null },
  { name: 'Clara Requião', phone: '11988882055', email: 'clara.requiao@email.com', cpf: '23456789055', birth_date: '1996-04-20', tags: [], risk_score: 0.20, notes: null },
  { name: 'Davi Marcondes', phone: '11988882056', email: 'davi.marcondes@email.com', cpf: '23456789056', birth_date: '1990-08-02', tags: [], risk_score: 0.34, notes: null },
  { name: 'Eva Bentes', phone: '11988882057', email: 'eva.bentes@email.com', cpf: '23456789057', birth_date: '1985-12-15', tags: [], risk_score: 0.31, notes: null },
  { name: 'Fábio Correia', phone: '11988882058', email: 'fabio.correia@email.com', cpf: '23456789058', birth_date: '1992-05-28', tags: [], risk_score: 0.37, notes: null },
  { name: 'Giovanna Leal', phone: '11988882059', email: 'giovanna.leal@email.com', cpf: '23456789059', birth_date: '1998-09-10', tags: ['Jovem', 'Novo'], risk_score: 0.06, notes: null },
  { name: 'Hector Basílio', phone: '11988882060', email: 'hector.basilio@email.com', cpf: '23456789060', birth_date: '1983-01-23', tags: [], risk_score: 0.38, notes: null },
];

const PATIENTS_BATCH_7_FAMILY_SPECIAL = [
  // Family group
  { name: 'Rosa Almeida (mãe)', phone: '11988882061', email: 'rosa.almeida@email.com', cpf: '23456789061', birth_date: '1972-06-05', tags: ['Família', 'VIP'], risk_score: 0.12, notes: 'Mãe - família completa é paciente' },
  { name: 'Tiago Almeida (filho)', phone: '11988882062', email: 'tiago.almeida@email.com', cpf: '23456789062', birth_date: '2000-10-18', tags: ['Família', 'Jovem'], risk_score: 0.08, notes: 'Filho da Rosa' },
  { name: 'Luana Almeida (filha)', phone: '11988882063', email: 'luana.almeida@email.com', cpf: '23456789063', birth_date: '2003-02-28', tags: ['Família'], risk_score: 0.06, notes: 'Filha da Rosa, aparelho' },
  // Pregnant and special
  { name: 'Mariana Gravida', phone: '11988882064', email: 'mariana.gravida@email.com', cpf: '23456789064', birth_date: '1994-07-12', tags: ['Gestante'], risk_score: 0.10, notes: '7 meses de gestação' },
  { name: 'Paulo Diabético', phone: '11988882065', email: 'paulo.diabetico@email.com', cpf: '23456789065', birth_date: '1960-11-25', tags: ['Especial', 'Convênio'], risk_score: 0.20, notes: 'Diabético, cuidado especial' },
  { name: 'Ana Autista', phone: '11988882066', email: 'ana.autista@email.com', cpf: '23456789066', birth_date: '1999-03-08', tags: ['Especial'], risk_score: 0.09, notes: 'TEA - precisa de ambiente calmo' },
  // More variety
  { name: 'Rodrigo Palmeira', phone: '11988882067', email: 'rodrigo.palmeira@email.com', cpf: '23456789067', birth_date: '1986-07-20', tags: [], risk_score: 0.40, notes: null },
  { name: 'Sônia Viana', phone: '11988882068', email: 'sonia.viana@email.com', cpf: '23456789069', birth_date: '1968-11-02', tags: ['Convênio'], risk_score: 0.22, notes: 'Unimed' },
  { name: 'Túlio Marques', phone: '11988882069', email: 'tulio.marques@email.com', cpf: '23456789070', birth_date: '1991-04-14', tags: [], risk_score: 0.35, notes: null },
  { name: 'Úrsula Fagundes', phone: '11988882070', email: 'ursula.fagundes@email.com', cpf: '23456789071', birth_date: '1995-08-27', tags: [], risk_score: 0.19, notes: null },
  { name: 'Vítor Leme', phone: '11988882071', email: 'vitor.leme@email.com', cpf: '23456789072', birth_date: '1989-12-09', tags: [], risk_score: 0.41, notes: null },
  { name: 'Wanda Martins', phone: '11988882072', email: 'wanda.martins@email.com', cpf: '23456789073', birth_date: '1976-05-22', tags: ['VIP'], risk_score: 0.11, notes: 'Empresária local' },
  { name: 'Xavier Cunha', phone: '11988882073', email: 'xavier.cunha@email.com', cpf: '23456789074', birth_date: '1993-10-05', tags: [], risk_score: 0.28, notes: null },
  { name: 'Yara Peçanha', phone: '11988882074', email: 'yara.pecanha@email.com', cpf: '23456789075', birth_date: '1980-03-18', tags: ['Frequente'], risk_score: 0.16, notes: null },
  { name: 'Zilda Fontes', phone: '11988882075', email: 'zilda.fontes@email.com', cpf: '23456789076', birth_date: '1971-08-30', tags: [], risk_score: 0.43, notes: 'Reativar' },
];

// Set last_visit_at relative to now based on batch
function setLastVisit(patient, daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return { ...patient, last_visit_at: d.toISOString() };
}

const ALL_NEW_PATIENTS = [
  ...PATIENTS_BATCH_1.map(p => setLastVisit(p, 5 + Math.floor(Math.random() * 10))),
  ...PATIENTS_BATCH_2.map(p => setLastVisit(p, 7 + Math.floor(Math.random() * 15))),
  ...PATIENTS_BATCH_3_INACTIVE.map(p => setLastVisit(p, 32 + Math.floor(Math.random() * 20))),
  ...PATIENTS_BATCH_4_VERY_INACTIVE.map(p => setLastVisit(p, 85 + Math.floor(Math.random() * 100))),
  ...PATIENTS_BATCH_5_NEW.map(p => setLastVisit(p, 1 + Math.floor(Math.random() * 5))),
  ...PATIENTS_BATCH_6_MISC.map(p => setLastVisit(p, 14 + Math.floor(Math.random() * 20))),
  ...PATIENTS_BATCH_7_FAMILY_SPECIAL.map(p => setLastVisit(p, 7 + Math.floor(Math.random() * 30))),
];

const ADDITIONAL_LEADS = [
  // Hot
  { name: 'Renata Albuquerque', phone: '11977770031', email: 'renata.albuquerque@email.com', source: 'referral', status: 'proposal', temperature: 'hot', score: 82, interest: 'Implante Dentário', has_budget: true, has_timeline: true, notes: 'Proposta enviada ontem', contact_count: 3 },
  { name: 'Marcos Vinícius', phone: '11977770032', email: 'marcos.vinicius@email.com', source: 'whatsapp', status: 'negotiation', temperature: 'hot', score: 88, interest: 'Aparelho Ortodôntico', has_budget: true, has_timeline: true, notes: 'Negociando valor e parcelas', contact_count: 4 },
  { name: 'Carla Augusta', phone: '11977770033', email: 'carla.augusta@email.com', source: 'instagram', status: 'qualified', temperature: 'hot', score: 79, interest: 'Clareamento', has_budget: true, has_timeline: false, notes: 'Quer fazer antes do casamento em maio', contact_count: 2 },
  { name: 'Felipe Stern', phone: '11977770034', email: 'felipe.stern@email.com', source: 'web', status: 'proposal', temperature: 'hot', score: 85, interest: 'Faceta de Porcelana', has_budget: true, has_timeline: true, notes: 'Orçamento aprovado, marcar', contact_count: 3 },
  { name: 'Juliana Marselha', phone: '11977770035', email: 'juliana.marselha@email.com', source: 'referral', status: 'negotiation', temperature: 'hot', score: 90, interest: 'Prótese Total', has_budget: true, has_timeline: true, notes: 'Fechando nesta semana', contact_count: 5 },
  // Warm
  { name: 'Rodrigo Barreto', phone: '11977770036', email: 'rodrigo.barreto@email.com', source: 'web', status: 'contacted', temperature: 'warm', score: 55, interest: 'Limpeza Profissional', has_budget: false, has_timeline: false, notes: 'Primeiro contato, parece interessado', contact_count: 1 },
  { name: 'Simone Ferraz', phone: '11977770037', email: 'simone.ferraz@email.com', source: 'instagram', status: 'new', temperature: 'warm', score: 48, interest: 'Clareamento', has_budget: false, has_timeline: false, notes: 'Curtiu vários posts', contact_count: 0 },
  { name: 'Tomás Pacheco', phone: '11977770038', email: 'tomas.pacheco@email.com', source: 'whatsapp', status: 'qualified', temperature: 'warm', score: 62, interest: 'Tratamento de Canal', has_budget: true, has_timeline: false, notes: 'Com dor mas comparando preços', contact_count: 2 },
  { name: 'Úrsula Diniz', phone: '11977770039', email: 'ursula.diniz@email.com', source: 'referral', status: 'contacted', temperature: 'warm', score: 58, interest: 'Aparelho Ortodôntico', has_budget: false, has_timeline: true, notes: 'Filha precisa de aparelho', contact_count: 1 },
  { name: 'Vinicius Leal', phone: '11977770040', email: 'vinicius.leal@email.com', source: 'web', status: 'new', temperature: 'warm', score: 45, interest: 'Extração de Siso', has_budget: false, has_timeline: true, notes: 'Formulário preenchido ontem', contact_count: 0 },
  { name: 'Wanda Cruz', phone: '11977770041', email: 'wanda.cruz@email.com', source: 'instagram', status: 'contacted', temperature: 'warm', score: 52, interest: 'Coroa de Porcelana', has_budget: false, has_timeline: false, notes: 'Segunda tentativa de contato', contact_count: 2 },
  { name: 'Xavier Borges', phone: '11977770042', email: 'xavier.borges@email.com', source: 'whatsapp', status: 'qualified', temperature: 'warm', score: 60, interest: 'Implante Dentário', has_budget: true, has_timeline: false, notes: 'Tem orçamento, avaliando', contact_count: 2 },
  { name: 'Yasmin Fontes', phone: '11977770043', email: 'yasmin.fontes@email.com', source: 'web', status: 'contacted', temperature: 'warm', score: 50, interest: 'Restauração Estética', has_budget: false, has_timeline: true, notes: 'Precisa urgente mas sem pressa', contact_count: 1 },
  { name: 'Zeca Nogueira', phone: '11977770044', email: 'zeca.nogueira@email.com', source: 'referral', status: 'new', temperature: 'warm', score: 47, interest: 'Limpeza Profissional', has_budget: false, has_timeline: false, notes: 'Indicado por paciente existente', contact_count: 0 },
  { name: 'Adriana Teles', phone: '11977770045', email: 'adriana.teles@email.com', source: 'instagram', status: 'contacted', temperature: 'warm', score: 54, interest: 'Lente de Contato Dental', has_budget: false, has_timeline: false, notes: 'Interesse em estética', contact_count: 1 },
  // Cold
  { name: 'Bernardo Rocha', phone: '11977770046', email: 'bernardo.rocha@email.com', source: 'web', status: 'new', temperature: 'cold', score: 22, interest: 'Limpeza Profissional', has_budget: false, has_timeline: false, notes: 'Só consultou preço', contact_count: 0 },
  { name: 'Cláudia Ribeiro', phone: '11977770047', email: 'claudia.ribeiro@email.com', source: 'instagram', status: 'new', temperature: 'cold', score: 18, interest: 'Clareamento', has_budget: false, has_timeline: false, notes: 'Curtiu post, sem urgência', contact_count: 0 },
  { name: 'Danilo Esteves', phone: '11977770048', email: 'danilo.esteves@email.com', source: 'whatsapp', status: 'contacted', temperature: 'cold', score: 28, interest: 'Restauração', has_budget: false, has_timeline: false, notes: 'Não respondeu mensagens', contact_count: 1 },
  { name: 'Elisa Marques', phone: '11977770049', email: 'elisa.marques@email.com', source: 'web', status: 'new', temperature: 'cold', score: 15, interest: 'Implante Dentário', has_budget: false, has_timeline: false, notes: 'Orçamento muito alto', contact_count: 0 },
  { name: 'Fernando Gil', phone: '11977770050', email: 'fernando.gil@email.com', source: 'instagram', status: 'contacted', temperature: 'cold', score: 25, interest: 'Aparelho Ortodôntico', has_budget: false, has_timeline: false, notes: 'Disse que vai pensar', contact_count: 1 },
  { name: 'Gisela Porto', phone: '11977770051', email: 'gisela.porto@email.com', source: 'web', status: 'new', temperature: 'cold', score: 20, interest: 'Extração de Siso', has_budget: false, has_timeline: false, notes: 'Sem urgência', contact_count: 0 },
  { name: 'Humberto Tavares', phone: '11977770052', email: 'humberto.tavares@email.com', source: 'whatsapp', status: 'new', temperature: 'cold', score: 12, interest: 'Limpeza Profissional', has_budget: false, has_timeline: false, notes: 'Mandou mensagem genérica', contact_count: 0 },
  { name: 'Irene Bastos', phone: '11977770053', email: 'irene.bastos@email.com', source: 'instagram', status: 'contacted', temperature: 'cold', score: 30, interest: 'Profilaxia', has_budget: false, has_timeline: false, notes: 'Não demonstrou interesse real', contact_count: 2 },
  // Converted
  { name: 'José Renato', phone: '11977770054', email: 'jose.renato@email.com', source: 'referral', status: 'converted', temperature: 'hot', score: 95, interest: 'Implante Dentário', has_budget: true, has_timeline: true, notes: 'Convertido! Agendado para próxima semana', contact_count: 4 },
  { name: 'Kelly Sampaio', phone: '11977770055', email: 'kelly.sampaio@email.com', source: 'instagram', status: 'converted', temperature: 'hot', score: 88, interest: 'Clareamento', has_budget: true, has_timeline: true, notes: 'Fechou clareamento profissional', contact_count: 3 },
  { name: 'Leonardo Faria', phone: '11977770056', email: 'leonardo.faria@email.com', source: 'whatsapp', status: 'converted', temperature: 'hot', score: 91, interest: 'Aparelho Ortodôntico', has_budget: true, has_timeline: true, notes: 'Fechou aparelho estético', contact_count: 3 },
  { name: 'Marina Luz', phone: '11977770057', email: 'marina.luz@email.com', source: 'web', status: 'converted', temperature: 'hot', score: 87, interest: 'Restauração Estética', has_budget: true, has_timeline: true, notes: 'Convertido pelo site', contact_count: 2 },
  // Lost
  { name: 'Nathalia Cunha', phone: '11977770058', email: 'nathalia.cunha@email.com', source: 'whatsapp', status: 'lost', temperature: 'warm', score: 38, interest: 'Aparelho Ortodôntico', has_budget: false, has_timeline: false, notes: 'Escolheu outra clínica mais barata', contact_count: 3 },
  { name: 'Otávio Mendes', phone: '11977770059', email: 'otavio.mendes@email.com', source: 'web', status: 'lost', temperature: 'cold', score: 20, interest: 'Limpeza Profissional', has_budget: false, has_timeline: false, notes: 'Sem resposta após 3 tentativas', contact_count: 3 },
  { name: 'Patrícia Gomes', phone: '11977770060', email: 'patricia.gomes@email.com', source: 'instagram', status: 'lost', temperature: 'warm', score: 35, interest: 'Clareamento', has_budget: false, has_timeline: false, notes: 'Desistiu por causa do preço', contact_count: 2 },
];

const ADDITIONAL_CAMPAIGNS = [
  { name: 'Black Novembro - Implantes', description: 'Promoção de black friday para implantes com 40% off', campaign_type: 'promotional', channel: 'whatsapp', status: 'draft', message_template: '🖤 BLACK FRIDAY 🖤 Implante com 40% de desconto! De R$ 4.500 por R$ 2.700. Válido apenas para novembro. Responda IMPLANTE para agendar avaliação.' },
  { name: 'Volta às Aulas - Jovens', description: 'Campanha para jovens com desconto em aparelho', campaign_type: 'promotional', channel: 'instagram', status: 'scheduled', message_template: '📚 VOLTA ÀS AULAS 📚 Aparelho ortodôntico com entrada facilitada! Parcelamos em até 18x. Marque sua avaliação gratuita!' },
  { name: 'Aniversariantes do Mês', description: 'Desconto especial para pacientes aniversariantes', campaign_type: 'promotional', channel: 'whatsapp', status: 'running', message_template: '🎂 FELIZ ANIVERSÁRIO! 🎂 Em comemoração ao seu mês, ganhe 25% de desconto em qualquer procedimento estético! Válido até o final do mês. Responda ANIVERSARIO.', total_recipients: 30, sent_count: 18, response_count: 6, conversion_count: 2 },
  { name: 'Pós-Tratamento Canal', description: 'Follow-up para pacientes que fizeram canal recentemente', campaign_type: 'follow_up', channel: 'whatsapp', status: 'running', message_template: 'Olá {{patient_name}}! Como está se sentindo após o tratamento de canal? Se tiver qualquer desconforto, entre em contato. Sua saúde bucal é nossa prioridade! 😊', total_recipients: 15, sent_count: 12, response_count: 8, conversion_count: 0 },
  { name: 'Reativação Q1', description: 'Reativar pacientes que não vêm desde o início do ano', campaign_type: 'reactivation', channel: 'whatsapp', status: 'paused', message_template: 'Olá {{patient_name}}! Estamos com saudades! 💙 Preparamos uma surpresa especial para seu retorno. Responda VOLTAR para receber um desconto exclusivo!', total_recipients: 40, sent_count: 10, response_count: 2, conversion_count: 1 },
  { name: 'Pesquisa de Satisfação Q1', description: 'Coletar feedback dos pacientes do primeiro trimestre', campaign_type: 'follow_up', channel: 'whatsapp', status: 'completed', message_template: 'Olá {{patient_name}}! Sua opinião vale muito! 🙏 Responda nossa pesquisa rápida (1 minuto) e concorra a uma limpeza gratuita: [link]', total_recipients: 90, sent_count: 85, response_count: 52, conversion_count: 0 },
  { name: 'Dia das Mães - Estética', description: 'Promoção de Dia das Mães para procedimentos estéticos', campaign_type: 'promotional', channel: 'instagram', status: 'scheduled', message_template: '💐 DIA DAS MÃES 💐 Presenteie quem você ama com um sorriso novo! Clareamento + Limpeza com 30% off. vouchers limitados! Responda MAES.' },
];

const ADDITIONAL_TEMPLATES = [
  { name: 'Confirmação de Agendamento', category: 'appointment', content: 'Olá {{patient_name}}! Confirmamos seu agendamento para {{procedure}} no dia {{date}} às {{time}} com {{dentist_name}}. Responda CONFIRMAR para confirmar ou CANCELAR para reagendar.', variables: { patient_name: '', procedure: '', date: '', time: '', dentist_name: '' }, status: 'approved' },
  { name: 'Lembrete 24h', category: 'reminder', content: 'Olá {{patient_name}}! Lembrete: sua consulta é amanhã às {{time}} com {{dentist_name}}. Estamos te esperando! 😊', variables: { patient_name: '', time: '', dentist_name: '' }, status: 'approved' },
  { name: 'Lembrete 1h', category: 'reminder', content: 'Olá {{patient_name}}! Sua consulta começa em 1 hora. Confirme sua presença respondendo SIM.', variables: { patient_name: '' }, status: 'approved' },
  { name: 'Pós-Consulta', category: 'follow_up', content: 'Olá {{patient_name}}! Como está se sentindo após sua consulta de {{procedure}}? Se tiver qualquer dúvida, estamos aqui! 😊', variables: { patient_name: '', procedure: '' }, status: 'approved' },
  { name: 'Pesquisa NPS', category: 'feedback', content: 'Olá {{patient_name}}! Em uma escala de 0 a 10, o quanto você recomendaria nossa clínica para um amigo? Sua opinião é muito importante!', variables: { patient_name: '' }, status: 'approved' },
  { name: 'Reativação', category: 'retention', content: 'Olá {{patient_name}}! Sentimos sua falta! 💙 Faz {{days_since}} dias que não te vemos. Que tal agendar uma revisão? Responda HORARIOS para ver disponibilidade.', variables: { patient_name: '', days_since: '' }, status: 'approved' },
  { name: 'Aniversário', category: 'promotional', content: 'Olá {{patient_name}}! 🎂 Feliz aniversário! Para celebrar, ganhe 25% de desconto em qualquer procedimento estético este mês. Responda ANIVERSARIO para agendar!', variables: { patient_name: '' }, status: 'approved' },
];

// --- Helper functions ---

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function hoursAgo(hours) {
  const d = new Date();
  d.setHours(d.getHours() - hours);
  return d.toISOString();
}

// --- Main seeder ---

async function seed() {
  console.log('🌱 Starting scale demo data seeding...\n');

  // 1. Get clinic
  const { data: clinic, error: clinicErr } = await supabase
    .from('clinics').select('id').eq('slug', SLUG).single();
  if (clinicErr || !clinic) {
    console.error('❌ Clinic not found:', clinicErr?.message);
    return;
  }
  const clinicId = clinic.id;
  console.log(`✅ Clinic: ${clinicId}`);

  // 2. Get admin user
  const { data: adminUser } = await supabase
    .from('users').select('id').eq('clinic_id', clinicId).in('role', ['admin', 'owner']).limit(1).single();
  const userId = adminUser?.id || null;
  console.log(`✅ Admin user: ${userId || 'not found'}`);

  // 3. Insert dentists
  console.log('\n--- Dentists ---');
  for (const d of ADDITIONAL_DENTISTS) {
    const { error } = await supabase.from('dentists').insert({ clinic_id: clinicId, ...d });
    console.log(`  ${d.name}: ${error ? error.message : 'OK'}`);
  }

  // Get all dentist IDs
  const { data: dentists } = await supabase.from('dentists').select('id').eq('clinic_id', clinicId).eq('is_active', true);
  const dentistIds = dentists?.map(d => d.id) || [];
  console.log(`  Total dentists: ${dentistIds.length}`);

  // 4. Insert procedures
  console.log('\n--- Procedures ---');
  for (const p of ADDITIONAL_PROCEDURES) {
    const { error } = await supabase.from('procedures').insert({ clinic_id: clinicId, ...p });
    console.log(`  ${p.name}: ${error ? error.message : 'OK'}`);
  }

  const { data: procedures } = await supabase.from('procedures').select('id').eq('clinic_id', clinicId).eq('is_active', true);
  const procedureIds = procedures?.map(p => p.id) || [];
  console.log(`  Total procedures: ${procedureIds.length}`);

  // 5. Insert patients
  console.log('\n--- Patients (90 new) ---');
  let patientOk = 0, patientErr = 0;
  const patientIds = [];
  for (const p of ALL_NEW_PATIENTS) {
    const { data, error } = await supabase.from('patients').insert({ clinic_id: clinicId, ...p }).select('id').single();
    if (error) {
      patientErr++;
      if (patientErr <= 3) console.log(`  ❌ ${p.name}: ${error.message}`);
    } else {
      patientOk++;
      patientIds.push(data.id);
    }
  }
  console.log(`  ✅ Inserted: ${patientOk}, Errors: ${patientErr}`);

  // Get ALL patient IDs (existing + new)
  const { data: allPatients } = await supabase.from('patients').select('id').eq('clinic_id', clinicId);
  const allPatientIds = allPatients?.map(p => p.id) || [];
  console.log(`  Total patients for clinic: ${allPatientIds.length}`);

  // 6. Insert appointments (~80)
  console.log('\n--- Appointments (~80 new) ---');
  const durations = [30, 40, 60, 90];
  const appointmentConfigs = [
    // Today (8)
    ...Array(8).fill(null).map((_, i) => ({
      status: ['confirmed', 'confirmed', 'confirmed', 'in_progress', 'completed', 'scheduled', 'scheduled', 'scheduled'][i],
      dayOffset: 0, hourOffset: 8 + i,
    })),
    // Yesterday (6)
    ...Array(6).fill(null).map((_, i) => ({
      status: i < 4 ? 'completed' : (i === 4 ? 'cancelled' : 'no_show'),
      dayOffset: -1, hourOffset: 8 + i,
    })),
    // Past week (25)
    ...Array(25).fill(null).map(() => ({
      status: Math.random() < 0.1 ? (Math.random() < 0.5 ? 'cancelled' : 'no_show') : 'completed',
      dayOffset: -(2 + randomInt(0, 5)), hourOffset: 8 + randomInt(0, 9),
    })),
    // Tomorrow (6)
    ...Array(6).fill(null).map(() => ({
      status: Math.random() < 0.3 ? 'confirmed' : 'scheduled',
      dayOffset: 1, hourOffset: 8 + randomInt(0, 9),
    })),
    // Next 7 days (15)
    ...Array(15).fill(null).map(() => ({
      status: Math.random() < 0.25 ? 'confirmed' : 'scheduled',
      dayOffset: 2 + randomInt(0, 5), hourOffset: 8 + randomInt(0, 9),
    })),
    // Next 30 days (25)
    ...Array(25).fill(null).map(() => ({
      status: 'scheduled',
      dayOffset: 8 + randomInt(0, 22), hourOffset: 8 + randomInt(0, 9),
    })),
    // Deep past 30-90 days (15)
    ...Array(15).fill(null).map(() => ({
      status: 'completed',
      dayOffset: -(30 + randomInt(0, 60)), hourOffset: 8 + randomInt(0, 9),
    })),
  ];

  let apptOk = 0, apptErr = 0;
  for (const cfg of appointmentConfigs) {
    const date = new Date();
    date.setDate(date.getDate() + cfg.dayOffset);
    date.setHours(cfg.hourOffset, randomInt(0, 59), 0, 0);

    const { error } = await supabase.from('appointments').insert({
      clinic_id: clinicId,
      patient_id: randomPick(allPatientIds),
      dentist_id: randomPick(dentistIds),
      procedure_id: randomPick(procedureIds),
      scheduled_at: date.toISOString(),
      duration_minutes: randomPick(durations),
      status: cfg.status,
    });
    if (error) apptErr++; else apptOk++;
  }
  console.log(`  ✅ Inserted: ${apptOk}, Errors: ${apptErr}`);

  // 7. Insert conversations (~30)
  console.log('\n--- Conversations (30 new) ---');
  const convIds = [];
  const channels = ['whatsapp', 'instagram', 'web'];
  const convStatuses = ['active', 'active', 'active', 'waiting', 'escalated', 'closed'];

  for (let i = 0; i < 30; i++) {
    const channel = channels[i % 3];
    const status = randomPick(convStatuses);
    const externalId = channel === 'whatsapp'
      ? '5511' + (9900000000 + randomInt(0, 9999999))
      : channel === 'instagram'
        ? '@user_' + randomInt(0, 99999)
        : 'web_session_' + randomInt(0, 999999);

    const { data, error } = await supabase.from('conversations').insert({
      clinic_id: clinicId,
      patient_id: Math.random() > 0.3 ? randomPick(allPatientIds) : null,
      channel,
      external_id: externalId,
      status,
      last_message_at: hoursAgo(randomInt(0, 2880)),
      message_count: randomInt(1, 10),
    }).select('id').single();

    if (error) {
      if (i < 3) console.log(`  ❌ Conv ${i}: ${error.message}`);
    } else {
      convIds.push(data.id);
    }
  }
  console.log(`  ✅ Inserted: ${convIds.length}`);

  // 8. Insert messages (~200+)
  console.log('\n--- Messages (~200+ new) ---');
  const inboundMsgs = [
    'Olá, gostaria de agendar uma consulta',
    'Qual o horário disponível amanhã?',
    'Preciso cancelar meu agendamento de amanhã',
    'Qual o valor do implante dentário?',
    'Estou com dor no dente, o que posso fazer?',
    'Vocês atendem pelo convênio Bradesco?',
    'Quero fazer um clareamento dental',
    'Posso reagendar para próxima semana?',
    'Gostaria de saber sobre aparelho invisível',
    'Preciso de uma extração de siso',
    'Vocês fazem faceta de porcelana?',
    'Quanto tempo dura o tratamento de canal?',
    'Tem como parcelar o tratamento?',
    'Preciso de uma limpeza urgente',
    'Quais formas de pagamento vocês aceitam?',
  ];
  const outboundMsgs = [
    'Olá! Claro, posso te ajudar. Qual procedimento deseja?',
    'Temos horários às 9h, 11h e 15h. Qual prefere?',
    'Entendi, vou cancelar para você. Deseja reagendar?',
    'O implante com coroa fica R$ 4.500. Posso agendar uma avaliação?',
    'Recomendo que venha o mais rápido possível. Temos horário hoje às 16h.',
    'Sim, atendemos Bradesco Saúde! Posso verificar sua cobertura.',
    'Ótimo! Temos clareamento profissional e caseiro. O profissional tem resultado imediato.',
    'Claro! Quando seria melhor para você?',
    'Temos aparelho metálico e estético. Agende uma avaliação ortodôntica!',
    'A extração de siso leva cerca de 45 minutos. Quer agendar?',
    'Sim! A faceta fica pronta em 2 sessões. Valor a partir de R$ 2.500.',
    'O tratamento de canal leva em média 2 sessões de 90 minutos.',
    'Parcelamos em até 10x sem juros no cartão!',
    'Perfeito! Temos horário de limpeza ainda hoje às 17h.',
    'Aceitamos cartão, PIX, dinheiro e até 10x sem juros.',
  ];
  const intents = ['agendamento', 'confirmacao', 'duvida', 'emergencia', 'reclamacao', 'outros'];

  let msgOk = 0;
  for (const convId of convIds) {
    const msgCount = 4 + randomInt(0, 4);
    const baseTime = new Date();
    baseTime.setMinutes(baseTime.getMinutes() - randomInt(10, 120));

    for (let j = 0; j < msgCount; j++) {
      const isInbound = j % 2 === 0;
      const msgTime = new Date(baseTime.getTime() + j * 5 * 60000);

      const { error } = await supabase.from('messages').insert({
        conversation_id: convId,
        direction: isInbound ? 'inbound' : 'outbound',
        content: isInbound ? randomPick(inboundMsgs) : randomPick(outboundMsgs),
        intent: randomPick(intents),
        is_ai: !isInbound,
        created_at: msgTime.toISOString(),
      });
      if (!error) msgOk++;
    }
  }
  console.log(`  ✅ Inserted: ${msgOk} messages`);

  // 9. Insert leads (30)
  console.log('\n--- Leads (30 new) ---');
  let leadOk = 0;
  const leadIds = [];
  for (const l of ADDITIONAL_LEADS) {
    const lastContact = l.contact_count > 0 ? hoursAgo(randomInt(1, 240)) : null;
    const nextFollowup = l.status === 'converted' || l.status === 'lost' ? null : daysFromNow(randomInt(1, 14));

    const { data, error } = await supabase.from('leads').insert({
      clinic_id: clinicId,
      ...l,
      last_contact_at: lastContact,
      next_followup_at: nextFollowup,
    }).select('id').single();

    if (error) {
      if (leadOk < 3) console.log(`  ❌ ${l.name}: ${error.message}`);
    } else {
      leadOk++;
      leadIds.push(data.id);
    }
  }
  console.log(`  ✅ Inserted: ${leadOk}`);

  // 10. Insert lead activities (~100+)
  console.log('\n--- Lead Activities (~100+ new) ---');
  const actTypes = ['call', 'email', 'whatsapp', 'note', 'meeting', 'proposal_sent'];
  const actDescs = [
    'Tentativa de contato por telefone',
    'Email enviado com proposta comercial',
    'Mensagem via WhatsApp enviada',
    'Nota interna adicionada',
    'Reunião realizada na clínica',
    'Proposta comercial enviada',
    'Retorno de ligação recebido',
    'Follow-up por email',
    'Ligação atendida - cliente interessado',
    'Orçamento detalhado enviado por email',
    'Cliente pediu mais tempo para decidir',
    'Indicação recebida de outro paciente',
    'Agendamento de avaliação confirmado',
    'Cliente pediu desconto',
  ];

  let actOk = 0;
  for (const leadId of leadIds) {
    const count = 2 + randomInt(0, 3);
    for (let j = 0; j < count; j++) {
      const { error } = await supabase.from('lead_activities').insert({
        lead_id: leadId,
        activity_type: randomPick(actTypes),
        description: randomPick(actDescs),
        performed_at: hoursAgo(j * randomInt(1, 48)),
      });
      if (!error) actOk++;
    }
  }
  console.log(`  ✅ Inserted: ${actOk}`);

  // 11. Insert campaigns (7)
  console.log('\n--- Campaigns (7 new) ---');
  const campaignIds = [];
  for (const c of ADDITIONAL_CAMPAIGNS) {
    const { data, error } = await supabase.from('campaigns').insert({
      clinic_id: clinicId,
      ...c,
      created_by: userId,
      started_at: c.status === 'running' || c.status === 'completed' || c.status === 'paused' ? daysAgo(randomInt(5, 30)) : null,
      scheduled_at: c.status === 'scheduled' ? daysFromNow(randomInt(10, 30)) : null,
    }).select('id').single();

    if (error) {
      console.log(`  ❌ ${c.name}: ${error.message}`);
    } else {
      campaignIds.push(data.id);
      console.log(`  ✅ ${c.name}`);
    }
  }

  // 12. Insert campaign recipients (~185+)
  console.log('\n--- Campaign Recipients (~185+ new) ---');
  const recipientStatuses = ['sent', 'delivered', 'delivered', 'responded'];
  let recOk = 0;
  for (const campId of campaignIds) {
    const count = 10 + randomInt(0, 30);
    for (let j = 0; j < count; j++) {
      const { error } = await supabase.from('campaign_recipients').insert({
        campaign_id: campId,
        patient_id: randomPick(allPatientIds),
        status: randomPick(recipientStatuses),
        sent_at: hoursAgo(randomInt(1, 168)),
        delivered_at: hoursAgo(randomInt(0, 160)),
      });
      if (!error) recOk++;
    }
  }
  console.log(`  ✅ Inserted: ${recOk}`);

  // 13. Insert message templates (7)
  console.log('\n--- Message Templates (7 new) ---');
  for (const t of ADDITIONAL_TEMPLATES) {
    const { error } = await supabase.from('message_templates').insert({ clinic_id: clinicId, ...t });
    console.log(`  ${t.name}: ${error ? error.message : 'OK'}`);
  }

  // --- Summary ---
  console.log('\n' + '='.repeat(50));
  console.log('📊 FINAL COUNTS:');

  const tables = ['patients', 'dentists', 'procedures', 'appointments', 'conversations', 'leads', 'campaigns', 'message_templates'];
  for (const t of tables) {
    try {
      const { count } = await supabase.from(t).select('*', { count: 'exact', head: true }).eq('clinic_id', clinicId);
      console.log(`  ${t}: ${count ?? '?'}`);
    } catch {
      console.log(`  ${t}: (unable to count)`);
    }
  }

  const { count: msgCount } = await supabase.from('messages').select('*', { count: 'exact', head: true });
  console.log(`  messages (total): ${msgCount ?? '?'}`);

  console.log('\n✅ Seeding complete!');
}

seed().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
