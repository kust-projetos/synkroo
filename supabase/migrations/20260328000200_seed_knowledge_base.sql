-- ============================================
-- SYNKROO - Knowledge Base Seed Data
-- Version: 1.0.0
-- Date: 2026-03-28
-- ============================================

-- Seed knowledge base with common questions for dental clinics
-- These will be used by the RAG system for better responses

-- Insert default knowledge base entries (for demo clinic)
INSERT INTO knowledge_base (clinic_id, category, question, answer, keywords, is_active) VALUES
-- Procedimentos
((SELECT id FROM clinics WHERE slug = 'clinica-sorriso'), 'procedimentos',
 'Quais são os procedimentos disponíveis?',
 'Oferecemos clareamento, limpeza, extração, tratamento de canal, implantes, lentes de contato, obturação e procedimentos estéticos. Gostaria de saber mais sobre algum específico?',
 ARRAY['procedimentos', 'serviços', 'tratamentos', 'fazem'], true),

((SELECT id FROM clinics WHERE slug = 'clinica-sorriso'), 'procedimentos',
 'Vocês fazem clareamento dental?',
 'Sim! Fazemos clareamento dental tanto no consultório (resultados imediatos) quanto com moldeiras caseiras (tratamento gradual). O clareamento no consultório dura cerca de 1h30 e os resultados são visíveis na hora. Quer agendar uma avaliação?',
 ARRAY['clareamento', 'branqueamento', 'dentes brancos', 'clarear'], true),

((SELECT id FROM clinics WHERE slug = 'clinica-sorriso'), 'procedimentos',
 'Quanto custa um implante dental?',
 'O valor do implante varia conforme o caso, pois depende de exames e planejamento individual. Recomendamos agendar uma consulta de avaliação para que o dentista possa apresentar um orçamento personalizado. Posso te ajudar a agendar?',
 ARRAY['implante', 'valor implante', 'preço implante', 'custo implante'], true),

-- Horários
((SELECT id FROM clinics WHERE slug = 'clinica-sorriso'), 'horarios',
 'Qual o horário de funcionamento?',
 'Funcionamos de segunda a sexta das 8h às 18h e aos sábados das 8h às 12h. Para emergências, temos plantão aos domingos. Quer agendar um horário?',
 ARRAY['horário', 'funcionamento', 'abre', 'fecha', 'atendem'], true),

((SELECT id FROM clinics WHERE slug = 'clinica-sorriso'), 'horarios',
 'Vocês atendem aos sábados?',
 'Sim! Atendemos aos sábados das 8h às 12h. É um ótimo dia para quem trabalha durante a semana. Quer que eu verifique a disponibilidade?',
 ARRAY['sábado', 'sabado', 'fim de semana'], true),

-- Agendamento
((SELECT id FROM clinics WHERE slug = 'clinica-sorriso'), 'agendamento',
 'Como faço para marcar uma consulta?',
 'Posso te ajudar a agendar agora mesmo! Me informe qual procedimento você precisa e sua preferência de dia e horário que verifico a disponibilidade.',
 ARRAY['marcar', 'agendar', 'consulta', 'agendamento'], true),

((SELECT id FROM clinics WHERE slug = 'clinica-sorriso'), 'agendamento',
 'Preciso levar algum documento na primeira consulta?',
 'Na primeira consulta, traga um documento com foto (RG ou CNH) e, se tiver, seu cartão do convênio dental. Também é bom chegar uns 10 minutos antes para preencher a ficha de cadastro.',
 ARRAY['documento', 'primeira consulta', 'levar', 'documentos'], true),

((SELECT id FROM clinics WHERE slug = 'clinica-sorriso'), 'agendamento',
 'Posso cancelar ou reagendar minha consulta?',
 'Claro! Pedimos que cancele ou reagenda com pelo menos 24h de antecedência para que possamos oferecer o horário a outro paciente. Me fala qual sua necessidade que te ajudo.',
 ARRAY['cancelar', 'reagendar', 'desmarcar', 'mudar horário'], true),

-- Emergência
((SELECT id FROM clinics WHERE slug = 'clinica-sorriso'), 'emergencia',
 'Vocês atendem emergência?',
 'Sim, atendemos emergências! Se você está com dor, inchaço ou algum problema urgente, vou te passar para um atendente que vai te encaixar o mais rápido possível. Aguenta um momento?',
 ARRAY['emergência', 'urgente', 'dor', 'urgência'], true),

((SELECT id FROM clinics WHERE slug = 'clinica-sorriso'), 'emergencia',
 'Estou com muita dor de dente, o que faço?',
 'Sinto muito que você esteja passando por isso! Para dor de dente intensa, recomendamos vir o mais rápido possível para avaliação. Enquanto isso, pode tomar um analgésico se não houver alergia. Quer que eu te encaixe hoje?',
 ARRAY['dor', 'dor de dente', 'dor intensa', 'dói'], true),

-- Convênios
((SELECT id FROM clinics WHERE slug = 'clinica-sorriso'), 'convenios',
 'Quais convênios vocês aceitam?',
 'Trabalhamos com os principais convênios odontológicos como Unimed Dental, Amil Dental, SulAmérica, Porto Seguro e Bradesco Dental. Temos também planos particulares com desconto para pagamento à vista. Qual seu convênio?',
 ARRAY['convênio', 'plano', 'seguro', 'aceitam'], true),

-- Preços
((SELECT id FROM clinics WHERE slug = 'clinica-sorriso'), 'precos',
 'Vocês têm tabela de preços?',
 'Nossos valores variam conforme o procedimento e a complexidade de cada caso. Oferecemos condições especiais para pagamento à vista e parcelamento. O ideal é vir para uma avaliação gratuita onde apresentamos um orçamento personalizado.',
 ARRAY['preço', 'valor', 'quanto custa', 'tabela'], true),

-- Limpeza/Prevenção
((SELECT id FROM clinics WHERE slug = 'clinica-sorriso'), 'prevencao',
 'Com que frequência devo fazer limpeza?',
 'Recomendamos limpeza profissional (profilaxia) a cada 6 meses para manter a saúde bucal em dia. A limpeza remove o tártaro e a placa que a escovação não consegue remover. Há quanto tempo não faz uma?',
 ARRAY['limpeza', 'profilaxia', 'tártaro', 'prevenção'], true),

-- Ortodontia
((SELECT id FROM clinics WHERE slug = 'clinica-sorriso'), 'ortodontia',
 'Vocês fazem aparelho ortodôntico?',
 'Sim! Temos opções de aparelhos fixos metálicos, estéticos (porcelana) e alinhadores invisíveis. O tratamento ortodôntico dura em média 18 a 24 meses. Quer agendar uma avaliação para saber qual é o melhor para você?',
 ARRAY['aparelho', 'ortodontia', 'alinhador', 'invisalign'], true),

-- Localização
((SELECT id FROM clinics WHERE slug = 'clinica-sorriso'), 'localizacao',
 'Onde fica a clínica?',
 'Estamos localizados na Rua das Flores, 123, Centro. Temos estacionamento gratuito no local. Quer que eu envie a localização pelo WhatsApp?',
 ARRAY['onde', 'localização', 'endereço', 'como chegar'], true);

-- Update knowledge base to enable embeddings trigger
-- Note: After applying pgvector migration, run this to generate embeddings
-- This is done manually or via API to avoid requiring EMBEDDING_API_KEY during migration

-- Create function to seed embeddings (call after configuring EMBEDDING_API_KEY)
CREATE OR REPLACE FUNCTION seed_knowledge_embeddings()
RETURNS void AS $$
BEGIN
  -- This is a placeholder - embeddings should be generated via API
  -- The RAG service will generate embeddings on-the-fly when needed
  NULL;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE knowledge_base IS 'Clinic-specific knowledge for AI agent RAG';
COMMENT ON FUNCTION seed_knowledge_embeddings IS 'Placeholder - use API to generate embeddings';