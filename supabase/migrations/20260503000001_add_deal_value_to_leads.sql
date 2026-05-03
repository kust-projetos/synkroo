-- Add deal_value column to leads table
ALTER TABLE leads ADD COLUMN deal_value DECIMAL(12,2) DEFAULT 0;
COMMENT ON COLUMN leads.deal_value IS 'Valor do negócio/empresa do lead';