-- Migration: Add instance_name to whatsapp_instances for multi-tenant Evolution API
-- This allows mapping Evolution API instance names to specific clinics

ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS instance_name VARCHAR(100);

-- Create unique index on instance_name for fast lookup
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_instances_instance_name
  ON public.whatsapp_instances (instance_name)
  WHERE instance_name IS NOT NULL;

-- Add RLS policy for whatsapp_instances (currently has RLS enabled but no policies)
CREATE POLICY "Clinic users can manage whatsapp instances"
  ON public.whatsapp_instances FOR ALL
  USING (clinic_id IN (
    SELECT clinic_id FROM public.users
    WHERE id = auth.uid() AND is_active = true
  ));

-- Add RLS policy for message_templates (currently has RLS enabled but no policies)
DROP POLICY IF EXISTS "Clinic users manage message_templates" ON public.message_templates;
CREATE POLICY "Clinic users manage message_templates"
  ON public.message_templates FOR ALL
  USING (clinic_id IN (
    SELECT clinic_id FROM public.users
    WHERE id = auth.uid() AND is_active = true
  ));
