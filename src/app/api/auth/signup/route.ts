import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { signupSchema } from '@/lib/validations'

interface SignupRequest {
  email: string
  password: string
  name: string
  clinicName: string
}

/**
 * POST /api/auth/signup
 * Register a new user and create their clinic
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json()
    const { email, password, name, clinicName } = signupSchema.parse(rawBody)

    // 1. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name,
      },
    })

    if (authError) {
      console.error('Auth error:', authError)
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      )
    }

    const userId = authData.user.id

    // 2. Generate a slug from clinic name
    const slug = clinicName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove accents
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    // 3. Create clinic
    const { data: clinic, error: clinicError } = await (supabaseAdmin as any)
      .from('clinics')
      .insert({
        name: clinicName,
        slug,
        phone: '',
        email,
        settings: {
          business_hours: {
            monday: { open: '08:00', close: '18:00' },
            tuesday: { open: '08:00', close: '18:00' },
            wednesday: { open: '08:00', close: '18:00' },
            thursday: { open: '08:00', close: '18:00' },
            friday: { open: '08:00', close: '18:00' },
            saturday: { open: '08:00', close: '12:00' },
            sunday: { open: null, close: null },
          },
          ai_settings: {
            auto_response: true,
            escalation_enabled: true,
            business_name: clinicName,
          },
        },
      })
      .select()
      .single()

    if (clinicError) {
      console.error('Clinic error:', clinicError)
      // Rollback: delete auth user
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Failed to create clinic' },
        { status: 500 }
      )
    }

    // 4. Create user profile
    const { data: profile, error: profileError } = await (supabaseAdmin as any)
      .from('users')
      .insert({
        id: userId,
        clinic_id: clinic.id,
        email,
        name,
        role: 'owner',
        is_active: true,
      })
      .select(`
        id,
        email,
        name,
        role,
        phone,
        avatar_url,
        is_active,
        clinic_id,
        clinics (
          id,
          name,
          slug,
          phone,
          email,
          settings
        )
      `)
      .single()

    if (profileError) {
      console.error('Profile error:', profileError)
      // Rollback: delete clinic and auth user
      await (supabaseAdmin as any).from('clinics').delete().eq('id', clinic.id)
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json(
        { error: 'Failed to create user profile' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authData.user.id,
        email: authData.user.email,
      },
      profile,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      )
    }
    console.error('Signup error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}