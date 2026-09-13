/**
 * contact-read-repository.ts — read-model unificado CRM (coordenador).
 *
 * CRM é exceção única que importa os schemas owner (patients, leads) somente
 * para leitura (SELECT/COUNT). Mutações em notas/tags SEMPRE passam pelos
 * owner bridges (registrarObservacaoPaciente / registrarNotaLead /
 * atualizarTagsPaciente / atualizarTagsLead) — ver contact-notes-service
 * e contact-tags-service.
 *
 * Modelo:
 *   ContactType = 'patient' | 'lead'
 *   - Pacientes: deleted_at IS NULL, merge_status != 'merged'
 *   - Leads: converted_at IS NULL, merge_status != 'merged'
 *
 * Ordenação global: updated_at DESC, type ASC, id ASC (estável para paginação).
 */
/* eslint-disable boundaries/dependencies -- CRM é exceção única (Eixo 2 Integration Closure): SELECT/COUNT sobre owner schemas (patients, leads, observações, atividades). */
import { sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  patients,
  patientObservations,
} from '@/modules/operacional/schema/patients';
import {
  leads,
  leadActivities,
} from '@/modules/comercial/schema/leads';
/* eslint-enable boundaries/dependencies */

export type ContactType = 'patient' | 'lead';

export interface ContactListOptions {
  search?: string;
  type?: ContactType;
  limit: number;
  offset: number;
}

export interface ContactListRow {
  id: string;
  type: ContactType;
  name: string;
  phone: string | null;
  email: string | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ContactDetail extends ContactListRow {
  cpf: string | null;
  notes: string | null;
  tags: string[];
  status: string | null;
}

export interface TimelineEntry {
  id: string;
  type: string; // observation/note/call/etc
  description: string | null;
  performedAt: Date | null;
}

export interface NoteEntry {
  id: string;
  type: string;
  description: string | null;
  performedAt: Date | null;
}

const PATIENT_NOT_MERGED = sql`(${patients.mergeStatus} IS NULL OR ${patients.mergeStatus} <> 'merged')`;
const LEAD_NOT_MERGED = sql`(${leads.mergeStatus} IS NULL OR ${leads.mergeStatus} <> 'merged')`;

// ─── listContacts: UNION ALL parametrizado com filtro opcional de tipo ────────

export async function listContacts(
  clinicId: string,
  opts: ContactListOptions,
): Promise<ContactListRow[]> {
  const db = getDb();
  const search = opts.search?.trim();
  const searchFrag = search
    ? sql`AND ${patients.name} ILIKE ${'%' + search + '%'}`
    : sql``;
  const searchFragLead = search
    ? sql`AND ${leads.name} ILIKE ${'%' + search + '%'}`
    : sql``;

  const patientQuery = sql`
    SELECT
      'patient'::text AS type,
      ${patients.id}::text AS id,
      ${patients.name}::text AS name,
      ${patients.phone}::text AS phone,
      ${patients.email}::text AS email,
      ${patients.createdAt} AS created_at,
      ${patients.updatedAt} AS updated_at
    FROM ${patients}
    WHERE ${patients.clinicId} = ${clinicId}
      AND ${patients.deletedAt} IS NULL
      AND ${PATIENT_NOT_MERGED}
      ${searchFrag}
  `;

  const leadQuery = sql`
    SELECT
      'lead'::text AS type,
      ${leads.id}::text AS id,
      ${leads.name}::text AS name,
      ${leads.phone}::text AS phone,
      ${leads.email}::text AS email,
      ${leads.createdAt} AS created_at,
      ${leads.updatedAt} AS updated_at
    FROM ${leads}
    WHERE ${leads.clinicId} = ${clinicId}
      AND ${leads.convertedAt} IS NULL
      AND ${LEAD_NOT_MERGED}
      ${searchFragLead}
  `;

  let baseQuery;
  if (opts.type === 'patient') {
    baseQuery = patientQuery;
  } else if (opts.type === 'lead') {
    baseQuery = leadQuery;
  } else {
    baseQuery = sql`${patientQuery} UNION ALL ${leadQuery}`;
  }

  const query = sql`
    ${baseQuery}
    ORDER BY updated_at DESC, type ASC, id ASC
    LIMIT ${opts.limit} OFFSET ${opts.offset}
  `;
  const result = await db.execute(query);
  const rows = (result as { rows?: unknown[] }).rows ?? [];
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    type: (r.type as string) as ContactType,
    name: r.name as string,
    phone: (r.phone as string | null) ?? null,
    email: (r.email as string | null) ?? null,
    createdAt: (r.created_at as Date | null) ?? null,
    updatedAt: (r.updated_at as Date | null) ?? null,
  }));
}

// ─── countContacts: query separada para total ─────────────────────────────────

export async function countContacts(
  clinicId: string,
  opts: Omit<ContactListOptions, 'limit' | 'offset'>,
): Promise<number> {
  const db = getDb();
  const search = opts.search?.trim();
  const searchFrag = search
    ? sql`AND ${patients.name} ILIKE ${'%' + search + '%'}`
    : sql``;
  const searchFragLead = search
    ? sql`AND ${leads.name} ILIKE ${'%' + search + '%'}`
    : sql``;

  const countPatientSql = sql`(SELECT COUNT(*) FROM ${patients}
       WHERE ${patients.clinicId} = ${clinicId}
         AND ${patients.deletedAt} IS NULL
         AND ${PATIENT_NOT_MERGED}
         ${searchFrag})`;

  const countLeadSql = sql`(SELECT COUNT(*) FROM ${leads}
       WHERE ${leads.clinicId} = ${clinicId}
         AND ${leads.convertedAt} IS NULL
         AND ${LEAD_NOT_MERGED}
         ${searchFragLead})`;

  let query;
  if (opts.type === 'patient') {
    query = sql`SELECT ${countPatientSql} AS total`;
  } else if (opts.type === 'lead') {
    query = sql`SELECT ${countLeadSql} AS total`;
  } else {
    query = sql`SELECT ${countPatientSql} + ${countLeadSql} AS total`;
  }

  const result = await db.execute(query);
  const rows = (result as { rows?: unknown[] }).rows ?? [];
  const total = (rows as Array<{ total: number | string }>)[0]?.total ?? 0;
  return Number(total);
}

// ─── getContact: detail por {type,id} ─────────────────────────────────────────

export async function getContact(
  clinicId: string,
  type: ContactType,
  id: string,
): Promise<ContactDetail | null> {
  const db = getDb();
  const query = type === 'patient'
    ? sql`
        SELECT 'patient'::text AS type, id, clinic_id, name, phone, email, cpf, notes, tags, status, created_at, updated_at
        FROM ${patients}
        WHERE clinic_id = ${clinicId} AND id = ${id}
          AND ${patients.deletedAt} IS NULL
          AND ${PATIENT_NOT_MERGED}
        LIMIT 1
      `
    : type === 'lead'
      ? sql`
          SELECT 'lead'::text AS type, id, clinic_id, name, phone, email, NULL::varchar AS cpf, notes, tags, status, created_at, updated_at
          FROM ${leads}
          WHERE clinic_id = ${clinicId} AND id = ${id}
            AND ${leads.convertedAt} IS NULL
            AND ${LEAD_NOT_MERGED}
          LIMIT 1
        `
      : null;

  if (!query) return null;
  const result = await db.execute(query);
  const rows = (result as { rows?: unknown[] }).rows ?? [];
  const row = (rows as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  return {
    id: row.id as string,
    type: (row.type as string) as ContactType,
    name: row.name as string,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    cpf: (row.cpf as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    tags: ((row.tags as string[] | null) ?? []) as string[],
    status: (row.status as string | null) ?? null,
    createdAt: (row.created_at as Date | null) ?? null,
    updatedAt: (row.updated_at as Date | null) ?? null,
  };
}

// ─── listContactTimeline: eventos recentes por tipo ────────────────────────────

export async function listContactTimeline(
  clinicId: string,
  type: ContactType,
  id: string,
): Promise<TimelineEntry[]> {
  const db = getDb();
  const query = type === 'patient'
    ? sql`
        SELECT ${patientObservations.id}::text AS id,
               'observation'::text AS type,
               ${patientObservations.content}::text AS description,
               ${patientObservations.createdAt} AS performed_at
        FROM ${patientObservations}
        WHERE ${patientObservations.clinicId} = ${clinicId}
          AND ${patientObservations.patientId} = ${id}
        ORDER BY ${patientObservations.createdAt} DESC
      `
    : type === 'lead'
      ? sql`
          SELECT ${leadActivities.id}::text AS id,
                 ${leadActivities.activityType}::text AS type,
                 ${leadActivities.description}::text AS description,
                 ${leadActivities.performedAt} AS performed_at
          FROM ${leadActivities}
          INNER JOIN ${leads} ON ${leads.id} = ${leadActivities.leadId}
          WHERE ${leads.clinicId} = ${clinicId}
            AND ${leadActivities.leadId} = ${id}
          ORDER BY ${leadActivities.performedAt} DESC
        `
      : null;

  if (!query) return [];
  const result = await db.execute(query);
  const rows = (result as { rows?: unknown[] }).rows ?? [];
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    type: r.type as string,
    description: (r.description as string | null) ?? null,
    performedAt: (r.performed_at as Date | null) ?? null,
  }));
}

// ─── listContactNotes: notas (lead usa activity_type='note') ──────────────────

export async function listContactNotes(
  clinicId: string,
  type: ContactType,
  id: string,
): Promise<NoteEntry[]> {
  const db = getDb();
  const query = type === 'patient'
    ? sql`
        SELECT ${patientObservations.id}::text AS id,
               'observation'::text AS type,
               ${patientObservations.content}::text AS description,
               ${patientObservations.createdAt} AS performed_at
        FROM ${patientObservations}
        WHERE ${patientObservations.clinicId} = ${clinicId}
          AND ${patientObservations.patientId} = ${id}
        ORDER BY ${patientObservations.createdAt} DESC
      `
    : type === 'lead'
      ? sql`
          SELECT ${leadActivities.id}::text AS id,
                 ${leadActivities.activityType}::text AS type,
                 ${leadActivities.description}::text AS description,
                 ${leadActivities.performedAt} AS performed_at
          FROM ${leadActivities}
          INNER JOIN ${leads} ON ${leads.id} = ${leadActivities.leadId}
          WHERE ${leads.clinicId} = ${clinicId}
            AND ${leadActivities.leadId} = ${id}
            AND ${leadActivities.activityType} = 'note'
          ORDER BY ${leadActivities.performedAt} DESC
        `
      : null;

  if (!query) return [];
  const result = await db.execute(query);
  const rows = (result as { rows?: unknown[] }).rows ?? [];
  return (rows as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    type: r.type as string,
    description: (r.description as string | null) ?? null,
    performedAt: (r.performed_at as Date | null) ?? null,
  }));
}