-- Enable RLS on financial tables that had policies but RLS was never enabled
ALTER TABLE budget_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;