import { NextRequest, NextResponse } from 'next/server'
import { eq, and, gte, lte, inArray, desc, asc, isNull, sql } from 'drizzle-orm'
import { hasRequiredRole, validateApiAuth } from '@/lib/auth/session'
import { handleApiError } from '@/lib/errors'
import { getDb } from '@/lib/db/client'
import { appointments, patients, leads, conversations, dentists, procedures } from '@/lib/db/schema'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { redactPII } from '@/lib/reports/redact-pii'

const COLORS = {
  primary: [41, 98, 255] as [number, number, number],
  secondary: [97, 97, 97] as [number, number, number],
  header: [33, 37, 41] as [number, number, number],
  success: [40, 167, 69] as [number, number, number],
  warning: [255, 193, 7] as [number, number, number],
  danger: [220, 53, 69] as [number, number, number],
  lightGray: [245, 245, 245] as [number, number, number],
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await validateApiAuth()
    if (!authResult.success) return NextResponse.json({ error: authResult.error!.message }, { status: authResult.error!.status })
    const clinicId = authResult.profile!.clinic_id
    const canExport = typeof hasRequiredRole === 'function'
      ? hasRequiredRole(authResult.profile!, ['owner', 'admin'])
      : ['owner', 'admin'].includes(authResult.profile!.role)
    if (!canExport) {
      return NextResponse.json({ error: 'Insufficient report permission' }, { status: 403 })
    }
    const sp = new URL(request.url).searchParams
    const type = sp.get('type') || 'appointments'
    const format = sp.get('format') || 'csv'
    const startDate = sp.get('start_date')
    const endDate = sp.get('end_date')
    const statusFilter = sp.get('status')
    const dentistId = sp.get('dentist_id')
    const procedureId = sp.get('procedure_id')
    const sourceFilter = sp.get('source')
    const tagsFilter = sp.get('tags')
    const db = getDb()

    let data: any[] = [], headers: string[] = [], filename = '', title = ''
    const addDate = (c: any[], date: string | null, op: 'gte' | 'lte') => { if (date) c.push(op === 'gte' ? gte(appointments.scheduledAt, new Date(date)) : lte(appointments.scheduledAt, new Date(date + 'T23:59:59'))) }

    switch (type) {
      case 'appointments': {
        const conds: any[] = [eq(appointments.clinicId, clinicId)]
        if (startDate) conds.push(gte(appointments.scheduledAt, new Date(startDate)))
        if (endDate) conds.push(lte(appointments.scheduledAt, new Date(endDate + 'T23:59:59')))
        if (statusFilter) conds.push(inArray(appointments.status as any, statusFilter.split(',')))
        if (dentistId) conds.push(eq(appointments.dentistId, dentistId))
        if (procedureId) conds.push(eq(appointments.procedureId, procedureId))
        const rows = await db.select({
          id: appointments.id, scheduledAt: appointments.scheduledAt, status: appointments.status, notes: appointments.notes,
          patientName: patients.name, patientPhone: patients.phone, patientEmail: patients.email,
          dentistName: dentists.name, procedureName: procedures.name,
        }).from(appointments).leftJoin(patients, eq(appointments.patientId, patients.id)).leftJoin(dentists, eq(appointments.dentistId, dentists.id)).leftJoin(procedures, eq(appointments.procedureId, procedures.id))
          .where(and(...conds)).orderBy(desc(appointments.scheduledAt))
        data = rows.map(r => ({ ...r, total_value: 0, patients: { name: r.patientName, phone: r.patientPhone, email: r.patientEmail }, dentists: { name: r.dentistName }, procedures: { name: r.procedureName } }))
        headers = ['Data/Hora', 'Paciente', 'Telefone', 'Status', 'Dentista', 'Procedimento', 'Valor', 'Observações']; filename = 'agendamentos'; title = 'Relatório de Agendamentos'
        break
      }
      case 'patients': {
        const conds: any[] = [eq(patients.clinicId, clinicId), isNull(patients.deletedAt)]
        const rows = await db.select({ id: patients.id, name: patients.name, phone: patients.phone, email: patients.email, cpf: patients.cpf, birthDate: patients.birthDate, tags: patients.tags, lastVisitAt: patients.lastVisitAt, createdAt: patients.createdAt })
          .from(patients).where(and(...conds)).orderBy(asc(patients.name))
        data = rows.map(r => ({ ...r, status: 'active', source: '', last_visit: r.lastVisitAt }))
        headers = ['Nome', 'Telefone', 'Email', 'CPF', 'Nascimento', 'Status', 'Tags', 'Origem', 'Última Visita']; filename = 'pacientes'; title = 'Relatório de Pacientes'
        break
      }
      case 'leads': {
        const conds: any[] = [eq(leads.clinicId, clinicId)]
        if (startDate) conds.push(gte(leads.createdAt, new Date(startDate)))
        if (endDate) conds.push(lte(leads.createdAt, new Date(endDate + 'T23:59:59')))
        if (statusFilter) conds.push(inArray(leads.status as any, statusFilter.split(',')))
        if (sourceFilter) conds.push(inArray(leads.source as any, sourceFilter.split(',')))
        const rows = await db.select({ id: leads.id, name: leads.name, phone: leads.phone, email: leads.email, source: leads.source, status: leads.status, temperature: leads.temperature, score: leads.score, dealValue: leads.dealValue, interest: leads.interest, createdAt: leads.createdAt })
          .from(leads).where(and(...conds)).orderBy(desc(leads.createdAt))
        data = rows.map(r => ({ ...r, budget_value: r.dealValue }))
        headers = ['Nome', 'Telefone', 'Email', 'Origem', 'Status', 'Temperatura', 'Score', 'Orçamento', 'Interesse', 'Cadastro']; filename = 'leads'; title = 'Relatório de Leads'
        break
      }
      case 'financial': {
        const conds: any[] = [eq(appointments.clinicId, clinicId), inArray(appointments.status as any, ['completed', 'confirmed'])]
        if (startDate) conds.push(gte(appointments.scheduledAt, new Date(startDate)))
        if (endDate) conds.push(lte(appointments.scheduledAt, new Date(endDate + 'T23:59:59')))
        if (dentistId) conds.push(eq(appointments.dentistId, dentistId))
        if (procedureId) conds.push(eq(appointments.procedureId, procedureId))
        const rows = await db.select({
          id: appointments.id, scheduledAt: appointments.scheduledAt, status: appointments.status,
          patientName: patients.name, procedureName: procedures.name,
        }).from(appointments).leftJoin(patients, eq(appointments.patientId, patients.id)).leftJoin(procedures, eq(appointments.procedureId, procedures.id))
          .where(and(...conds)).orderBy(desc(appointments.scheduledAt))
        data = rows.map(r => ({ ...r, total_value: 0, payment_status: '', patients: { name: r.patientName }, procedures: { name: r.procedureName } }))
        headers = ['Data', 'Paciente', 'Procedimento', 'Valor', 'Status Pagamento']; filename = 'financeiro'; title = 'Relatório Financeiro'
        break
      }
      case 'conversations': {
        const rows = await db.select({ id: conversations.id, channel: conversations.channel, status: conversations.status, lastMessageAt: conversations.lastMessageAt, createdAt: conversations.createdAt, patientName: patients.name, patientPhone: patients.phone })
          .from(conversations).leftJoin(patients, eq(conversations.patientId, patients.id)).where(eq(conversations.clinicId, clinicId)).orderBy(desc(conversations.lastMessageAt))
        data = rows.map(r => ({ ...r, last_message_at: r.lastMessageAt, patients: { name: r.patientName, phone: r.patientPhone } }))
        headers = ['ID', 'Canal', 'Paciente', 'Telefone', 'Status', 'Última Mensagem', 'Criado em']; filename = 'conversas'; title = 'Relatório de Conversas'
        break
      }
      default:
        return NextResponse.json({ error: 'Invalid report type. Use: appointments, patients, leads, financial, conversations' }, { status: 400 })
    }

    data = redactPII(data)
    const dateSuffix = new Date().toISOString().split('T')[0]
    if (format === 'pdf') {
      const pdfBuffer = generatePDF(data, headers, type, title, { startDate, endDate, generatedBy: authResult.profile!.name || authResult.profile!.email })
      return new NextResponse(new Uint8Array(pdfBuffer), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}_${dateSuffix}.pdf"` } })
    }
    const csvContent = generateCSV(data, headers, type)
    return new NextResponse(csvContent, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}_${dateSuffix}.csv"` } })
  } catch (error) { return handleApiError(error) }
}

// ─── CSV / PDF generators (unchanged) ───
function generateCSV(data: any[], headers: string[], type: string): string {
  const BOM = '\uFEFF'
  const rows: string[][] = [headers]
  for (const item of data) {
    switch (type) {
      case 'appointments': rows.push([formatDate(item.scheduledAt||item.scheduled_at),item.patients?.name||'',item.patients?.phone||'',translateStatus(item.status),item.dentists?.name||'',item.procedures?.name||'',formatCurrency(item.total_value),(item.notes||'').replace(/"/g,'""')]); break
      case 'patients': rows.push([item.name||'',item.phone||'',item.email||'',item.cpf||'',formatDate(item.birthDate||item.birth_date),translateStatus(item.status),(item.tags||[]).join('; '),item.source||'',formatDate(item.lastVisitAt||item.last_visit)]); break
      case 'leads': rows.push([item.name||'',item.phone||'',item.email||'',item.source||'',translateLeadStatus(item.status),translateTemperature(item.temperature),item.score?.toString()||'',formatCurrency(item.budget_value||item.dealValue),item.interest||'',formatDate(item.createdAt||item.created_at)]); break
      case 'financial': rows.push([formatDate(item.scheduledAt||item.scheduled_at),item.patients?.name||'',item.procedures?.name||'',formatCurrency(item.total_value),translatePaymentStatus(item.payment_status)]); break
      case 'conversations': rows.push([item.id?.substring(0,8)||'',item.channel||'',item.patients?.name||'',item.patients?.phone||'',translateConvStatus(item.status),formatDate(item.lastMessageAt||item.last_message_at),formatDate(item.createdAt||item.created_at)]); break
    }
  }
  return BOM + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
}

function generatePDF(data: any[], headers: string[], type: string, title: string, meta: any): Buffer {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' }) as any
  doc.setFillColor(...COLORS.primary); doc.rect(0, 0, 297, 28, 'F')
  doc.setTextColor(255, 255, 255); doc.setFontSize(18); doc.setFont('helvetica', 'bold'); doc.text('Synkroo', 14, 12)
  doc.setFontSize(13); doc.setFont('helvetica', 'normal'); doc.text(title, 14, 20)
  doc.setFontSize(9)
  const dateRange = meta.startDate && meta.endDate ? `Período: ${formatDate(meta.startDate)} a ${formatDate(meta.endDate)}` : 'Período: Todos os dados'
  doc.text(dateRange, 283, 12, { align: 'right' })
  doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 283, 18, { align: 'right' })
  if (meta.generatedBy) doc.text(`Por: ${meta.generatedBy}`, 283, 24, { align: 'right' })
  const sy = 34; doc.setTextColor(33,37,41); doc.setFontSize(10); doc.setFont('helvetica','bold'); doc.text(`Total: ${data.length}`,14,sy)
  const tableRows = data.map((item: any) => {
    switch (type) {
      case 'appointments': return [formatDate(item.scheduledAt||item.scheduled_at),item.patients?.name||'',item.patients?.phone||'',translateStatus(item.status),item.dentists?.name||'',item.procedures?.name||'',formatCurrency(item.total_value),truncate(item.notes||'',40)]
      case 'patients': return [item.name||'',item.phone||'',item.email||'',item.cpf||'',formatDate(item.birthDate||item.birth_date),translateStatus(item.status),(item.tags||[]).join(', '),item.source||'',formatDate(item.lastVisitAt||item.last_visit)]
      case 'leads': return [item.name||'',item.phone||'',item.source||'',translateLeadStatus(item.status),translateTemperature(item.temperature),item.score?.toString()||'',formatCurrency(item.budget_value||item.dealValue),item.interest||'',formatDate(item.createdAt||item.created_at)]
      case 'financial': return [formatDate(item.scheduledAt||item.scheduled_at),item.patients?.name||'',item.procedures?.name||'',formatCurrency(item.total_value),translatePaymentStatus(item.payment_status)]
      case 'conversations': return [item.id?.substring(0,8)||'',item.channel||'',item.patients?.name||'',item.patients?.phone||'',translateConvStatus(item.status),formatDate(item.lastMessageAt||item.last_message_at),formatDate(item.createdAt||item.created_at)]
      default: return []
    }
  })
  autoTable(doc, { head: [headers], body: tableRows, startY: sy+6, theme: 'striped', headStyles: { fillColor: COLORS.primary, textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 }, bodyStyles: { fontSize: 7, textColor: COLORS.secondary }, alternateRowStyles: { fillColor: COLORS.lightGray }, margin: { left: 14, right: 14 }, styles: { cellPadding: 2, overflow: 'linebreak' } })
  const pc = doc.getNumberOfPages()
  for (let i=1;i<=pc;i++) { doc.setPage(i); doc.setFontSize(7); doc.setTextColor(97,97,97); doc.text(`Synkroo | Página ${i}/${pc}`, 148.5, doc.internal.pageSize.getHeight()-6, { align:'center' }) }
  return Buffer.from(doc.output('arraybuffer'))
}

function formatDate(d: any): string { if(!d)return''; try{return new Date(d).toLocaleDateString('pt-BR')}catch{return String(d)} }
function formatCurrency(v: any): string { if(v==null)return'R$ 0,00'; return Number(v).toLocaleString('pt-BR',{style:'currency',currency:'BRL'}) }
function truncate(s: string, m: number): string { return s.length>m?s.slice(0,m)+'...':s }
function translateStatus(s: string): string { const m:Record<string,string>={scheduled:'Agendado',confirmed:'Confirmado',completed:'Concluído',cancelled:'Cancelado',no_show:'No-show',pending:'Pendente',active:'Ativo',inactive:'Inativo'}; return m[s]||s }
function translateLeadStatus(s: string): string { const m:Record<string,string>={new:'Novo',contacted:'Contatado',qualified:'Qualificado',proposal_sent:'Proposta Enviada',negotiation:'Negociação',won:'Ganho',lost:'Perdido'}; return m[s]||s }
function translateTemperature(t: string): string { const m:Record<string,string>={hot:'Quente',warm:'Morno',cold:'Frio'}; return m[t]||t }
function translatePaymentStatus(s: string): string { const m:Record<string,string>={paid:'Pago',pending:'Pendente',overdue:'Vencido',partial:'Parcial',refunded:'Reembolsado'}; return m[s]||s||'Pendente' }
function translateConvStatus(s: string): string { const m:Record<string,string>={active:'Ativa',closed:'Encerrada',escalated:'Escalada',pending:'Pendente'}; return m[s]||s }
