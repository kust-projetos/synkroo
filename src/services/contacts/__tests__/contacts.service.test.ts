/**
 * Tests for Contacts Service
 */

import {
  searchContacts,
  getContactById,
  createContact,
  updateContact,
  archiveContact,
  getContactNotes,
  addContactNote,
} from '@/services/contacts/contacts.service'

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { error: jest.fn(), info: jest.fn() },
}))

const mockSupabase = {
  from: jest.fn(),
  auth: { getUser: jest.fn() },
}

beforeEach(() => {
  jest.clearAllMocks()
  require('@/lib/supabase/typed').createTypedClient.mockReturnValue(mockSupabase)
})

describe('Contacts Service', () => {
  const clinicId = 'clinic-123'

  describe('searchContacts', () => {
    it('should search contacts across patients and leads', async () => {
      const mockPatients = [
        { id: 'p1', name: 'João', phone: '11999999999', clinic_id: clinicId, status: 'active', tags: [], created_at: '2024-01-01', updated_at: '2024-01-01' },
      ]
      const mockLeads = [
        { id: 'l1', name: 'Maria', phone: '11888888888', clinic_id: clinicId, status: 'new', tags: [], created_at: '2024-01-02', updated_at: '2024-01-02' },
      ]

      mockSupabase.from
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              or: () => ({
                range: jest.fn().mockResolvedValue({ data: mockPatients, error: null, count: 1 }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              or: () => ({
                range: jest.fn().mockResolvedValue({ data: mockLeads, error: null, count: 1 }),
              }),
            }),
          }),
        })

      const result = await searchContacts(clinicId, { search: 'João' })

      expect(result.data.length).toBe(2)
    })

    it('should search patients only with search term', async () => {
      const mockPatients = [
        { id: 'p1', name: 'João', phone: '11999999999', clinic_id: clinicId, status: 'active', tags: [], created_at: '2024-01-01', updated_at: '2024-01-01' },
      ]

      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            or: () => ({
              range: jest.fn().mockResolvedValue({ data: mockPatients, error: null, count: 1 }),
            }),
          }),
        }),
      })

      const result = await searchContacts(clinicId, { type: 'patient', search: 'João' })

      expect(result.data.length).toBe(1)
      expect(result.data[0].type).toBe('patient')
    })
  })

  describe('getContactById', () => {
    it('should get patient by id', async () => {
      const mockPatient = {
        id: 'p1', name: 'João Silva', phone: '11999999999', clinic_id: clinicId, status: 'active', tags: [], created_at: '2024-01-01', updated_at: '2024-01-01',
      }

      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: jest.fn().mockResolvedValue({ data: mockPatient, error: null }),
            }),
          }),
        }),
      })

      const result = await getContactById(clinicId, 'p1', 'patient')

      expect(result).not.toBeNull()
      expect(result?.name).toBe('João Silva')
    })

    it('should return null on error', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      })

      const result = await getContactById(clinicId, 'nonexistent', 'patient')

      expect(result).toBeNull()
    })
  })

  describe('createContact', () => {
    it('should create a patient contact', async () => {
      const mockCreated = {
        id: 'p-new', name: 'Novo Patient', phone: '11999999999', email: 'novo@example.com', clinic_id: clinicId, status: 'active', tags: [], created_at: '2024-01-01', updated_at: '2024-01-01',
      }

      mockSupabase.from.mockReturnValue({
        insert: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({ data: mockCreated, error: null }),
          }),
        }),
      })

      const result = await createContact(clinicId, { type: 'patient', name: 'Novo Patient', phone: '11999999999' })

      expect(result).not.toBeNull()
      expect(result.name).toBe('Novo Patient')
    })

    it('should throw if name or phone missing', async () => {
      await expect(createContact(clinicId, { type: 'patient', name: '', phone: '' })).rejects.toThrow('Name and phone are required')
    })
  })

  describe('updateContact', () => {
    it('should update a patient contact', async () => {
      const mockUpdated = {
        id: 'p1', name: 'João Updated', phone: '11999999999', clinic_id: clinicId, status: 'active', tags: [], created_at: '2024-01-01', updated_at: '2024-01-02',
      }

      mockSupabase.from.mockReturnValue({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: jest.fn().mockResolvedValue({ data: mockUpdated, error: null }),
              }),
            }),
          }),
        }),
      })

      const result = await updateContact(clinicId, 'p1', 'patient', { name: 'João Updated' })

      expect(result).not.toBeNull()
      expect(result.name).toBe('João Updated')
    })
  })

  describe('archiveContact', () => {
    it('should archive a contact', async () => {
      const mockArchived = {
        id: 'p1', name: 'João', phone: '11999999999', clinic_id: clinicId, status: 'archived', tags: [], created_at: '2024-01-01', updated_at: '2024-01-02',
      }

      mockSupabase.from.mockReturnValue({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: jest.fn().mockResolvedValue({ data: mockArchived, error: null }),
              }),
            }),
          }),
        }),
      })

      const result = await archiveContact(clinicId, 'p1', 'patient')

      expect(result.status).toBe('archived')
    })
  })

  describe('getContactNotes', () => {
    it('should get notes for a lead', async () => {
      const mockActivities = [
        { id: 'a1', lead_id: 'l1', activity_type: 'note', description: 'Nota 1', performed_at: '2024-01-01' },
        { id: 'a2', lead_id: 'l1', activity_type: 'note', description: 'Nota 2', performed_at: '2024-01-02' },
      ]

      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: jest.fn().mockResolvedValue({ data: mockActivities, error: null }),
            }),
          }),
        }),
      })

      const result = await getContactNotes(clinicId, 'l1', 'lead')

      expect(result).toHaveLength(2)
    })
  })

  describe('addContactNote', () => {
    it('should add a note to a lead', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })

      const mockActivity = {
        id: 'a-new', lead_id: 'l1', activity_type: 'note', description: 'Nova nota', performed_at: '2024-01-03', performed_by: 'user-1',
      }

      mockSupabase.from.mockReturnValue({
        insert: () => ({
          select: () => ({
            single: jest.fn().mockResolvedValue({ data: mockActivity, error: null }),
          }),
        }),
      })

      const result = await addContactNote(clinicId, 'l1', 'lead', 'Nova nota')

      expect(result).not.toBeNull()
      expect(result.content).toBe('Nova nota')
    })
  })
})
