-- Fix duplicate pipeline stages: rename English to Portuguese names
UPDATE pipeline_stages SET name = 'Novos' WHERE name = 'new' AND clinic_id = '1e211b5d-d8a9-44ef-a5c7-5ce6c583218a';
UPDATE pipeline_stages SET name = 'Contatado' WHERE name = 'contacted' AND clinic_id = '1e211b5d-d8a9-44ef-a5c7-5ce6c583218a';
UPDATE pipeline_stages SET name = 'Qualificado' WHERE name = 'qualified' AND clinic_id = '1e211b5d-d8a9-44ef-a5c7-5ce6c583218a';
UPDATE pipeline_stages SET name = 'Proposta' WHERE name = 'proposal' AND clinic_id = '1e211b5d-d8a9-44ef-a5c7-5ce6c583218a';
UPDATE pipeline_stages SET name = 'Negociação' WHERE name = 'negotiation' AND clinic_id = '1e211b5d-d8a9-44ef-a5c7-5ce6c583218a';
UPDATE pipeline_stages SET name = 'Fechado' WHERE name = 'won' AND clinic_id = '1e211b5d-d8a9-44ef-a5c7-5ce6c583218a';
UPDATE pipeline_stages SET name = 'Perdido' WHERE name = 'lost' AND clinic_id = '1e211b5d-d8a9-44ef-a5c7-5ce6c583218a';

-- Also fix is_system flag (default stages created by service are NOT system stages)
UPDATE pipeline_stages SET is_system = false WHERE clinic_id = '1e211b5d-d8a9-44ef-a5c7-5ce6c583218a';