-- Create demo user for authentication
-- This creates a user in Supabase Auth with the demo credentials

-- First, ensure we have a demo clinic
INSERT INTO clinics (
  id,
  name,
  slug,
  phone,
  email,
  settings,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'Clinica Demo',
  'clinica-demo',
  '(11) 3333-3333',
  'contato@clinicademo.com',
  '{"ai_settings": {"auto_response": true, "escalation_enabled": true, "business_name": "Clinica Demo"}, "business_hours": {"monday": {"open": "08:00", "close": "18:00"}, "tuesday": {"open": "08:00", "close": "18:00"}, "wednesday": {"open": "08:00", "close": "18:00"}, "thursday": {"open": "08:00", "close": "18:00"}, "friday": {"open": "08:00", "close": "18:00"}, "saturday": {"open": "08:00", "close": "12:00"}, "sunday": {"open": null, "close": null}}}',
  NOW(),
  NOW()
) ON CONFLICT (slug) DO NOTHING;

-- Create demo user using Supabase Admin API approach (handled by app code)
-- This migration just ensures the clinic exists
-- The user will be created via /api/auth/signup

-- Note: To create the demo user manually, use the signup page at /signup
-- Or use the API:
-- curl -X POST http://localhost:3010/api/auth/signup \
--   -H "Content-Type: application/json" \
--   -d '{"email":"admin@clinicademo.com","password":"demo123","name":"Admin Demo","clinicName":"Clinica Demo"}'