/**
 * Message Templates Service Tests
 */

import {
  getApprovedTemplates,
  getAllTemplates,
  createTemplate,
  fillTemplate,
  isTemplateNeeded,
  getTemplateByName,
  type MessageTemplate,
} from '../message-templates.service'

jest.mock('@/lib/supabase/typed', () => ({
  createTypedClient: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('MessageTemplates Service', () => {
  const mockClient = {
    from: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
    const { createTypedClient } = require('@/lib/supabase/typed')
    createTypedClient.mockResolvedValue(mockClient)
  })

  function createChain(finalResult: any): any {
    const c: any = {
      then(resolve?: (v: any) => any) {
        return resolve?.(finalResult)
      },
    }
    const methods = [
      'insert',
      'select',
      'update',
      'delete',
      'eq',
      'neq',
      'gte',
      'lte',
      'order',
      'limit',
      'single',
      'upsert',
    ]
    for (const m of methods) {
      if (m === 'single') {
        c[m] = jest.fn(() => Promise.resolve(finalResult))
      } else {
        c[m] = jest.fn(() => c)
      }
    }
    return c
  }

  const mockTemplate: MessageTemplate = {
    id: 'tpl-123',
    clinic_id: 'clinic-1',
    name: 'appointment_reminder',
    category: 'UTILITY',
    language: 'pt_BR',
    header: 'Lembrete de Consulta',
    body: 'Olá {{1}}, sua consulta é às {{2}}',
    footer: 'Respondendo: Clínica Sorriso',
    buttons: [
      { type: 'QUICK_REPLY', text: 'Confirmar' },
      { type: 'QUICK_REPLY', text: 'Remarcar' },
    ],
    status: 'APPROVED',
    meta_template_id: 'meta-123',
    created_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T10:00:00Z',
  }

  describe('getApprovedTemplates', () => {
    it('should return approved templates ordered by category', async () => {
      const templates = [mockTemplate, { ...mockTemplate, id: 'tpl-456', category: 'MARKETING' }]
      mockClient.from.mockReturnValue(createChain({ data: templates, error: null }))

      const result = await getApprovedTemplates('clinic-1')

      expect(mockClient.from).toHaveBeenCalledWith('message_templates')
      expect(result).toEqual(templates)
    })

    it('should return empty array on error', async () => {
      mockClient.from.mockReturnValue(createChain({ data: null, error: new Error('DB error') }))

      const result = await getApprovedTemplates('clinic-1')

      expect(result).toEqual([])
    })

    it('should filter by clinic_id and status APPROVED', async () => {
      const chain = createChain({ data: [mockTemplate], error: null })
      mockClient.from.mockReturnValue(chain)

      await getApprovedTemplates('clinic-1')

      expect(chain.eq).toHaveBeenCalledWith('clinic_id', 'clinic-1')
      expect(chain.eq).toHaveBeenCalledWith('status', 'APPROVED')
      expect(chain.order).toHaveBeenCalledWith('category', { ascending: true })
    })
  })

  describe('getAllTemplates', () => {
    it('should return all templates ordered by created_at desc', async () => {
      const templates = [
        mockTemplate,
        { ...mockTemplate, id: 'tpl-456', status: 'PENDING', created_at: '2026-03-31T10:00:00Z' },
      ]
      mockClient.from.mockReturnValue(createChain({ data: templates, error: null }))

      const result = await getAllTemplates('clinic-1')

      expect(result).toEqual(templates)
    })

    it('should return empty array on error', async () => {
      mockClient.from.mockReturnValue(createChain({ data: null, error: new Error('DB error') }))

      const result = await getAllTemplates('clinic-1')

      expect(result).toEqual([])
    })

    it('should order by created_at descending', async () => {
      const chain = createChain({ data: [], error: null })
      mockClient.from.mockReturnValue(chain)

      await getAllTemplates('clinic-1')

      expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false })
    })
  })

  describe('createTemplate', () => {
    it('should create template with PENDING status and pt_BR language', async () => {
      const params = {
        clinicId: 'clinic-1',
        name: 'new_template',
        category: 'MARKETING' as const,
        body: 'Hello {{1}}',
      }

      mockClient.from.mockReturnValue(
        createChain({ data: { ...mockTemplate, ...params, status: 'PENDING', language: 'pt_BR' }, error: null })
      )

      const result = await createTemplate(params)

      expect(result).toMatchObject({
        name: 'new_template',
        category: 'MARKETING',
        status: 'PENDING',
        language: 'pt_BR',
      })
    })

    it('should return null on error', async () => {
      const params = {
        clinicId: 'clinic-1',
        name: 'fail_template',
        category: 'UTILITY' as const,
        body: 'Test',
      }

      mockClient.from.mockReturnValue(createChain({ data: null, error: new Error('Insert failed') }))

      const result = await createTemplate(params)

      expect(result).toBeNull()
    })

    it('should include optional fields when provided', async () => {
      const params = {
        clinicId: 'clinic-1',
        name: 'full_template',
        category: 'UTILITY' as const,
        body: 'Body text',
        header: 'Header text',
        footer: 'Footer text',
        buttons: [{ type: 'QUICK_REPLY' as const, text: 'OK' }],
      }

      const chain = createChain({ data: { ...mockTemplate, ...params }, error: null })
      mockClient.from.mockReturnValue(chain)

      await createTemplate(params)

      const insertCall = chain.insert.mock.calls[0][0]
      expect(insertCall).toMatchObject({
        header: 'Header text',
        footer: 'Footer text',
        buttons: [{ type: 'QUICK_REPLY', text: 'OK' }],
      })
    })
  })

  describe('fillTemplate', () => {
    it('should replace numbered placeholders with array values', () => {
      const template = {
        ...mockTemplate,
        body: 'Olá {{1}}, sua consulta é às {{2}}',
      }

      const result = fillTemplate(template, { '1': 'João', '2': '14:00' })

      expect(result).toBe('Olá João, sua consulta é às 14:00')
    })

    it('should replace named placeholders', () => {
      const template = {
        ...mockTemplate,
        body: 'Olá {{nome}}, seu aparelho é {{modelo}}',
      }

      const result = fillTemplate(template, { nome: 'Maria', modelo: 'Invisalign' })

      expect(result).toBe('Olá Maria, seu aparelho é Invisalign')
    })

    it('should keep placeholder when value is missing', () => {
      const template = {
        ...mockTemplate,
        body: 'Olá {{1}}, sua consulta é às {{2}}',
      }

      const result = fillTemplate(template, { '1': 'João' })

      expect(result).toBe('Olá João, sua consulta é às {{2}}')
    })

    it('should handle mixed numbered and named placeholders', () => {
      const template = {
        ...mockTemplate,
        body: '{{1}}, seu appt é {{2}} na clínica {{nome}}',
      }

      const result = fillTemplate(template, { '1': 'Carlos', '2': '15:30', nome: 'Sorriso' })

      expect(result).toBe('Carlos, seu appt é 15:30 na clínica Sorriso')
    })

    it('should replace all occurrences of named placeholder', () => {
      const template = {
        ...mockTemplate,
        body: 'Olá {{nome}}, {{nome}}! Sua consulta {{nome}} está confirmada.',
      }

      const result = fillTemplate(template, { nome: 'Ana' })

      expect(result).toBe('Olá Ana, Ana! Sua consulta Ana está confirmada.')
    })

    it('should handle template with no placeholders', () => {
      const template = {
        ...mockTemplate,
        body: 'Mensagem simples sem placeholders',
      }

      const result = fillTemplate(template, {})

      expect(result).toBe('Mensagem simples sem placeholders')
    })
  })

  describe('isTemplateNeeded', () => {
    it('should return true when lastMessageAt is null', () => {
      expect(isTemplateNeeded(null)).toBe(true)
    })

    it('should return true when last message was more than 24 hours ago', () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      expect(isTemplateNeeded(twentyFiveHoursAgo)).toBe(true)
    })

    it('should return false when last message was less than 24 hours ago', () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      expect(isTemplateNeeded(oneHourAgo)).toBe(false)
    })

    it('should return true when last message was 25 hours ago', () => {
      const twentyFiveHoursAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString()
      expect(isTemplateNeeded(twentyFiveHoursAgo)).toBe(true)
    })

    it('should return false for messages sent just now', () => {
      const now = new Date().toISOString()
      expect(isTemplateNeeded(now)).toBe(false)
    })
  })

  describe('getTemplateByName', () => {
    it('should return template by name and clinic_id with APPROVED status', async () => {
      mockClient.from.mockReturnValue(createChain({ data: mockTemplate, error: null }))

      const result = await getTemplateByName('clinic-1', 'appointment_reminder')

      expect(result).toEqual(mockTemplate)
      expect(mockClient.from).toHaveBeenCalledWith('message_templates')
    })

    it('should return null when template not found', async () => {
      mockClient.from.mockReturnValue(
        createChain({ data: null, error: { message: 'No rows found' } })
      )

      const result = await getTemplateByName('clinic-1', 'nonexistent')

      expect(result).toBeNull()
    })

    it('should return null on database error', async () => {
      mockClient.from.mockImplementation(() => {
        throw new Error('Connection error')
      })

      const result = await getTemplateByName('clinic-1', 'any_template')

      expect(result).toBeNull()
    })
  })
})
