import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBudgetById, markBudgetSent } from '@/services/budgets/budget.service'
import { sendWhatsAppMessage } from '@/services/whatsapp'

type RouteParams = {
  params: Promise<{ id: string }>
}

/**
 * POST /api/budgets/[id]/send
 * Mark budget as sent and optionally send via WhatsApp
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const budget = await getBudgetById(id)

    if (!budget) {
      return NextResponse.json({ error: 'Budget not found' }, { status: 404 })
    }

    // Verify user has access
    const { data: userData } = await (supabase as any)
      .from('users')
      .select('clinic_id')
      .eq('id', user.id)
      .single()

    if (!userData || userData.clinic_id !== budget.clinic_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { send_whatsapp = false, custom_message } = body

    // Update status to sent
    const updatedBudget = await markBudgetSent(id)

    if (!updatedBudget) {
      return NextResponse.json({ error: 'Failed to update budget' }, { status: 500 })
    }

    let whatsappSent = false
    let whatsappError = null

    // Send via WhatsApp if requested and patient has phone
    if (send_whatsapp && budget.patient?.phone) {
      try {
        const message = custom_message || formatBudgetMessage(budget)
        const result = await sendWhatsAppMessage(budget.patient.phone, message)
        whatsappSent = result.success
        if (!result.success) {
          whatsappError = result.error
        }
      } catch (error) {
        whatsappError = error instanceof Error ? error.message : 'Unknown error'
      }
    }

    return NextResponse.json({
      budget: updatedBudget,
      whatsapp_sent: whatsappSent,
      whatsapp_error: whatsappError,
    })
  } catch (error) {
    console.error('Error sending budget:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Format budget message for WhatsApp
 */
function formatBudgetMessage(budget: any): string {
  const items = budget.items
    ?.map(
      (item: any) =>
        `• ${item.procedure_name} - R$ ${item.total_price.toFixed(2)}`
    )
    .join('\n') || ''

  const validUntil = budget.valid_until
    ? new Date(budget.valid_until).toLocaleDateString('pt-BR')
    : '7 dias'

  return `🏥 *Orçamento - ${budget.title || 'Tratamento Dental'}*

Olá, ${budget.patient?.name || 'Paciente'}!

Aqui está o orçamento solicitado:

📋 *Procedimentos:*
${items}

💰 *Valor Total:* R$ ${budget.total_value.toFixed(2)}
${budget.discount_percent > 0 ? `🎉 *Desconto:* ${budget.discount_percent}% (-R$ ${budget.discount_value.toFixed(2)})` : ''}
✨ *Valor Final:* R$ ${budget.final_value.toFixed(2)}

📅 *Válido até:* ${validUntil}

💳 Temos opções de parcelamento!

Para aceitar ou tirar dúvidas, é só responder esta mensagem. 😊`
}