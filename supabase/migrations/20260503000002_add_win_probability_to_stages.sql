-- Add win_probability column to pipeline_stages table
ALTER TABLE pipeline_stages ADD COLUMN win_probability INTEGER DEFAULT 50 CHECK (win_probability >= 0 AND win_probability <= 100);
COMMENT ON COLUMN pipeline_stages.win_probability IS 'Probabilidade de ganho estimada para este estágio (0-100)';