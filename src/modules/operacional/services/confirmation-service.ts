import { and, eq, gte } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { appointments, patients, waitlist } from '@/modules/operacional/schema';
import { dbLogger } from '@/lib/logger';

const CONFIRMATION_KEYWORDS = [
  'sim', 'confirmo', 'confirmar', 'confirmada', 'confirmado',
  'vou', 'vou ir', 'pode confirmar', 'confirmar presença',
  'ok', 'certo', 'combinado', 'combinada', 'yes', 'confirm',
];

const CANCELLATION_KEYWORDS = [
  'não', 'nao', 'cancelar', 'cancelado', 'cancelada',
  'desmarcar', 'desmarquei', 'não vou', 'nao vou',
  'impossível', 'impossivel', 'não posso', 'nao posso', 'no', 'cancel',
];

interface AppointmentMatch {
  appointmentId: string;
  scheduledAt: Date;
  patientName: string;
  clinicId: string;
  status: string;
}

export function detectConfirmationIntent(message: string): {
  isConfirmation: boolean;
  isCancellation: boolean;
  confidence: number;
} {
  const lowerMessage = message.toLowerCase().trim();
  for (const keyword of CONFIRMATION_KEYWORDS) {
    if (lowerMessage === keyword || lowerMessage.includes(keyword)) {
      return { isConfirmation: true, isCancellation: false, confidence: lowerMessage === keyword ? 0.95 : 0.8 };
    }
  }
  for (const keyword of CANCELLATION_KEYWORDS) {
    if (lowerMessage === keyword || lowerMessage.includes(keyword)) {
      return { isConfirmation: false, isCancellation: true, confidence: lowerMessage === keyword ? 0.95 : 0.8 };
    }
  }
  return { isConfirmation: false, isCancellation: false, confidence: 0 };
}

function normalizePhone(phone: string): string {
  let normalized = phone.replace(/\D/g, '');
  if (normalized.startsWith('55')) normalized = normalized.substring(2);
  return normalized;
}

export async function findPendingAppointment(
  clinicId: string,
  patientPhone: string,
): Promise<AppointmentMatch | null> {
  const db = getDb();
  const normalizedPhone = normalizePhone(patientPhone);
  const patientRows = await db.select({ id: patients.id, name: patients.name, phone: patients.phone })
    .from(patients)
    .where(eq(patients.clinicId, clinicId));
  const patient = patientRows.find((row) => {
    const candidate = normalizePhone(row.phone || '');
    return candidate === normalizedPhone || normalizedPhone.includes(candidate) || candidate.includes(normalizedPhone);
  });
  if (!patient) return null;

  const appointmentRows = await db.select({
    id: appointments.id,
    scheduledAt: appointments.scheduledAt,
    status: appointments.status,
    clinicId: appointments.clinicId,
  }).from(appointments).where(and(
    eq(appointments.patientId, patient.id),
    eq(appointments.clinicId, clinicId),
    gte(appointments.scheduledAt, new Date()),
  ));
  const pending = appointmentRows
    .filter((row) => row.status === 'scheduled' || row.status === 'confirmed')
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const appointment = pending[0];
  if (!appointment) return null;
  return {
    appointmentId: appointment.id,
    scheduledAt: new Date(appointment.scheduledAt),
    patientName: patient.name,
    clinicId: appointment.clinicId,
    status: appointment.status,
  };
}

export async function processConfirmationResponse(
  clinicId: string,
  patientPhone: string,
  message: string,
): Promise<{
  processed: boolean;
  action?: 'confirmed' | 'cancelled' | 'no_action';
  appointmentId?: string;
  responseMessage?: string;
}> {
  const intent = detectConfirmationIntent(message);
  if (!intent.isConfirmation && !intent.isCancellation) return { processed: false, action: 'no_action' };
  const appointment = await findPendingAppointment(clinicId, patientPhone);
  if (!appointment) return { processed: false, action: 'no_action' };

  const db = getDb();
  if (intent.isConfirmation) {
    await db.update(appointments).set({ status: 'confirmed' as any })
      .where(and(eq(appointments.id, appointment.appointmentId), eq(appointments.clinicId, clinicId)));
    const dateStr = appointment.scheduledAt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
    const timeStr = appointment.scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    dbLogger.info(`Appointment ${appointment.appointmentId} confirmed via WhatsApp`, { patientName: appointment.patientName });
    return {
      processed: true,
      action: 'confirmed',
      appointmentId: appointment.appointmentId,
      responseMessage: `✅ Confirmado, ${appointment.patientName}!\n\nSua consulta está confirmada:\n\n📅 ${dateStr}\n⏰ às ${timeStr}\n\nVocê receberá um lembrete no dia anterior. Até logo!`,
    };
  }

  await db.update(appointments).set({
    status: 'cancelled' as any,
    notes: 'Cancelado pelo paciente via WhatsApp',
  } as any).where(and(eq(appointments.id, appointment.appointmentId), eq(appointments.clinicId, clinicId)));
  dbLogger.info(`Appointment ${appointment.appointmentId} cancelled via WhatsApp`, { patientName: appointment.patientName });
  return {
    processed: true,
    action: 'cancelled',
    appointmentId: appointment.appointmentId,
    responseMessage: `✅ Entendido, ${appointment.patientName}.\n\nSua consulta foi cancelada. Se quiser reagendar, é só me avisar!`,
  };
}

export async function processWaitlistConfirmation(
  clinicId: string,
  patientPhone: string,
  message: string,
): Promise<{ processed: boolean; scheduled?: boolean; responseMessage?: string }> {
  const db = getDb();
  const lowerMessage = message.toLowerCase().trim();
  if (!CONFIRMATION_KEYWORDS.some((keyword) => lowerMessage.includes(keyword))) return { processed: false };

  const normalizedPhone = normalizePhone(patientPhone);
  const patientRows = await db.select({ id: patients.id, name: patients.name, phone: patients.phone })
    .from(patients).where(eq(patients.clinicId, clinicId));
  const patient = patientRows.find((row) => {
    const candidate = normalizePhone(row.phone || '');
    return candidate === normalizedPhone || normalizedPhone.includes(candidate) || candidate.includes(normalizedPhone);
  });
  if (!patient) return { processed: false };

  const [entry] = await db.select({
    id: waitlist.id,
    patientId: waitlist.patientId,
    preferredDate: waitlist.preferredDate,
    preferredTimeStart: waitlist.preferredTimeStart,
    procedureId: waitlist.procedureId,
    dentistId: waitlist.dentistId,
  }).from(waitlist).where(and(
    eq(waitlist.clinicId, clinicId),
    eq(waitlist.status, 'notified'),
    eq(waitlist.patientId, patient.id),
  )).orderBy(waitlist.notifiedAt).limit(1);
  if (!entry) return { processed: false };

  const preferredDate = entry.preferredDate instanceof Date
    ? entry.preferredDate
    : entry.preferredDate ? new Date(entry.preferredDate) : new Date();
  const preferredTime = entry.preferredTimeStart || '09:00';
  const scheduledAt = new Date(`${preferredDate.toISOString().split('T')[0]}T${preferredTime}:00`);
  const [appointment] = await db.insert(appointments).values({
    clinicId,
    patientId: entry.patientId,
    dentistId: entry.dentistId ?? null,
    procedureId: entry.procedureId ?? null,
    scheduledAt,
    durationMinutes: 30,
    status: 'confirmed' as any,
    notes: 'Agendado via lista de espera',
  } as any).returning();
  if (!appointment) {
    dbLogger.error('Error creating appointment from waitlist', { entry });
    return { processed: false };
  }
  await db.update(waitlist).set({
    status: 'scheduled',
    scheduledAppointmentId: appointment.id,
  } as any).where(and(eq(waitlist.id, entry.id), eq(waitlist.clinicId, clinicId)));

  const dateStr = scheduledAt.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const timeStr = scheduledAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return {
    processed: true,
    scheduled: true,
    responseMessage: `✅ Perfeito, ${patient.name}!\n\nSua consulta está confirmada:\n\n📅 ${dateStr}\n⏰ às ${timeStr}\n\nTe vejo lá! 🦷`,
  };
}
