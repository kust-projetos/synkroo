-- ============================================
-- Add Patient Records & Finance Tables
-- Budget Installments, Payments, Treatment Plans
-- ============================================

-- ============================================
-- 1. Budget Installments Table
-- ============================================
CREATE TABLE IF NOT EXISTS budget_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    amount DECIMAL(12, 2) NOT NULL,
    due_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE budget_installments IS 'Individual installment payments for budgets';

-- ============================================
-- 2. Payments Table
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID REFERENCES budgets(id) ON DELETE SET NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'credit', 'debit', 'cash', 'boleto', 'transfer', 'other')),
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMENT ON TABLE payments IS 'Payment records for budget settlements';

-- ============================================
-- 3. Add treatment_plan_id FK to budgets
-- ============================================
ALTER TABLE budgets ADD COLUMN IF NOT EXISTS treatment_plan_id UUID REFERENCES treatment_plans(id) ON DELETE SET NULL;

-- ============================================
-- 4. RLS Policies for budget_installments
-- ============================================
CREATE POLICY "Users can view installments in their clinic" ON budget_installments
    FOR SELECT
    USING (
        budget_id IN (
            SELECT id FROM budgets WHERE clinic_id = public.get_user_clinic(auth.uid())
        )
    );

CREATE POLICY "Users can insert installments in their clinic" ON budget_installments
    FOR INSERT
    WITH CHECK (
        budget_id IN (
            SELECT id FROM budgets WHERE clinic_id = public.get_user_clinic(auth.uid())
        )
    );

CREATE POLICY "Users can update installments in their clinic" ON budget_installments
    FOR UPDATE
    USING (
        budget_id IN (
            SELECT id FROM budgets WHERE clinic_id = public.get_user_clinic(auth.uid())
        )
    );

CREATE POLICY "Users can delete installments in their clinic" ON budget_installments
    FOR DELETE
    USING (
        budget_id IN (
            SELECT id FROM budgets WHERE clinic_id = public.get_user_clinic(auth.uid())
        )
    );

-- ============================================
-- 5. RLS Policies for payments
-- ============================================
CREATE POLICY "Users can view payments in their clinic" ON payments
    FOR SELECT
    USING (
        budget_id IS NULL OR budget_id IN (
            SELECT id FROM budgets WHERE clinic_id = public.get_user_clinic(auth.uid())
        )
    );

CREATE POLICY "Users can insert payments in their clinic" ON payments
    FOR INSERT
    WITH CHECK (
        budget_id IS NULL OR budget_id IN (
            SELECT id FROM budgets WHERE clinic_id = public.get_user_clinic(auth.uid())
        )
    );

CREATE POLICY "Users can update payments in their clinic" ON payments
    FOR UPDATE
    USING (
        budget_id IS NULL OR budget_id IN (
            SELECT id FROM budgets WHERE clinic_id = public.get_user_clinic(auth.uid())
        )
    );

CREATE POLICY "Users can delete payments in their clinic" ON payments
    FOR DELETE
    USING (
        budget_id IS NULL OR budget_id IN (
            SELECT id FROM budgets WHERE clinic_id = public.get_user_clinic(auth.uid())
        )
    );

-- ============================================
-- 6. RLS Policies for budgets treatment_plan_id
-- ============================================
CREATE POLICY "Users can view budgets with treatment plans in their clinic" ON budgets
    FOR SELECT
    USING (
        treatment_plan_id IS NULL OR treatment_plan_id IN (
            SELECT id FROM treatment_plans WHERE clinic_id = public.get_user_clinic(auth.uid())
        )
    );

CREATE POLICY "Users can update budgets with treatment plans in their clinic" ON budgets
    FOR UPDATE
    USING (
        treatment_plan_id IS NULL OR treatment_plan_id IN (
            SELECT id FROM treatment_plans WHERE clinic_id = public.get_user_clinic(auth.uid())
        )
    );

-- ============================================
-- 7. Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_budget_installments_budget_id ON budget_installments(budget_id);
CREATE INDEX IF NOT EXISTS idx_budget_installments_status ON budget_installments(status);
CREATE INDEX IF NOT EXISTS idx_budget_installments_due_date ON budget_installments(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_budget_id ON payments(budget_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_method ON payments(payment_method);
CREATE INDEX IF NOT EXISTS idx_budgets_treatment_plan_id ON budgets(treatment_plan_id);

-- ============================================
-- 8. Updated_at trigger function
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to new tables
CREATE TRIGGER update_budget_installments_updated_at
    BEFORE UPDATE ON budget_installments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();