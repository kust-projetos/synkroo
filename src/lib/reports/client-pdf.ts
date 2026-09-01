'use client'

export interface ReportExportPayload {
  data: any[]
  headers: string[]
  filename: string
  title: string
  meta: {
    startDate?: string | null
    endDate?: string | null
    generatedBy?: string | null
    type: string
  }
}

const COLORS = {
  primary: [41, 98, 255] as [number, number, number],
  secondary: [97, 97, 97] as [number, number, number],
  header: [33, 37, 41] as [number, number, number],
  success: [40, 167, 69] as [number, number, number],
  warning: [255, 193, 7] as [number, number, number],
  danger: [220, 53, 69] as [number, number, number],
  lightGray: [245, 245, 245] as [number, number, number],
}

function formatDate(d: any): string {
  if (!d) return ''
  try {
    return new Date(d).toLocaleDateString('pt-BR')
  } catch {
    return String(d)
  }
}

function formatCurrency(v: any): string {
  if (v == null) return 'R$ 0,00'
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function truncate(s: string, m: number): string {
  return s.length > m ? s.slice(0, m) + '...' : s
}

function translateStatus(s: string): string {
  const m: Record<string, string> = {
    scheduled: 'Agendado',
    confirmed: 'Confirmado',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    no_show: 'No-show',
    pending: 'Pendente',
    active: 'Ativo',
    inactive: 'Inativo',
  }
  return m[s] || s
}

function translateLeadStatus(s: string): string {
  const m: Record<string, string> = {
    new: 'Novo',
    contacted: 'Contatado',
    qualified: 'Qualificado',
    proposal_sent: 'Proposta Enviada',
    negotiation: 'Negociação',
    won: 'Ganho',
    lost: 'Perdido',
  }
  return m[s] || s
}

function translateTemperature(t: string): string {
  const m: Record<string, string> = {
    hot: 'Quente',
    warm: 'Morno',
    cold: 'Frio',
  }
  return m[t] || t
}

function translatePaymentStatus(s: string): string {
  const m: Record<string, string> = {
    paid: 'Pago',
    pending: 'Pendente',
    overdue: 'Vencido',
    partial: 'Parcial',
    refunded: 'Reembolsado',
  }
  return m[s] || s || 'Pendente'
}

function translateConvStatus(s: string): string {
  const m: Record<string, string> = {
    active: 'Ativa',
    closed: 'Encerrada',
    escalated: 'Escalada',
    pending: 'Pendente',
  }
  return m[s] || s
}

export async function generateAndDownloadClientPDF(payload: ReportExportPayload): Promise<void> {
  const { data, headers, filename, title, meta } = payload

  // Dynamic import on demand to avoid bundling jsPDF in server worker
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as any
  doc.setFillColor(...COLORS.primary)
  doc.rect(0, 0, 297, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Synkroo', 14, 12)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'normal')
  doc.text(title, 14, 20)
  doc.setFontSize(9)

  const dateRange =
    meta.startDate && meta.endDate
      ? `Período: ${formatDate(meta.startDate)} a ${formatDate(meta.endDate)}`
      : 'Período: Todos os dados'
  doc.text(dateRange, 283, 12, { align: 'right' })
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 283, 18, { align: 'right' })
  if (meta.generatedBy) doc.text(`Por: ${meta.generatedBy}`, 283, 24, { align: 'right' })

  const sy = 34
  doc.setTextColor(33, 37, 41)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text(`Total: ${data.length}`, 14, sy)

  const tableRows = data.map((item: any) => {
    switch (meta.type) {
      case 'appointments':
        return [
          formatDate(item.scheduledAt || item.scheduled_at),
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
          formatDate(item.birthDate || item.birth_date),
          translateStatus(item.status),
          (item.tags || []).join(', '),
          item.source || '',
          formatDate(item.lastVisitAt || item.last_visit),
        ]
      case 'leads':
        return [
          item.name || '',
          item.phone || '',
          item.source || '',
          translateLeadStatus(item.status),
          translateTemperature(item.temperature),
          item.score?.toString() || '',
          formatCurrency(item.budget_value || item.dealValue),
          item.interest || '',
          formatDate(item.createdAt || item.created_at),
        ]
      case 'financial':
        return [
          formatDate(item.scheduledAt || item.scheduled_at),
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
          formatDate(item.lastMessageAt || item.last_message_at),
          formatDate(item.createdAt || item.created_at),
        ]
      default:
        return []
    }
  })

  autoTable(doc, {
    head: [headers],
    body: tableRows,
    startY: sy + 6,
    theme: 'striped',
    headStyles: {
      fillColor: COLORS.primary,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: { fontSize: 7, textColor: COLORS.secondary },
    alternateRowStyles: { fillColor: COLORS.lightGray },
    margin: { left: 14, right: 14 },
    styles: { cellPadding: 2, overflow: 'linebreak' },
  })

  const pc = doc.getNumberOfPages()
  for (let i = 1; i <= pc; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(97, 97, 97)
    doc.text(`Synkroo | Página ${i}/${pc}`, 148.5, doc.internal.pageSize.getHeight() - 6, {
      align: 'center',
    })
  }

  doc.save(`${filename}.pdf`)
}
