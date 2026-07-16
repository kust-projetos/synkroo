import { and, eq, inArray, ne, sql, type SQLWrapper } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  crmDuplicateSuggestions,
  leads,
  patients,
} from '@/lib/db/schema';
import type {
  DuplicateConfidence,
  DuplicateDetectionRecord,
  DuplicateOwnerType,
  DuplicateScoreResult,
} from '../services/duplicate-scoring-service';

export interface DuplicateRecordLookup {
  clinicId: string;
  ownerType: DuplicateOwnerType;
  ownerId: string;
}

export interface DuplicateCandidateLookup {
  clinicId: string;
  ownerType: DuplicateOwnerType;
  excludeId: string;
}

export interface UpsertDuplicateSuggestionInput {
  clinicId: string;
  ownerType: DuplicateOwnerType;
  left: DuplicateDetectionRecord;
  right: DuplicateDetectionRecord;
  confidence: DuplicateConfidence;
  duplicateScore: number;
  winnerSuggestedId: string;
  signals: DuplicateScoreResult['signals'];
}

export function canonicalizePair(leftId: string, rightId: string) {
  return leftId.localeCompare(rightId) <= 0
    ? { leftId, rightId }
    : { leftId: rightId, rightId: leftId };
}

function mapPatient(
  row: typeof patients.$inferSelect,
): DuplicateDetectionRecord {
  return {
    id: row.id,
    clinicId: row.clinicId,
    ownerType: 'patient',
    name: row.name,
    phone: row.phone,
    email: row.email,
    document: row.cpf,
    status: row.status,
    tags: row.tags ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    relationshipCount: 0,
  };
}

function mapLead(row: typeof leads.$inferSelect): DuplicateDetectionRecord {
  return {
    id: row.id,
    clinicId: row.clinicId,
    ownerType: 'lead',
    name: row.name,
    phone: row.phoneNormalized ?? row.phone,
    email: row.email,
    document: null,
    status: row.status,
    tags: row.tags ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    relationshipCount: row.contactCount ?? 0,
  };
}

async function findPatient(input: DuplicateRecordLookup) {
  const [row] = await getDb()
    .select()
    .from(patients)
    .where(and(
      eq(patients.clinicId, input.clinicId),
      eq(patients.id, input.ownerId),
      sql`${patients.deletedAt} IS NULL`,
    ))
    .limit(1);
  return row ? mapPatient(row) : null;
}

async function findLead(input: DuplicateRecordLookup) {
  const [row] = await getDb()
    .select()
    .from(leads)
    .where(and(
      eq(leads.clinicId, input.clinicId),
      eq(leads.id, input.ownerId),
      sql`${leads.convertedAt} IS NULL`,
    ))
    .limit(1);
  return row ? mapLead(row) : null;
}

export function findDuplicateSource(input: DuplicateRecordLookup) {
  return input.ownerType === 'patient' ? findPatient(input) : findLead(input);
}

async function listPatientCandidates(input: DuplicateCandidateLookup) {
  const rows = await getDb()
    .select()
    .from(patients)
    .where(and(
      eq(patients.clinicId, input.clinicId),
      ne(patients.id, input.excludeId),
      sql`${patients.deletedAt} IS NULL`,
    ));
  return rows.map(mapPatient);
}

async function listLeadCandidates(input: DuplicateCandidateLookup) {
  const rows = await getDb()
    .select()
    .from(leads)
    .where(and(
      eq(leads.clinicId, input.clinicId),
      ne(leads.id, input.excludeId),
      sql`${leads.convertedAt} IS NULL`,
    ));
  return rows.map(mapLead);
}

export function listDuplicateCandidates(input: DuplicateCandidateLookup) {
  return input.ownerType === 'patient'
    ? listPatientCandidates(input)
    : listLeadCandidates(input);
}

function snapshot(record: DuplicateDetectionRecord) {
  return {
    id: record.id,
    name: record.name,
    phone: record.phone,
    email: record.email,
    document: record.document,
    status: record.status,
    tags: record.tags,
    createdAt: record.createdAt?.toISOString() ?? null,
    updatedAt: record.updatedAt?.toISOString() ?? null,
    relationshipCount: record.relationshipCount,
  };
}

function pairSnapshots(
  input: UpsertDuplicateSuggestionInput,
  pair: { leftId: string; rightId: string },
) {
  const leftRecord = input.left.id === pair.leftId ? input.left : input.right;
  const rightRecord = input.left.id === pair.rightId ? input.left : input.right;
  return {
    leftSnapshot: snapshot(leftRecord),
    rightSnapshot: snapshot(rightRecord),
  };
}

async function executeSuggestionUpsert(
  input: UpsertDuplicateSuggestionInput,
  pair: { leftId: string; rightId: string },
) {
  const { leftSnapshot, rightSnapshot } = pairSnapshots(input, pair);
  return getDb().execute(sql`
    INSERT INTO ${crmDuplicateSuggestions} (
      clinic_id, owner_type, left_id, right_id, confidence,
      duplicate_score, winner_suggested_id, signals,
      left_snapshot, right_snapshot
    ) VALUES (
      ${input.clinicId}, ${input.ownerType}, ${pair.leftId}, ${pair.rightId},
      ${input.confidence}, ${input.duplicateScore}, ${input.winnerSuggestedId},
      ${JSON.stringify(input.signals)}::jsonb,
      ${JSON.stringify(leftSnapshot)}::jsonb,
      ${JSON.stringify(rightSnapshot)}::jsonb
    )
    ON CONFLICT (
      clinic_id,
      owner_type,
      LEAST(left_id, right_id),
      GREATEST(left_id, right_id)
    ) DO UPDATE SET
      confidence = EXCLUDED.confidence,
      duplicate_score = EXCLUDED.duplicate_score,
      winner_suggested_id = EXCLUDED.winner_suggested_id,
      signals = EXCLUDED.signals,
      left_snapshot = EXCLUDED.left_snapshot,
      right_snapshot = EXCLUDED.right_snapshot,
      refreshed_at = now(),
      updated_at = now()
    RETURNING id, status
  `);
}

export async function upsertCanonicalSuggestion(
  input: UpsertDuplicateSuggestionInput,
) {
  const pair = canonicalizePair(input.left.id, input.right.id);
  const result = await executeSuggestionUpsert(input, pair);
  return result.rows[0] as { id: string; status: string };
}

// ─── Review actions repository methods ──────────────────────────────────────

export interface SuggestionFilter {
  status?: string;
  ownerType?: string;
  limit?: number;
  offset?: number;
}

function suggestionWhere(clinicId: string, filter?: SuggestionFilter) {
  const parts: (SQLWrapper | undefined)[] = [
    eq(crmDuplicateSuggestions.clinicId, clinicId),
  ];
  if (filter?.status) parts.push(eq(crmDuplicateSuggestions.status, filter.status as any));
  if (filter?.ownerType) parts.push(eq(crmDuplicateSuggestions.ownerType, filter.ownerType as any));
  return and(...parts);
}

export async function findSuggestionById(clinicId: string, id: string) {
  const [row] = await getDb()
    .select()
    .from(crmDuplicateSuggestions)
    .where(and(
      eq(crmDuplicateSuggestions.id, id),
      eq(crmDuplicateSuggestions.clinicId, clinicId),
    ))
    .limit(1);
  return row ?? null;
}

export async function listSuggestions(clinicId: string, filter?: SuggestionFilter) {
  const limit = Math.max(filter?.limit ?? 20, 1);
  const offset = Math.max(filter?.offset ?? 0, 0);
  return getDb()
    .select()
    .from(crmDuplicateSuggestions)
    .where(suggestionWhere(clinicId, filter))
    .orderBy(sql`detected_at DESC`)
    .limit(limit)
    .offset(offset);
}

export async function transitionSuggestionStatus(
  id: string,
  expected: string[],
  target: string,
  extra?: Partial<typeof crmDuplicateSuggestions.$inferInsert>,
): Promise<boolean> {
  const result: any = await getDb()
    .update(crmDuplicateSuggestions)
    .set({ status: target as any, updatedAt: new Date(), ...extra } as any)
    .where(and(
      eq(crmDuplicateSuggestions.id, id),
      inArray(crmDuplicateSuggestions.status, expected as any),
    ));
  return result?.rowCount !== undefined ? result.rowCount > 0 : true;
}

export async function refreshSuggestionEvidence(
  id: string,
  evidence: {
    duplicateScore: number;
    confidence: string;
    signals: Record<string, unknown>;
    winnerSuggestedId: string | null;
    leftSnapshot: Record<string, unknown>;
    rightSnapshot: Record<string, unknown>;
  },
) {
  await getDb()
    .update(crmDuplicateSuggestions)
    .set({
      duplicateScore: evidence.duplicateScore,
      confidence: evidence.confidence as any,
      signals: evidence.signals as any,
      winnerSuggestedId: evidence.winnerSuggestedId as any,
      leftSnapshot: evidence.leftSnapshot as any,
      rightSnapshot: evidence.rightSnapshot as any,
      refreshedAt: new Date(),
      updatedAt: new Date(),
    } as any)
    .where(eq(crmDuplicateSuggestions.id, id));
}

// ─── Cron reprocess helpers ──────────────────────────────────────────────────

export async function listPendingSuggestionsAllClinics() {
  return getDb()
    .select()
    .from(crmDuplicateSuggestions)
    .where(eq(crmDuplicateSuggestions.status, 'pending' as any))
    .orderBy(crmDuplicateSuggestions.detectedAt);
}

/**
 * Lista os clinicIds que possuem pelo menos uma sugestão pendente.
 * Usado pelo cron /api/cron/crm-duplicates para construir um system
 * context por clínica e disparar a action system-only
 * `crm.reprocessarSugestoesDuplicidade`.
 *
 * DISTINCT evita disparar o reprocess múltiplas vezes por clínica.
 */
export async function listClinicIdsWithPendingSuggestions(): Promise<string[]> {
  const rows = await getDb()
    .selectDistinct({ clinicId: crmDuplicateSuggestions.clinicId })
    .from(crmDuplicateSuggestions)
    .where(eq(crmDuplicateSuggestions.status, 'pending' as any));
  return rows
    .map((r) => (r as { clinicId?: string }).clinicId)
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
}
