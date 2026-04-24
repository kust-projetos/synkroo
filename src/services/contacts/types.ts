/**
 * Unified Contact Types
 * Combines patients and leads into a single contact interface
 */

export type ContactType = 'patient' | 'lead'

export interface Contact {
  id: string
  type: ContactType
  clinic_id: string
  name: string
  phone: string
  email: string | null
  cpf: string | null
  birth_date: string | null
  tags: string[]
  status: string
  stage_id?: string | null
  score?: number
  temperature?: string
  source?: string
  interest?: string | null
  patient_id?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
}

export interface ContactListParams {
  search?: string
  type?: 'all' | 'patient' | 'lead'
  tags?: string[]
  status?: string
  page?: number
  limit?: number
}

export interface ContactCreateInput {
  type: ContactType
  name: string
  phone: string
  email?: string
  cpf?: string
  birth_date?: string
  tags?: string[]
  notes?: string
  source?: string
  interest?: string
}

export interface ContactUpdateInput {
  name?: string
  phone?: string
  email?: string | null
  cpf?: string | null
  birth_date?: string | null
  tags?: string[]
  notes?: string | null
  status?: string
  interest?: string | null
  score?: number
  temperature?: string
}

export interface ContactNote {
  id: string
  contact_id: string
  contact_type: ContactType
  content: string
  created_at: string
  created_by?: string
}

export interface ContactListResponse {
  data: Contact[]
  total: number
  page: number
  limit: number
}