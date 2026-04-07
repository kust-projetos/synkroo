import { NextRequest, NextResponse } from 'next/server'
import { validateApiAuth } from '@/lib/supabase/server'
import { createTypedClient } from '@/lib/supabase/typed'
import { dbLogger } from '@/lib/logger'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * GET /api/reports/export
 * Export data as CSV or PDF with advanced filters
 *
 * Query params:
 *   type: 'appointments' | 'patients' | 'leads' | 'conversations' | 'financial'
 *   format: 'csv' | 'pdf'
 *   start_date: YYYY-MM-DD
 *   end_date: YYYY-MM-DD
 *   status: filter by status (comma-separated)
 *   dentist_id: filter by dentist
 *   procedure_id: filter by procedure
 *   source: filter by source (leads)
 *   tags: filter by tags (comma-separated, for patients)
 */

const COLORS = {
  primary: [41, 98, 255] as [number, number, number],    // #2962FF
  secondary: [97, 97, 97] as [number, number, number],   // #616161
  header: [33, 37, 41] as [number, number, number],      // #212529
  success: [40, 167, 69] as [number, number, number],    // #28A45
  warning: [255, 193, 7] as [number, number, number],    // #FFC107
  danger: [220, 53, 69] as [number, number, number],     // #DC3545
  lightGray: [245, 245, 245] as [number, number, number],
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error!.message },
        { status: authResult.error!.status }
      )
    }

    const clinicId = authResult.profile!.clinic_id
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'appointments'
    const format = searchParams.get('format') || 'csv'
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const statusFilter = searchParams.get('status')
    const dentistId = searchParams.get('dentist_id')
    const procedureId = searchParams.get('procedure_id')
    const sourceFilter = searchParams.get('source')
    const tagsFilter = searchParams.get('tags')

    const supabase = await createTypedClient()

    let data: any[] = []
    let headers: string[] = []
    let filename = ''
    let title = ''

    switch (type) {
      case 'appointments': {
        let query = supabase
          .from('appointments')
          .select(`
            id, scheduled_at, status, notes, total_value,
            patients (name, phone, email),
            dentists (name),
            procedures (name)
          `)
          .eq('clinic_id', clinicId)
          .order('scheduled_at', { ascending: false })

        if (startDate) query = query.gte('scheduled_at', startDate)
        if (endDate) query = query.lte('scheduled_at', endDate + 'T23:59:59')
        if (statusFilter) query = query.in('status', statusFilter.split(','))
        if (dentistId) query = query.eq('dentist_id', dentistId)
        if (procedureId) query = query.eq('procedure_id', procedureId)

        const { data: appointments } = await query
        data = appointments || []
        headers = ['Data/Hora', 'Paciente', 'Telefone', 'Status', 'Dentista', 'Procedimento', 'Valor', 'Observações']
        filename = 'agendamentos'
        title = 'Relatório de Agendamentos'
        break
      }

      case 'patients': {
        let query = supabase
          .from('patients')
          .select('id, name, phone, email, cpf, birth_date, tags, status, last_visit, created_at, source')
          .eq('clinic_id', clinicId)
          .is('deleted_at', null)
          .order('name')

        if (statusFilter) query = query.in('status', statusFilter.split(','))
        if (tagsFilter) query = query.overlaps('tags', tagsFilter.split(','))

        const { data: patients } = await query
        data = patients || []
        headers = ['Nome', 'Telefone', 'Email', 'CPF', 'Nascimento', 'Status', 'Tags', 'Origem', 'Última Visita']
        filename = 'pacientes'
        title = 'Relatório de Pacientes'
        break
      }

      case 'leads': {
        let query = supabase
          .from('leads')
          .select('id, name, phone, email, source, status, temperature, score, budget_value, interest, created_at')
          .eq('clinic_id', clinicId)
          .order('created_at', { ascending: false })

        if (startDate) query = query.gte('created_at', startDate)
        if (endDate) query = query.lte('created_at', endDate + 'T23:59:59')
        if (statusFilter) query = query.in('status', statusFilter.split(','))
        if (sourceFilter) query = query.in('source', sourceFilter.split(','))

        const { data: leads } = await query
        data = leads || []
        headers = ['Nome', 'Telefone', 'Email', 'Origem', 'Status', 'Temperatura', 'Score', 'Orçamento', 'Interesse', 'Cadastro']
        filename = 'leads'
        title = 'Relatório de Leads'
        break
      }

      case 'financial': {
        let query = supabase
          .from('appointments')
          .select(`
            id, scheduled_at, status, total_value, payment_status,
            patients (name),
            procedures (name)
          `)
          .eq('clinic_id', clinicId)
          .in('status', ['completed', 'confirmed'])
          .order('scheduled_at', { ascending: false })

        if (startDate) query = query.gte('scheduled_at', startDate)
        if (endDate) query = query.lte('scheduled_at', endDate + 'T23:59:59')
        if (dentistId) query = query.eq('dentist_id', dentistId)
        if (procedureId) query = query.eq('procedure_id', procedureId)

        const { data: financial } = await query
        data = financial || []
        headers = ['Data', 'Paciente', 'Procedimento', 'Valor', 'Status Pagamento']
        filename = 'financeiro'
        title = 'Relatório Financeiro'
        break
      }

      case 'conversations': {
        const { data: conversations } = await supabase
          .from('conversations')
          .select(`
            id, channel, status, last_message_at, created_at,
            patients (name, phone)
          `)
          .eq('clinic_id', clinicId)
          .order('last_message_at', { ascending: false })

        data = conversations || []
        headers = ['ID', 'Canal', 'Paciente', 'Telefone', 'Status', 'Última Mensagem', 'Criado em']
        filename = 'conversas'
        title = 'Relatório de Conversas'
        break
      }

      default:
        return NextResponse.json({ error: 'Invalid report type. Use: appointments, patients, leads, financial, conversations' }, { status: 400 })
    }

    const dateSuffix = new Date().toISOString().split('T')[0]

    if (format === 'pdf') {
      const pdfBuffer = generatePDF(data, headers, type, title, {
        startDate,
        endDate,
        generatedBy: authResult.profile!.name || authResult.profile!.email,
      })

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}_${dateSuffix}.pdf"`,
        },
      })
    }

    // CSV format (default)
    const csvContent = generateCSV(data, headers, type)
    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}_${dateSuffix}.csv"`,
      },
    })
  } catch (error) {
    dbLogger.error('Error in GET /api/reports/export:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ─── CSV Generation ────────────────────────────────────────────────────────

function generateCSV(data: any[], headers: string[], type: string): string {
  const BOM = '\uFEFF' // UTF-8 BOM for Excel compatibility
  const rows: string[][] = [headers]

  for (const item of data) {
    switch (type) {
      case 'appointments':
        rows.push([
          formatDate(item.scheduled_at),
          item.patients?.name || '',
          item.patients?.phone || '',
          translateStatus(item.status),
          item.dentists?.name || '',
          item.procedures?.name || '',
          formatCurrency(item.total_value),
          (item.notes || '').replace(/"/g, '""'),
        ])
        break
      case 'patients':
        rows.push([
          item.name || '',
          item.phone || '',
          item.email || '',
          item.cpf || '',
          formatDate(item.birth_date),
          translateStatus(item.status),
          (item.tags || []).join('; '),
          item.source || '',
          formatDate(item.last_visit),
        ])
        break
      case 'leads':
        rows.push([
          item.name || '',
          item.phone || '',
          item.email || '',
          item.source || '',
          translateLeadStatus(item.status),
          translateTemperature(item.temperature),
          item.score?.toString() || '',
          formatCurrency(item.budget_value),
          item.interest || '',
          formatDate(item.created_at),
        ])
        break
      case 'financial':
        rows.push([
          formatDate(item.scheduled_at),
          item.patients?.name || '',
          item.procedures?.name || '',
          formatCurrency(item.total_value),
          translatePaymentStatus(item.payment_status),
        ])
        break
      case 'conversations':
        rows.push([
          item.id?.substring(0, 8) || '',
          item.channel || '',
          item.patients?.name || '',
          item.patients?.phone || '',
          translateConvStatus(item.status),
          formatDate(item.last_message_at),
          formatDate(item.created_at),
        ])
        break
    }
  }

  return BOM + rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n')
}

// ─── PDF Generation ────────────────────────────────────────────────────────

function generatePDF(
  data: any[],
  headers: string[],
  type: string,
  title: string,
  meta: { startDate?: string | null; endDate?: string | null; generatedBy?: string }
): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as any

  // ─── Header ─────────────────────────────────────────────────────────────
  // Blue banner
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, 297, 28, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Synkroo', 14, 12)

  doc.setFontSize(13)
  doc.setFont('helvetica', 'normal')
  doc.text(title, 14, 20)

  // Date range
  doc.setFontSize(9)
  const dateRange = meta.startDate && meta.endDate
    ? `Período: ${formatDate(meta.startDate)} a ${formatDate(meta.endDate)}`
    : 'Período: Todos os dados'
  doc.text(dateRange, 297 - 14, 12, { align: 'right' })

  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 297 - 14, 18, { align: 'right' })
  if (meta.generatedBy) {
    doc.text(`Por: ${meta.generatedBy}`, 297 - 14, 24, { align: 'right' })
  }

  // ─── Summary stats ──────────────────────────────────────────────────────
  const summaryY = 34
  doc.setTextColor(...COLORS.header)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Total de registros: ${data.length}`, 14, summaryY)

  // Type-specific summaries
  if (type === 'appointments') {
    const confirmed = data.filter((d: any) => d.status === 'confirmed' || d.status === 'completed').length
    const cancelled = data.filter((d: any) => d.status === 'cancelled').length
    const noShow = data.filter((d: any) => d.status === 'no_show').length
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.success)
    doc.text(`Confirmados: ${confirmed}`, 80, summaryY)
    doc.setTextColor(...COLORS.danger)
    doc.text(`Cancelados: ${cancelled}`, 140, summaryY)
    doc.setTextColor(...COLORS.warning)
    doc.text(`No-show: ${noShow}`, 200, summaryY)
  } else if (type === 'financial') {
    const total = data.reduce((sum: number, d: any) => sum + (d.total_value || 0), 0)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.success)
    doc.text(`Receita Total: ${formatCurrency(total)}`, 80, summaryY)
  } else if (type === 'leads') {
    const hot = data.filter((d: any) => d.temperature === 'hot').length
    const warm = data.filter((d: any) => d.temperature === 'warm').length
    const cold = data.filter((d: any) => d.temperature === 'cold').length
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...COLORS.danger)
    doc.text(`Quentes: ${hot}`, 80, summaryY)
    doc.setTextColor(...COLORS.warning)
    doc.text(`Mornos: ${warm}`, 130, summaryY)
    doc.setTextColor(100, 150, 255)
    doc.text(`Frios: ${cold}`, 180, summaryY)
  }

  // ─── Table ──────────────────────────────────────────────────────────────
  const tableRows = data.map((item: any) => {
    switch (type) {
      case 'appointments':
        return [
          formatDate(item.scheduled_at),
          item.patients?.name || '',
          item.patients?.phone || '',
          translateStatus(item.status),
          item.dentists?.name || '',
          item.procedures?.name || '',
          formatCurrency(item.total_value),
          truncate(item.notes || '', 40),
        ]
      case 'patients':
        return [
          item.name || '',
          item.phone || '',
          item.email || '',
          item.cpf || '',
          formatDate(item.birth_date),
          translateStatus(item.status),
          (item.tags || []).join(', '),
          item.source || '',
          formatDate(item.last_visit),
        ]
      case 'leads':
        return [
          item.name || '',
          item.phone || '',
          item.source || '',
          translateLeadStatus(item.status),
          translateTemperature(item.temperature),
          item.score?.toString() || '',
          formatCurrency(item.budget_value),
          item.interest || '',
          formatDate(item.created_at),
        ]
      case 'financial':
        return [
          formatDate(item.scheduled_at),
          item.patients?.name || '',
          item.procedures?.name || '',
          formatCurrency(item.total_value),
          translatePaymentStatus(item.payment_status),
        ]
      case 'conversations':
        return [
          item.id?.substring(0, 8) || '',
          item.channel || '',
          item.patients?.name || '',
          item.patients?.phone || '',
          translateConvStatus(item.status),
          formatDate(item.last_message_at),
          formatDate(item.created_at),
        ]
      default:
        return []
    }
  })

  autoTable(doc, {
    head: [headers],
    body: tableRows,
    startY: summaryY + 6,
    theme: 'striped',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 7,
      textColor: COLORS.secondary,
    },
    alternateRowStyles: {
      fillColor: COLORS.lightGray,
    },
    margin: { left: 14, right: 14 },
    styles: {
      cellPadding: 2,
      overflow: 'linebreak',
    },
    columnStyles: getTableColumnStyles(type),
    // Row coloring based on status
    didParseCell: (data: any) => {
      if (data.section === 'body' && type === 'appointments') {
        const statusCol = headers.indexOf('Status')
        if (data.column.index === statusCol) {
          const status = data.cell.raw
          if (status === 'Confirmado' || status === 'Concluído') {
            data.cell.styles.textColor = COLORS.success
            data.cell.styles.fontStyle = 'bold'
          } else if (status === 'Cancelado') {
            data.cell.styles.textColor = COLORS.danger
            data.cell.styles.fontStyle = 'bold'
          } else if (status === 'No-show') {
            data.cell.styles.textColor = COLORS.warning
            data.cell.styles.fontStyle = 'bold'
          }
        }
      }
    },
  })

  // ─── Footer ─────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    const pageHeight = doc.internal.pageSize.getHeight()
    doc.setFontSize(7)
    doc.setTextColor(...COLORS.secondary)
    doc.text(
      `Synkroo — Relatório gerado automaticamente | Página ${i} de ${pageCount}`,
      148.5,
      pageHeight - 6,
      { align: 'center' }
    )
  }

  return Buffer.from(doc.output('arraybuffer'))
}

// ─── Column Width Hints ────────────────────────────────────────────────────

function getTableColumnStyles(type: string): Record<number, any> {
  switch (type) {
    case 'appointments':
      return { 0: { cellWidth: 30 }, 6: { halign: 'right' }, 7: { cellWidth: 40 } }
    case 'patients':
      return { 0: { cellWidth: 35 }, 6: { cellWidth: 30 } }
    case 'leads':
      return { 3: { cellWidth: 20 }, 6: { halign: 'right' } }
    case 'financial':
      return { 3: { halign: 'right', fontStyle: 'bold' } }
    default:
      return {}
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function formatDate(date: string | null | undefined): string {
  if (!date) return ''
  try {
    return new Date(date).toLocaleDateString('pt-BR')
  } catch {
    return date
  }
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return 'R$ 0,00'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.substring(0, max) + '...' : str
}

function translateStatus(status: string): string {
  const map: Record<string, string> = {
    scheduled: 'Agendado',
    confirmed: 'Confirmado',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    no_show: 'No-show',
    pending: 'Pendente',
    active: 'Ativo',
    inactive: 'Inativo',
  }
  return map[status] || status
}

function translateLeadStatus(status: string): string {
  const map: Record<string, string> = {
    new: 'Novo',
    contacted: 'Contatado',
    qualified: 'Qualificado',
    proposal_sent: 'Proposta Enviada',
    negotiation: 'Negociação',
    won: 'Ganho',
    lost: 'Perdido',
  }
  return map[status] || status
}

function translateTemperature(temperature: string): string {
  const map: Record<string, string> = {
    hot: 'Quente',
    warm: 'Morno',
    cold: 'Frio',
  }
  return map[temperature] || temperature
}

function translatePaymentStatus(status: string): string {
  const map: Record<string, string> = {
    paid: 'Pago',
    pending: 'Pendente',
    overdue: 'Vencido',
    partial: 'Parcial',
    refunded: 'Reembolsado',
  }
  return map[status] || status || 'Pendente'
}

function translateConvStatus(status: string): string {
  const map: Record<string, string> = {
    active: 'Ativa',
    closed: 'Encerrada',
    escalated: 'Escalada',
    pending: 'Pendente',
  }
  return map[status] || status
}
