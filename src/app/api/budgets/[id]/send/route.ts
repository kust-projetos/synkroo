import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/auth/session'
import { getBudgetById, markBudgetSent } from '@/services/budgets/budget.service'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send';
import { handleApiError } from '@/lib/errors'

type RouteParams = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })

    const clinicId = authResult.profile!.clinic_id
    const { id } = await params
    const budget = await getBudgetById(id)
    if (!budget) return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    if ((budget as any).clinic_id !== clinicId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const { send_whatsapp = false, custom_message } = body

    const updatedBudget = await markBudgetSent(id)
    if (!updatedBudget) return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 })

    let whatsappSent = false, whatsappError: string | null = null
    if (send_whatsapp && budget.patient?.phone) {
      try {
        const message = custom_message || formatBudgetMessage(budget)
        const result = await sendWhatsAppMessage(budget.patient.phone, message)
        whatsappSent = result.success
        if (!result.success) whatsappError = result.error ?? null
      } catch (error) { whatsappError = error instanceof Error ? error.message : 'Unknown error' }
    }

    return NextResponse.json({ budget: updatedBudget, whatsapp_sent: whatsappSent, whatsapp_error: whatsappError })
  } catch (error) { return handleApiError(error) }
}

function formatBudgetMessage(budget: any): string {
  const items = budget.items?.map((item: any) => `• ${item.procedure_name} - R$ ${item.total_price.toFixed(2)}`).join('\n') || ''
  const validUntil = budget.valid_until ? new Date(budget.valid_until).toLocaleDateString('pt-BR') : '7 dias'
  return `🏥 *Orçamento - ${budget.title || 'Tratamento Dental'}*\n\nOlá, ${budget.patient?.name || 'Paciente'}!\n\nAqui está o orçamento solicitado:\n\n📋 *Procedimentos:*\n${items}\n\n💰 *Valor Total:* R$ ${budget.total_value.toFixed(2)}\n${budget.discount_percent > 0 ? `🎉 *Desconto:* ${budget.discount_percent}% (-R$ ${budget.discount_value.toFixed(2)})` : ''}\n✨ *Valor Final:* R$ ${budget.final_value.toFixed(2)}\n\n📅 *Válido até:* ${validUntil}\n\n💳 Temos opções de parcelamento!\n\nPara aceitar ou tirar dúvidas, é só responder esta mensagem. 😊`
}
