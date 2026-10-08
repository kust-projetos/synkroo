import { NextRequest } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { apiSuccess, apiFailure, apiAuthFailure, generateRequestId } from '@/lib/api/response'
import { withModuleRoute } from '@/core/modules/gates'
import {
  getTreatmentPlansByPatient,
  createTreatmentPlan,
  type TreatmentPlan,
} from '@/services/treatment-plans/treatment-plan.service'
import { createTreatmentPlanSchema } from '@/lib/validations/treatment-plan'
import { listBudgets } from '@/modules/financeiro/services/budget-service'
import { listInstallments } from '@/modules/financeiro/services/installment-service'
import { listPayments } from '@/modules/financeiro/services/payment-service'
import { toCents } from '@/modules/financeiro/services/money'

/**
 * GET /api/treatment-plans
 * List treatment-plans for a patient.
 * Com ?include_financials=true, responde o contrato canônico (D2 lote 4)
 * { data: { financial_summary } } consumido por useFinancialSummary.
 * Sem o param, a resposta é byte-equivalente à anterior.
 */
async function handleGET(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('operacional:view')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }
    const clinicId = authResult.profile!.clinic_id

    const searchParams = request.nextUrl.searchParams
    const patientId = searchParams.get('patient_id')

    if (!patientId) {
      return apiFailure('INVALID_INPUT', 'patient_id is required', requestId, 400)
    }

    const wantFinancials = searchParams.get('include_financials') === 'true'
    if (wantFinancials) {
      // Gate financeiro fail-fast (antes de qualquer leitura de planos):
      // o resumo expõe valores cobrados/pagos → exige financeiro:view além
      // do operacional:view já validado acima. Sem a permissão, nenhuma
      // leitura é executada ou descartada.
      const financeAuth = await validateApiAuth('financeiro:view')
      if (!financeAuth.success) {
        return apiAuthFailure(financeAuth.error, requestId)
      }
    }

    const plans = await getTreatmentPlansByPatient(patientId, clinicId);

    if (!wantFinancials) {
      return apiSuccess({ treatment_plans: plans })
    }

    const financial_summary = await buildFinancialSummary(plans, clinicId)
    return apiSuccess({ financial_summary })
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

/** numeric(10,2)/numeric(12,2) → centavos exatos; NULL/inválido vira 0. */
function safeCents(value: unknown): bigint {
  try {
    if (value === null || value === undefined || value === '') return 0n
    return toCents(value as string | number)
  } catch {
    return 0n
  }
}

function toIso(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  return String(value)
}

function toDateOnly(value: unknown): string {
  if (!value) return ''
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString().slice(0, 10)
  }
  return String(value)
}

/**
 * Agrega o resumo financeiro por plano no shape de useFinancialSummary.
 * Vínculo plano↔orçamento: budgets.treatment_plan_id (coluna existe nos dois
 * schemas + finder findByTreatmentPlan; o fluxo canônico criarOrcamento não o
 * preenche). Planos sem orçamento vinculado retornam budget null com zeros —
 * sem atribuir orçamentos avulsos do paciente a planos arbitrários.
 * listBudgets é desc(createdAt): em múltiplos vínculos, vale o mais recente.
 */
async function buildFinancialSummary(plans: TreatmentPlan[], clinicId: string) {
  const budgets = await listBudgets(clinicId)
  // Só orçamentos vinculados aos planos do paciente (treatmentPlanId ∈ planos);
  // avulsos do paciente nunca são atribuídos a planos arbitrários.
  const planIds = new Set(plans.map((p) => p.id).filter(Boolean) as string[])
  const byPlan = new Map<string, (typeof budgets)[number]>()
  for (const b of budgets) {
    const tpId = (b as { treatmentPlanId?: string | null }).treatmentPlanId
    if (tpId && planIds.has(tpId) && !byPlan.has(tpId)) byPlan.set(tpId, b)
  }

  // Fan-out paralelo por plano (installments+payments de cada budget em
  // paralelo entre planos), sempre com filtro de clínica (clinicId).
  // Limite: os services só expõem list por budgetId (sem batch real por IDs),
  // então N budgets vinculados = N×2 queries paralelas, não 1 batch.
  const entries = await Promise.all(
    plans.map(async (plan) => {
      const sessionsTotal = plan.total_sessions ?? plan.items?.length ?? 0
      const sessionsCompleted =
        plan.completed_sessions ??
        plan.items?.filter((i) => i.status === 'completed').length ??
        0
      const budget = plan.id ? byPlan.get(plan.id) : undefined
      if (!budget) {
        return {
          plan,
          budget: null as null,
          installments: [] as unknown[],
          payments: [] as unknown[],
          billedCents: 0n,
          paidCents: 0n,
          owedCents: 0n,
          sessionsCompleted,
          sessionsTotal,
        }
      }

      const [installmentRows, paymentRows] = await Promise.all([
        listInstallments(clinicId, budget.id),
        listPayments(clinicId, budget.id),
      ])

      const installments = installmentRows.map((r) => ({
        id: (r as { id?: string }).id,
        budget_id: (r as { budgetId?: string }).budgetId ?? budget.id,
        amount: Number(safeCents((r as { amount?: unknown }).amount)) / 100,
        due_date: toDateOnly((r as { dueDate?: unknown }).dueDate),
        status: (r as { status?: string | null }).status ?? 'pending',
        paid_at: toIso((r as { paidAt?: unknown }).paidAt),
      }))
      // PII-minimization: payments.notes (texto livre) omitido do resumo.
      const payments = paymentRows.map((r) => ({
        id: (r as { id?: string }).id,
        budget_id: (r as { budgetId?: string | null }).budgetId ?? null,
        amount: Number(safeCents((r as { amount?: unknown }).amount)) / 100,
        payment_method: (r as { paymentMethod?: string }).paymentMethod ?? '',
        paid_at: toIso((r as { paidAt?: unknown }).paidAt),
      }))

      const billedCents = safeCents((budget as { finalValue?: unknown }).finalValue)
      const paidCents = paymentRows.reduce(
        (sum, r) => sum + safeCents((r as { amount?: unknown }).amount),
        0n,
      )
      const owedCents = billedCents - paidCents > 0n ? billedCents - paidCents : 0n

      return {
        plan,
        budget: { id: budget.id },
        installments,
        payments,
        billedCents,
        paidCents,
        owedCents,
        sessionsCompleted,
        sessionsTotal,
      }
    }),
  )

  let totalBilledCents = 0n
  let totalPaidCents = 0n
  let totalOwedCents = 0n
  const summaries = entries.map((e) => {
    totalBilledCents += e.billedCents
    totalPaidCents += e.paidCents
    // Sem compensação cruzada: total é a soma dos owed já limitados a zero.
    totalOwedCents += e.owedCents
    const { billedCents, paidCents, owedCents, ...rest } = e
    void billedCents
    void paidCents
    void owedCents
    return {
      ...rest,
      billed: Number(e.billedCents) / 100,
      paid: Number(e.paidCents) / 100,
      owed: Number(e.owedCents) / 100,
    }
  })

  return {
    plans: summaries,
    totalBilled: Number(totalBilledCents) / 100,
    totalPaid: Number(totalPaidCents) / 100,
    totalOwed: Number(totalOwedCents) / 100,
  }
}

/**
 * POST /api/treatment-plans
 * Create a new treatment-plan
 */
async function handlePOST(request: NextRequest) {
  const requestId = generateRequestId()
  try {
    const authResult = await validateApiAuth('operacional:manage_patients')
    if (!authResult.success) {
      return apiAuthFailure(authResult.error, requestId)
    }
    const clinicId = authResult.profile!.clinic_id
    const userId = authResult.profile!.id

    const rawBody = await request.json()
    const parsed = createTreatmentPlanSchema.safeParse(rawBody)
    if (!parsed.success) {
      return apiFailure('INVALID_INPUT', 'Validation failed', requestId, 400)
    }
    const body = parsed.data

    const plan = await createTreatmentPlan({
      clinic_id: clinicId,
      patient_id: body.patient_id,
      title: body.title,
      description: body.description,
      total_sessions: body.total_sessions,
      started_at: body.started_at,
      expected_completion_at: body.expected_completion_at,
      notes: body.notes,
      created_by: userId,
      items: body.items.map((item, index) => ({
        ...item,
        session_number: item.session_number ?? index + 1,
        status: 'pending',
      })),
    })

    return apiSuccess({ treatment_plan: plan }, undefined, 201)
  } catch {
    return apiFailure('INTERNAL_ERROR', 'Internal server error', requestId, 500)
  }
}

export const GET = withModuleRoute('operacional')(handleGET)
export const POST = withModuleRoute('operacional')(handlePOST)
