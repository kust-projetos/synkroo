/**
 * Consent Service
 * LGPD-compliant consent management with automatic audit logging
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'

export type ConsentPurpose = 'data_collection' | 'marketing' | 'whatsapp_communication'
export type ConsentChannel = 'web' | 'whatsapp' | 'manual'

export interface Consent {
  id: string
  clinic_id: string
  contact_id: string
  contact_type: 'patient' | 'lead'
  purpose: ConsentPurpose
  granted: boolean
  granted_at: string | null
  revoked_at: string | null
  channel: ConsentChannel | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ConsentGrantInput {
  contact_id: string
  contact_type: 'patient' | 'lead'
  purpose: ConsentPurpose
  channel?: ConsentChannel
  notes?: string
}

/**
 * Get all consents for a contact
 */
export async function getConsentsForContact(
  clinicId: string,
  contactId: string,
  contactType: 'patient' | 'lead'
): Promise<Consent[]> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await supabase
      .from('consents')
      .select('*')
      .eq('contact_id', contactId)
      .eq('contact_type', contactType)
      .eq('clinic_id', clinicId)

    if (error) throw error
    return data || []
  } catch (error) {
    dbLogger.error('Error getting consents for contact', error)
    throw error
  }
}

/**
 * Grant consent for a contact
 * Uses upsert to handle idempotency - audit trigger logs automatically
 */
export async function grantConsent(
  clinicId: string,
  input: ConsentGrantInput
): Promise<Consent> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await (supabase
      .from('consents') as any)
      .upsert({
        clinic_id: clinicId,
        contact_id: input.contact_id,
        contact_type: input.contact_type,
        purpose: input.purpose,
        granted: true,
        granted_at: new Date().toISOString(),
        revoked_at: null,
        channel: input.channel || 'web',
        notes: input.notes || null,
      }, {
        onConflict: 'contact_id,contact_type,purpose',
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    dbLogger.error('Error granting consent', error)
    throw error
  }
}

/**
 * Revoke consent for a contact
 * Audit trigger logs automatically via log_consent_change()
 */
export async function revokeConsent(
  clinicId: string,
  contactId: string,
  contactType: 'patient' | 'lead',
  purpose: ConsentPurpose,
  channel?: ConsentChannel,
  notes?: string
): Promise<Consent> {
  const supabase = await createTypedClient()

  try {
    const { data, error } = await (supabase
      .from('consents') as any)
      .update({
        granted: false,
        revoked_at: new Date().toISOString(),
        channel: channel || 'web',
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('contact_id', contactId)
      .eq('contact_type', contactType)
      .eq('clinic_id', clinicId)
      .eq('purpose', purpose)
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    dbLogger.error('Error revoking consent', error)
    throw error
  }
}