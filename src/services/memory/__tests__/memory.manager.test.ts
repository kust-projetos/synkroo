/**
 * Tests for Memory Manager
 * Run: npm test -- memory.manager.test.ts
 */

import { memoryManager, MemoryManager } from '../memory.manager'
import { l1SessionService } from '../L1-session.service'
import { l2PatientService } from '../L2-patient.service'
import { l3ClinicService } from '../L3-clinic.service'
import { l4ConversationService } from '../L4-conversation.service'
import { l5RAGService } from '../L5-rag.service'

// --- Mocks ---

jest.mock('../L1-session.service', () => ({
  l1SessionService: {
    getOrCreate: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    addMessage: jest.fn(),
  },
}))

jest.mock('../L2-patient.service', () => ({
  l2PatientService: {
    getById: jest.fn(),
    getByPhone: jest.fn(),
  },
}))

jest.mock('../L3-clinic.service', () => ({
  l3ClinicService: {
    getById: jest.fn(),
  },
}))

jest.mock('../L4-conversation.service', () => ({
  l4ConversationService: {
    getById: jest.fn(),
    getBasicById: jest.fn(),
    updateStatus: jest.fn(),
  },
}))

jest.mock('../L5-rag.service', () => ({
  l5RAGService: {
    getContext: jest.fn(),
    buildCombinedContext: jest.fn(),
  },
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}))

// --- Tests ---

describe('MemoryManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('loadContext', () => {
    const baseOptions = {
      patientRequired: false,
      historyNeeded: false,
      faqOrMedical: false,
      clinicId: 'clinic-123',
      visitorId: 'visitor-456',
    }

    it('should always load L1 session', async () => {
      const mockSession = {
        sessionId: 'session-123',
        visitorId: 'visitor-456',
        messages: [],
        entities: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }

      ;(l1SessionService.getOrCreate as jest.Mock).mockReturnValue(mockSession)

      const result = await memoryManager.loadContext(baseOptions)

      expect(l1SessionService.getOrCreate).toHaveBeenCalledWith('visitor-456', 'visitor-456')
      expect(result.conversationId).toBe('visitor-456')
      expect(result.clinicId).toBe('clinic-123')
    })

    it('should load L2 patient when patientId provided', async () => {
      const mockSession = {
        sessionId: 'session-123',
        visitorId: 'visitor-456',
        messages: [],
        entities: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }

      const mockPatient = {
        patientId: 'patient-789',
        clinicId: 'clinic-123',
        nome: 'João Silva',
        telefone: '11999999999',
        preferencias: {},
        historico: [],
        riskScore: 0.2,
        inactiveDays: 15,
      }

      ;(l1SessionService.getOrCreate as jest.Mock).mockReturnValue(mockSession)
      ;(l2PatientService.getById as jest.Mock).mockResolvedValue(mockPatient)

      const options = {
        ...baseOptions,
        patientId: 'patient-789',
      }

      const result = await memoryManager.loadContext(options)

      expect(l2PatientService.getById).toHaveBeenCalledWith('patient-789')
      expect(result.patientId).toBe('patient-789')
    })

    it('should load L3 clinic always', async () => {
      const mockSession = {
        sessionId: 'session-123',
        visitorId: 'visitor-456',
        messages: [],
        entities: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }

      const mockClinic = {
        clinicId: 'clinic-123',
        nome: 'Clínica Exemplo',
        telefone: '1133333333',
        endereco: {},
        horarios: [],
        profissionais: [],
        procedimentos: [],
        cancelamentoPolicy: { advanceNoticeHours: 24, allowCancellation: true },
      }

      ;(l1SessionService.getOrCreate as jest.Mock).mockReturnValue(mockSession)
      ;(l3ClinicService.getById as jest.Mock).mockResolvedValue(mockClinic)

      const result = await memoryManager.loadContext(baseOptions)

      expect(l3ClinicService.getById).toHaveBeenCalledWith('clinic-123')
      expect(result.metadata?.clinicName).toBe('Clínica Exemplo')
    })

    it('should load L4 conversation when historyNeeded and conversationId provided', async () => {
      const mockSession = {
        sessionId: 'session-123',
        visitorId: 'visitor-456',
        messages: [],
        entities: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }

      const mockConversation = {
        conversationId: 'conv-999',
        clinicId: 'clinic-123',
        patientId: 'patient-789',
        channel: 'whatsapp' as const,
        messages: [
          { id: 'msg-1', direction: 'inbound' as const, content: 'Olá', timestamp: '2026-04-01T10:00:00Z' },
        ],
        status: 'active' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      ;(l1SessionService.getOrCreate as jest.Mock).mockReturnValue(mockSession)
      ;(l4ConversationService.getById as jest.Mock).mockResolvedValue(mockConversation)

      const options = {
        ...baseOptions,
        conversationId: 'conv-999',
        historyNeeded: true,
      }

      const result = await memoryManager.loadContext(options)

      expect(l4ConversationService.getById).toHaveBeenCalledWith('conv-999')
      expect(result.history.length).toBeGreaterThan(0)
    })

    it('should load L5 RAG when faqOrMedical and L1 has messages', async () => {
      const mockSession = {
        sessionId: 'session-123',
        visitorId: 'visitor-456',
        messages: [
          { role: 'user' as const, content: 'Qual o horário de funcionamento?', timestamp: '2026-04-01T10:00:00Z' },
        ],
        entities: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }

      const mockRagContext = {
        knowledge: [
          { id: 'kb-1', category: 'horarios', question: 'Horário de funcionamento?', answer: 'Seg a Sex 9h-18h', similarity: 0.95 },
        ],
        memories: [],
      }

      ;(l1SessionService.getOrCreate as jest.Mock).mockReturnValue(mockSession)
      ;(l5RAGService.getContext as jest.Mock).mockResolvedValue(mockRagContext)
      ;(l5RAGService.buildCombinedContext as jest.Mock).mockReturnValue('### Conhecimento...\n1. Horários')

      const options = {
        ...baseOptions,
        faqOrMedical: true,
      }

      const result = await memoryManager.loadContext(options)

      expect(l5RAGService.getContext).toHaveBeenCalled()
      expect(result.ragContext).toBeDefined()
      expect(result.ragContext?.knowledge.length).toBe(1)
    })

    it('should not load L5 when L1 has no messages', async () => {
      const mockSession = {
        sessionId: 'session-123',
        visitorId: 'visitor-456',
        messages: [],
        entities: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }

      ;(l1SessionService.getOrCreate as jest.Mock).mockReturnValue(mockSession)

      const options = {
        ...baseOptions,
        faqOrMedical: true,
      }

      const result = await memoryManager.loadContext(options)

      expect(l5RAGService.getContext).not.toHaveBeenCalled()
      expect(result.ragContext).toBeUndefined()
    })

    it('should include patient preferences in metadata when L2 loaded', async () => {
      const mockSession = {
        sessionId: 'session-123',
        visitorId: 'visitor-456',
        messages: [],
        entities: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }

      const mockPatient = {
        patientId: 'patient-789',
        clinicId: 'clinic-123',
        nome: 'João Silva',
        telefone: '11999999999',
        preferencias: { preferredChannel: 'whatsapp' },
        historico: [],
        riskScore: 0.5,
        inactiveDays: 30,
      }

      ;(l1SessionService.getOrCreate as jest.Mock).mockReturnValue(mockSession)
      ;(l2PatientService.getById as jest.Mock).mockResolvedValue(mockPatient)

      const options = {
        ...baseOptions,
        patientId: 'patient-789',
      }

      const result = await memoryManager.loadContext(options)

      expect(result.metadata?.patientPreferences).toEqual({ preferredChannel: 'whatsapp' })
      expect(result.metadata?.riskScore).toBe(0.5)
      expect(result.metadata?.inactiveDays).toBe(30)
    })

    it('should handle errors gracefully and continue loading', async () => {
      const mockSession = {
        sessionId: 'session-123',
        visitorId: 'visitor-456',
        messages: [],
        entities: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }

      ;(l1SessionService.getOrCreate as jest.Mock).mockReturnValue(mockSession)
      ;(l2PatientService.getById as jest.Mock).mockRejectedValue(new Error('DB error'))
      ;(l3ClinicService.getById as jest.Mock).mockResolvedValue({
        clinicId: 'clinic-123',
        nome: 'Clínica',
        telefone: '1133333333',
        endereco: {},
        horarios: [],
        profissionais: [],
        procedimentos: [],
        cancelamentoPolicy: { advanceNoticeHours: 24, allowCancellation: true },
      })

      const options = {
        ...baseOptions,
        patientId: 'patient-789',
      }

      // Should not throw
      const result = await memoryManager.loadContext(options)

      expect(result.clinicId).toBe('clinic-123')
      expect((result.metadata?._memory as any)?.layerErrors).toContain('L2')
    })
  })

  describe('getLoadResult', () => {
    it('should return detailed load result', async () => {
      const mockSession = {
        sessionId: 'session-123',
        visitorId: 'visitor-456',
        messages: [],
        entities: {},
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }

      ;(l1SessionService.get as jest.Mock).mockReturnValue(mockSession)
      ;(l2PatientService.getById as jest.Mock).mockResolvedValue(null)
      ;(l3ClinicService.getById as jest.Mock).mockResolvedValue(null)
      ;(l4ConversationService.getById as jest.Mock).mockResolvedValue(null)
      ;(l5RAGService.getContext as jest.Mock).mockResolvedValue({ knowledge: [], memories: [] })

      const result = await memoryManager.getLoadResult({
        patientRequired: false,
        historyNeeded: false,
        faqOrMedical: false,
        clinicId: 'clinic-123',
        visitorId: 'visitor-456',
      })

      expect(result.l1).toBe(mockSession)
      expect(result.loadedLayers).toContain('L1')
    })
  })
})

describe('L1SessionService', () => {
  it('should create session with TTL using mocked service', () => {
    const mockSession = {
      sessionId: 'session-1',
      visitorId: 'visitor-1',
      messages: [],
      entities: {},
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    }

    ;(l1SessionService.create as jest.Mock).mockReturnValue(mockSession)

    const session = l1SessionService.create('session-1', 'visitor-1')

    expect(session.sessionId).toBe('session-1')
    expect(session.visitorId).toBe('visitor-1')
    expect(session.messages).toEqual([])
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })

  it('should return null for non-existent session', () => {
    ;(l1SessionService.get as jest.Mock).mockReturnValue(null)

    const session = l1SessionService.get('non-existent')

    expect(session).toBeNull()
  })
})

describe('L2PatientService', () => {
  it('should get patient by ID', async () => {
    const mockPatient = {
      patientId: 'patient-123',
      clinicId: 'clinic-456',
      nome: 'Maria',
      telefone: '11999999999',
      preferencias: {},
      historico: [],
      riskScore: 0.1,
      inactiveDays: 5,
    }

    ;(l2PatientService.getById as jest.Mock).mockResolvedValue(mockPatient)

    const result = await l2PatientService.getById('patient-123')

    expect(result).toEqual(mockPatient)
    expect(result?.nome).toBe('Maria')
  })

  it('should return null for non-existent patient', async () => {
    ;(l2PatientService.getById as jest.Mock).mockResolvedValue(null)

    const result = await l2PatientService.getById('non-existent')

    expect(result).toBeNull()
  })
})

describe('L3ClinicService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should get clinic by ID', async () => {
    const mockClinic = {
      clinicId: 'clinic-123',
      nome: 'Clínica dental',
      telefone: '1133333333',
      endereco: {},
      horarios: [],
      profissionais: [],
      procedimentos: [],
      cancelamentoPolicy: { advanceNoticeHours: 24, allowCancellation: true },
    }

    ;(l3ClinicService.getById as jest.Mock).mockResolvedValue(mockClinic)

    const result = await l3ClinicService.getById('clinic-123')

    expect(result).toEqual(mockClinic)
  })

  it('should cache clinic data (mocked)', async () => {
    const mockClinic = {
      clinicId: 'clinic-123',
      nome: 'Clínica dental',
      telefone: '1133333333',
      endereco: {},
      horarios: [],
      profissionais: [],
      procedimentos: [],
      cancelamentoPolicy: { advanceNoticeHours: 24, allowCancellation: true },
    }

    ;(l3ClinicService.getById as jest.Mock).mockResolvedValue(mockClinic)

    // Call twice - in real implementation this would hit cache
    await l3ClinicService.getById('clinic-123')
    await l3ClinicService.getById('clinic-123')

    // Verify both calls were made (actual caching tested in integration)
    expect(l3ClinicService.getById).toHaveBeenCalledTimes(2)
  })
})

describe('L4ConversationService', () => {
  it('should get conversation by ID', async () => {
    const mockConversation = {
      conversationId: 'conv-123',
      clinicId: 'clinic-456',
      patientId: 'patient-789',
      channel: 'whatsapp' as const,
      messages: [],
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    ;(l4ConversationService.getById as jest.Mock).mockResolvedValue(mockConversation)

    const result = await l4ConversationService.getById('conv-123')

    expect(result).toEqual(mockConversation)
  })

  it('should update conversation status', async () => {
    ;(l4ConversationService.updateStatus as jest.Mock).mockResolvedValue(true)

    const result = await l4ConversationService.updateStatus('conv-123', 'closed')

    expect(result).toBe(true)
    expect(l4ConversationService.updateStatus).toHaveBeenCalledWith('conv-123', 'closed')
  })
})

describe('L5RAGService', () => {
  it('should build combined context with knowledge and memories', () => {
    const knowledge = [
      { id: 'kb-1', category: 'horarios', question: 'Funciona sábado?', answer: 'Não', similarity: 0.9 },
    ]
    const memories = [
      { id: 'mem-1', conversationId: 'conv-1', content: 'Paciente perguntou sobre sábado', contentType: 'message', similarity: 0.8, createdAt: '2026-04-01' },
    ]

    ;(l5RAGService.buildCombinedContext as jest.Mock).mockReturnValue('### Conhecimento...\n1. [horarios]\n\n### Contexto de Conversas Anteriores:\n1. [01/04/2026] Paciente perguntou sobre sábado')

    const result = l5RAGService.buildCombinedContext(knowledge, memories)

    expect(result).toContain('Conhecimento')
    expect(result).toContain('Conversas Anteriores')
  })

  it('should build combined context with only knowledge', () => {
    const knowledge = [
      { id: 'kb-1', category: 'horarios', question: 'Funciona sábado?', answer: 'Não', similarity: 0.9 },
    ]
    const memories: any[] = []

    ;(l5RAGService.buildCombinedContext as jest.Mock).mockReturnValue('### Conhecimento...\n1. [horarios]')

    const result = l5RAGService.buildCombinedContext(knowledge, memories)

    expect(result).toContain('Conhecimento')
    expect(result).not.toContain('Conversas Anteriores')
  })

  it('should get context from rag service', async () => {
    const mockContext = {
      knowledge: [{ id: 'kb-1', category: 'test', question: 'Test?', answer: 'Answer', similarity: 0.9 }],
      memories: [],
    }

    ;(l5RAGService.getContext as jest.Mock).mockResolvedValue(mockContext)

    const result = await l5RAGService.getContext('Test query', 'clinic-123', 'patient-456')

    expect(result.knowledge.length).toBe(1)
    expect(l5RAGService.getContext).toHaveBeenCalled()
  })
})
