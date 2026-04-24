/**
 * Unified Contacts Service
 * Queries across patients and leads tables with unified interface
 */

import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'
import type {
  Contact,
  ContactType,
  ContactListParams,
  ContactCreateInput,
  ContactUpdateInput,
  ContactNote,
  ContactListResponse,
} from './types'

/**
 * Search contacts across patients and leads
 */
export async function searchContacts(
  clinicId: string,
  params: ContactListParams = {}
): Promise<ContactListResponse> {
  const supabase = await createTypedClient()
  const { search, type = 'all', tags, status, page = 1, limit = 20 } = params

  const offset = (page - 1) * limit
  let total = 0
  let contacts: Contact[] = []

  try {
    if (type === 'patient' || type === 'all') {
      let query = supabase
        .from('patients')
        .select('*', { count: 'exact' })
        .eq('clinic_id', clinicId)

      if (search) {
        query = query.or(
          `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%,cpf.ilike.%${search}%`
        )
      }

      if (status) {
        query = query.eq('status', status)
      }

      if (tags && tags.length > 0) {
        query = query.contains('tags', tags)
      }

      const { data: patients, error } = await query
        .range(offset, offset + limit - 1)

      if (error) throw error

      const patientContacts: Contact[] = (patients || []).map((p: any) => ({
        id: p.id,
        type: 'patient' as ContactType,
        clinic_id: p.clinic_id,
        name: p.name,
        phone: p.phone || '',
        email: p.email || null,
        cpf: p.cpf || null,
        birth_date: p.birth_date || null,
        tags: p.tags || [],
        status: p.status || 'active',
        notes: p.notes || null,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }))

      contacts = [...contacts, ...patientContacts]
      total += patients?.length || 0
    }

    if (type === 'lead' || type === 'all') {
      let query = supabase
        .from('leads')
        .select('*', { count: 'exact' })
        .eq('clinic_id', clinicId)

      if (search) {
        query = query.or(
          `name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
        )
      }

      if (status) {
        query = query.eq('status', status)
      }

      if (tags && tags.length > 0) {
        query = query.contains('tags', tags)
      }

      const { data: leads, error } = await query
        .range(offset, offset + limit - 1)

      if (error) throw error

      const leadContacts: Contact[] = (leads || []).map((l: any) => ({
        id: l.id,
        type: 'lead' as ContactType,
        clinic_id: l.clinic_id,
        name: l.name,
        phone: l.phone || '',
        email: l.email || null,
        cpf: null,
        birth_date: null,
        tags: l.tags || [],
        status: l.status || 'new',
        stage_id: l.stage_id || null,
        score: l.score || null,
        temperature: l.temperature || null,
        source: l.source || null,
        interest: l.interest || null,
        patient_id: l.patient_id || null,
        notes: l.notes || null,
        created_at: l.created_at,
        updated_at: l.updated_at,
      }))

      contacts = [...contacts, ...leadContacts]
      total += leads?.length || 0
    }

    contacts.sort((a, b) =>
      new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    )

    return {
      data: contacts.slice(0, limit),
      total,
      page,
      limit,
    }
  } catch (error) {
    dbLogger.error('Error searching contacts', error)
    throw error
  }
}

/**
 * Get contact by ID and type
 */
export async function getContactById(
  clinicId: string,
  contactId: string,
  contactType: ContactType
): Promise<Contact | null> {
  const supabase = await createTypedClient()

  try {
    if (contactType === 'patient') {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', contactId)
        .eq('clinic_id', clinicId)
        .single()

      if (error) return null

      const p = data as any
      return {
        id: p.id,
        type: 'patient',
        clinic_id: p.clinic_id,
        name: p.name,
        phone: p.phone || '',
        email: p.email || null,
        cpf: p.cpf || null,
        birth_date: p.birth_date || null,
        tags: p.tags || [],
        status: p.status || 'active',
        notes: p.notes || null,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }
    } else {
      const { data, error } = await supabase
        .from('leads')
        .select(`
          *,
          pipeline_stages (id, name, color)
        `)
        .eq('id', contactId)
        .eq('clinic_id', clinicId)
        .single()

      if (error) return null

      const l = data as any
      return {
        id: l.id,
        type: 'lead',
        clinic_id: l.clinic_id,
        name: l.name,
        phone: l.phone || '',
        email: l.email || null,
        cpf: null,
        birth_date: null,
        tags: l.tags || [],
        status: l.status || 'new',
        stage_id: l.stage_id || null,
        score: l.score || null,
        temperature: l.temperature || null,
        source: l.source || null,
        interest: l.interest || null,
        patient_id: l.patient_id || null,
        notes: l.notes || null,
        created_at: l.created_at,
        updated_at: l.updated_at,
      }
    }
  } catch (error) {
    dbLogger.error('Error getting contact by ID', error)
    return null
  }
}

/**
 * Create a new contact (patient or lead)
 */
export async function createContact(
  clinicId: string,
  input: ContactCreateInput
): Promise<Contact> {
  const supabase = await createTypedClient()

  if (!input.name || !input.phone) {
    throw new Error('Name and phone are required')
  }

  try {
    if (input.type === 'patient') {
      const { data, error } = await (supabase
        .from('patients') as any)
        .insert({
          clinic_id: clinicId,
          name: input.name,
          phone: input.phone,
          email: input.email || null,
          cpf: input.cpf || null,
          birth_date: input.birth_date || null,
          tags: input.tags || [],
          notes: input.notes || null,
          status: 'active',
        })
        .select()
        .single()

      if (error) throw error

      const p = data as any
      return {
        id: p.id,
        type: 'patient',
        clinic_id: p.clinic_id,
        name: p.name,
        phone: p.phone || '',
        email: p.email || null,
        cpf: p.cpf || null,
        birth_date: p.birth_date || null,
        tags: p.tags || [],
        status: p.status || 'active',
        notes: p.notes || null,
        created_at: p.created_at,
        updated_at: p.updated_at,
      }
    } else {
      const { data: defaultStage } = await (supabase
        .from('pipeline_stages') as any)
        .select('id')
        .eq('clinic_id', clinicId)
        .eq('system_key', 'new')
        .single()

      const { data, error } = await (supabase
        .from('leads') as any)
        .insert({
          clinic_id: clinicId,
          name: input.name,
          phone: input.phone,
          email: input.email || null,
          source: input.source || null,
          interest: input.interest || null,
          tags: input.tags || [],
          notes: input.notes || null,
          status: 'new',
          stage_id: defaultStage?.id || null,
        })
        .select()
        .single()

      if (error) throw error

      const l = data as any
      return {
        id: l.id,
        type: 'lead',
        clinic_id: l.clinic_id,
        name: l.name,
        phone: l.phone || '',
        email: l.email || null,
        cpf: null,
        birth_date: null,
        tags: l.tags || [],
        status: l.status || 'new',
        stage_id: l.stage_id || null,
        score: l.score || null,
        temperature: l.temperature || null,
        source: l.source || null,
        interest: l.interest || null,
        patient_id: l.patient_id || null,
        notes: l.notes || null,
        created_at: l.created_at,
        updated_at: l.updated_at,
      }
    }
  } catch (error) {
    dbLogger.error('Error creating contact', error)
    throw error
  }
}

/**
 * Update an existing contact
 */
export async function updateContact(
  clinicId: string,
  contactId: string,
  contactType: ContactType,
  input: ContactUpdateInput
): Promise<Contact> {
  const supabase = await createTypedClient()

  try {
    const updateData: Record<string, unknown> = {}
    if (input.name !== undefined) updateData.name = input.name
    if (input.phone !== undefined) updateData.phone = input.phone
    if (input.email !== undefined) updateData.email = input.email
    if (input.cpf !== undefined) updateData.cpf = input.cpf
    if (input.birth_date !== undefined) updateData.birth_date = input.birth_date
    if (input.tags !== undefined) updateData.tags = input.tags
    if (input.notes !== undefined) updateData.notes = input.notes
    if (input.status !== undefined) updateData.status = input.status
    if (input.interest !== undefined) updateData.interest = input.interest
    if (input.score !== undefined) updateData.score = input.score
    if (input.temperature !== undefined) updateData.temperature = input.temperature

    updateData.updated_at = new Date().toISOString()

    const table = contactType === 'patient' ? 'patients' : 'leads'

    const { data, error } = await (supabase
      .from(table) as any)
      .update(updateData)
      .eq('id', contactId)
      .eq('clinic_id', clinicId)
      .select()
      .single()

    if (error) throw error

    const d = data as any
    return {
      id: d.id,
      type: contactType,
      clinic_id: d.clinic_id,
      name: d.name,
      phone: d.phone || '',
      email: d.email || null,
      cpf: d.cpf || null,
      birth_date: d.birth_date || null,
      tags: d.tags || [],
      status: d.status || '',
      notes: d.notes || null,
      created_at: d.created_at,
      updated_at: d.updated_at,
    }
  } catch (error) {
    dbLogger.error('Error updating contact', error)
    throw error
  }
}

/**
 * Archive a contact
 */
export async function archiveContact(
  clinicId: string,
  contactId: string,
  contactType: ContactType
): Promise<Contact> {
  return updateContact(clinicId, contactId, contactType, { status: 'archived' })
}

/**
 * Get notes for a contact
 */
export async function getContactNotes(
  clinicId: string,
  contactId: string,
  contactType: ContactType
): Promise<ContactNote[]> {
  const supabase = await createTypedClient()

  try {
    if (contactType === 'lead') {
      const { data, error } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('lead_id', contactId)
        .eq('activity_type', 'note')
        .order('performed_at', { ascending: false })

      if (error) throw error

      return (data || []).map((a: any) => ({
        id: a.id,
        contact_id: a.lead_id,
        contact_type: 'lead' as ContactType,
        content: a.description || '',
        created_at: a.performed_at,
        created_by: a.performed_by || undefined,
      }))
    } else {
      const { data, error } = await supabase
        .from('patient_observations')
        .select('*')
        .eq('patient_id', contactId)
        .eq('clinic_id', clinicId)
        .order('created_at', { ascending: false })

      if (error) throw error

      return (data || []).map((o: any) => ({
        id: o.id,
        contact_id: o.patient_id,
        contact_type: 'patient' as ContactType,
        content: o.content || '',
        created_at: o.created_at,
        created_by: o.created_by || undefined,
      }))
    }
  } catch (error) {
    dbLogger.error('Error getting contact notes', error)
    throw error
  }
}

/**
 * Add a note to a contact
 */
export async function addContactNote(
  clinicId: string,
  contactId: string,
  contactType: ContactType,
  content: string
): Promise<ContactNote> {
  const supabase = await createTypedClient()
  const { data: { user } } = await supabase.auth.getUser()

  try {
    if (contactType === 'lead') {
      const { data, error } = await (supabase
        .from('lead_activities') as any)
        .insert({
          lead_id: contactId,
          activity_type: 'note',
          description: content,
          performed_at: new Date().toISOString(),
          performed_by: user?.id,
        })
        .select()
        .single()

      if (error) throw error

      const a = data as any
      return {
        id: a.id,
        contact_id: a.lead_id,
        contact_type: 'lead',
        content: a.description || '',
        created_at: a.performed_at,
        created_by: a.performed_by || undefined,
      }
    } else {
      const { data, error } = await (supabase
        .from('patient_observations') as any)
        .insert({
          clinic_id: clinicId,
          patient_id: contactId,
          content,
          created_by: user?.id,
        })
        .select()
        .single()

      if (error) throw error

      const o = data as any
      return {
        id: o.id,
        contact_id: o.patient_id,
        contact_type: 'patient',
        content: o.content || '',
        created_at: o.created_at,
        created_by: o.created_by || undefined,
      }
    }
  } catch (error) {
    dbLogger.error('Error adding contact note', error)
    throw error
  }
}