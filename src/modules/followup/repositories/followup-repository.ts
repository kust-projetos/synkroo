import { and, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { appointments, patientFeedback, patients } from '@/modules/operacional/schema';

export async function createFeedback(params: {
  clinicId: string;
  patientId: string;
  appointmentId?: string;
  feedbackType?: string;
  rating?: number;
  npsScore?: number;
  wouldRecommend?: boolean;
  comments?: string;
  channel?: string;
}): Promise<void> {
  await getDb().insert(patientFeedback).values({
    clinicId: params.clinicId,
    patientId: params.patientId,
    appointmentId: params.appointmentId ?? null,
    feedbackType: params.feedbackType ?? 'post_consultation',
    rating: params.rating ?? null,
    npsScore: params.npsScore ?? null,
    wouldRecommend: params.wouldRecommend ?? null,
    comments: params.comments ?? null,
    channel: params.channel ?? 'whatsapp',
  } as any);
}

export async function findPatientForClinic(clinicId: string, patientId: string) {
  const [row] = await getDb().select({ id: patients.id, name: patients.name })
    .from(patients).where(and(eq(patients.id, patientId), eq(patients.clinicId, clinicId))).limit(1);
  return row ?? null;
}

export async function findAppointmentForClinicPatient(clinicId: string, patientId: string, appointmentId: string) {
  const [row] = await getDb().select({ id: appointments.id }).from(appointments).where(and(
    eq(appointments.id, appointmentId),
    eq(appointments.patientId, patientId),
    eq(appointments.clinicId, clinicId),
  )).limit(1);
  return row ?? null;
}
