import {
  createTreatmentPlan,
  deleteTreatmentPlan,
  getTreatmentPlanById,
  getTreatmentPlanProgress,
  getTreatmentPlansByPatient,
  updateSessionProgress,
  updateTreatmentPlan,
} from '../treatment-plan.service'
import {
  createWithItems,
  deleteTreatmentPlan as deleteTreatmentPlanDb,
  findById,
  findByPatient,
  getProgress,
  update,
  updateItem,
} from '@/repositories/treatment-plans'

jest.mock('@/repositories/treatment-plans', () => ({
  createWithItems: jest.fn(),
  deleteTreatmentPlan: jest.fn(),
  findById: jest.fn(),
  findByPatient: jest.fn(),
  getProgress: jest.fn(),
  update: jest.fn(),
  updateItem: jest.fn(),
}))

jest.mock('@/lib/logger', () => ({
  dbLogger: { error: jest.fn() },
}))

const mockCreateWithItems = createWithItems as jest.MockedFunction<typeof createWithItems>
const mockDeleteTreatmentPlanDb = deleteTreatmentPlanDb as jest.MockedFunction<typeof deleteTreatmentPlanDb>
const mockFindById = findById as jest.MockedFunction<typeof findById>
const mockFindByPatient = findByPatient as jest.MockedFunction<typeof findByPatient>
const mockGetProgress = getProgress as jest.MockedFunction<typeof getProgress>
const mockUpdate = update as jest.MockedFunction<typeof update>
const mockUpdateItem = updateItem as jest.MockedFunction<typeof updateItem>

const planRow = {
  id: 'plan-1',
  clinicId: 'clinic-1',
  patientId: 'patient-1',
  patient: null,
  title: 'Implante',
  description: null,
  totalSessions: 3,
  completedSessions: 1,
  status: 'active',
  startedAt: new Date('2026-01-01T10:00:00.000Z'),
  expectedCompletionAt: null,
  completedAt: null,
  lastSessionAt: null,
  nextSessionDueAt: null,
  notes: null,
  createdBy: 'user-1',
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
  updatedAt: new Date('2026-01-01T10:00:00.000Z'),
}

const itemRow = {
  id: 'item-1',
  treatmentPlanId: 'plan-1',
  procedureId: 'procedure-1',
  procedureName: 'Avaliação',
  sessionNumber: 1,
  appointmentId: null,
  status: 'completed',
  scheduledAt: new Date('2026-01-02T10:00:00.000Z'),
  completedAt: new Date('2026-01-02T11:00:00.000Z'),
  notes: null,
  createdAt: new Date('2026-01-01T10:00:00.000Z'),
}

beforeEach(() => jest.clearAllMocks())

describe('treatment plan service', () => {
  it('creates a plan and converts repository rows to snake_case', async () => {
    mockCreateWithItems.mockResolvedValue({ plan: planRow, items: [itemRow] })

    const result = await createTreatmentPlan({
      clinic_id: 'clinic-1',
      patient_id: 'patient-1',
      title: 'Implante',
      description: 'Plano inicial',
      total_sessions: 3,
      started_at: '2026-01-01T10:00:00.000Z',
      expected_completion_at: '2026-02-01T10:00:00.000Z',
      notes: 'Observação',
      created_by: 'user-1',
      items: [{
        procedure_id: 'procedure-1',
        procedure_name: 'Avaliação',
        session_number: 1,
        status: 'pending',
        scheduled_at: '2026-01-02T10:00:00.000Z',
      }],
    })

    expect(result).toEqual(expect.objectContaining({
      id: 'plan-1',
      clinic_id: 'clinic-1',
      patient_id: 'patient-1',
      total_sessions: 3,
      items: [expect.objectContaining({ treatment_plan_id: 'plan-1', scheduled_at: '2026-01-02T10:00:00.000Z' })],
    }))
    expect(mockCreateWithItems).toHaveBeenCalledWith(expect.objectContaining({
      clinicId: 'clinic-1',
      patientId: 'patient-1',
      startedAt: new Date('2026-01-01T10:00:00.000Z'),
      items: [expect.objectContaining({ scheduledAt: new Date('2026-01-02T10:00:00.000Z') })],
    }))
  })

  it('returns a safe error for create failures', async () => {
    mockCreateWithItems.mockRejectedValue(new Error('db down'))
    await expect(createTreatmentPlan({
      clinic_id: 'clinic-1', patient_id: 'patient-1', title: 'Plano', total_sessions: 1, items: [],
    })).rejects.toThrow('Failed to create treatment plan')
  })

  it('lists plans, handles empty repository results and failures', async () => {
    mockFindByPatient.mockResolvedValue([{ ...planRow, items: [itemRow] }])
    await expect(getTreatmentPlansByPatient('patient-1', 'clinic-1')).resolves.toEqual([
      expect.objectContaining({ clinic_id: 'clinic-1', items: [expect.objectContaining({ procedure_name: 'Avaliação' })] }),
    ])
    mockFindByPatient.mockResolvedValue([])
    await expect(getTreatmentPlansByPatient('patient-1', 'clinic-1')).resolves.toEqual([])
    mockFindByPatient.mockRejectedValue(new Error('db down'))
    await expect(getTreatmentPlansByPatient('patient-1', 'clinic-1')).resolves.toEqual([])
  })

  it('gets a plan, returns null when absent and handles failures', async () => {
    mockFindById.mockResolvedValue({ ...planRow, items: [itemRow] })
    await expect(getTreatmentPlanById('plan-1')).resolves.toEqual(expect.objectContaining({ id: 'plan-1', items: [expect.any(Object)] }))
    mockFindById.mockResolvedValue(null)
    await expect(getTreatmentPlanById('missing')).resolves.toBeNull()
    mockFindById.mockRejectedValue(new Error('db down'))
    await expect(getTreatmentPlanById('plan-1')).resolves.toBeNull()
  })

  it('updates fields, completes status and handles null/errors', async () => {
    mockUpdate.mockResolvedValue(planRow)
    await expect(updateTreatmentPlan('plan-1', {
      title: 'Novo', description: 'Desc', status: 'completed', total_sessions: 4,
      expected_completion_at: '2026-03-01T10:00:00.000Z', notes: 'Nota',
    })).resolves.toEqual(expect.objectContaining({ id: 'plan-1' }))
    expect(mockUpdate).toHaveBeenCalledWith('plan-1', expect.objectContaining({
      title: 'Novo', status: 'completed', totalSessions: 4, completedAt: expect.any(Date), expectedCompletionAt: expect.any(Date),
    }))
    mockUpdate.mockResolvedValue(null)
    await expect(updateTreatmentPlan('plan-1', {})).resolves.toBeNull()
    mockUpdate.mockRejectedValue(new Error('db down'))
    await expect(updateTreatmentPlan('plan-1', {})).resolves.toBeNull()
  })

  it('updates session progress through partial, complete, no-plan and missing-item paths', async () => {
    mockUpdateItem.mockResolvedValue(itemRow)
    mockGetProgress.mockResolvedValue({ totalSessions: 3, completedSessions: 1 })
    mockUpdate.mockResolvedValue(planRow)
    await expect(updateSessionProgress('item-1', 'plan-1')).resolves.toEqual(expect.objectContaining({ id: 'item-1' }))
    expect(mockUpdate).toHaveBeenCalledWith('plan-1', expect.objectContaining({ completedSessions: 2 }))

    mockGetProgress.mockResolvedValue({ totalSessions: 2, completedSessions: 1 })
    await updateSessionProgress('item-1', 'plan-1')
    expect(mockUpdate).toHaveBeenCalledWith('plan-1', expect.objectContaining({ status: 'completed', completedAt: expect.any(Date) }))

    mockGetProgress.mockResolvedValue(null)
    await expect(updateSessionProgress('item-1', 'plan-1')).resolves.toEqual(expect.objectContaining({ id: 'item-1' }))
    mockUpdateItem.mockResolvedValue(null)
    await expect(updateSessionProgress('missing', 'plan-1')).resolves.toBeNull()
  })

  it('calculates progress including empty and zero-total cases', async () => {
    mockGetProgress.mockResolvedValue(null)
    await expect(getTreatmentPlanProgress('missing')).resolves.toEqual({ totalSessions: 0, completedSessions: 0, percent: 0 })
    mockGetProgress.mockResolvedValue({ totalSessions: 3, completedSessions: 1 })
    await expect(getTreatmentPlanProgress('plan-1')).resolves.toEqual({ totalSessions: 3, completedSessions: 1, percent: 33 })
    mockGetProgress.mockResolvedValue({ totalSessions: 0, completedSessions: 0 })
    await expect(getTreatmentPlanProgress('plan-1')).resolves.toEqual({ totalSessions: 0, completedSessions: 0, percent: 0 })
  })

  it('deletes plans and returns false when repository deletion fails', async () => {
    mockDeleteTreatmentPlanDb.mockResolvedValue(undefined)
    await expect(deleteTreatmentPlan('plan-1')).resolves.toBe(true)
    mockDeleteTreatmentPlanDb.mockRejectedValue(new Error('db down'))
    await expect(deleteTreatmentPlan('plan-1')).resolves.toBe(false)
  })
})
