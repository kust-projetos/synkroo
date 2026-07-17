import {
  findDuplicateSource,
  listDuplicateCandidates,
  upsertCanonicalSuggestion,
} from '../repositories/duplicate-suggestions-repository';
import {
  classifyDuplicateScore,
  scoreDuplicatePair,
  suggestDuplicateWinner,
  type DuplicateDetectionRecord,
  type DuplicateOwnerType,
} from './duplicate-scoring-service';

export interface DuplicateRecalculationResult {
  evaluated: number;
  persisted: number;
}

interface RecalculateInput {
  clinicId: string;
  ownerType: DuplicateOwnerType;
  ownerId: string;
}

function belongsToBoundary(
  source: DuplicateDetectionRecord,
  candidate: DuplicateDetectionRecord,
): boolean {
  return source.id !== candidate.id
    && source.clinicId === candidate.clinicId
    && source.ownerType === candidate.ownerType;
}

async function persistEligiblePair(
  source: DuplicateDetectionRecord,
  candidate: DuplicateDetectionRecord,
): Promise<boolean> {
  if (!belongsToBoundary(source, candidate)) return false;
  const scoreResult = scoreDuplicatePair(source, candidate);
  const confidence = classifyDuplicateScore(scoreResult.score);
  if (!confidence) return false;
  await upsertCanonicalSuggestion({
    clinicId: source.clinicId,
    ownerType: source.ownerType,
    left: source,
    right: candidate,
    confidence,
    duplicateScore: scoreResult.score,
    winnerSuggestedId: suggestDuplicateWinner(source, candidate),
    signals: scoreResult.signals,
  });
  return true;
}

async function recalculateDuplicates(
  input: RecalculateInput,
): Promise<DuplicateRecalculationResult> {
  const source = await findDuplicateSource(input);
  if (!source) return { evaluated: 0, persisted: 0 };
  const candidates = await listDuplicateCandidates({
    clinicId: input.clinicId,
    ownerType: input.ownerType,
    excludeId: input.ownerId,
  });
  let persisted = 0;
  for (const candidate of candidates) {
    if (await persistEligiblePair(source, candidate)) persisted += 1;
  }
  return { evaluated: candidates.length, persisted };
}

export function recalculateDuplicatesForPatient(input: {
  clinicId: string;
  patientId: string;
}) {
  return recalculateDuplicates({
    clinicId: input.clinicId,
    ownerType: 'patient',
    ownerId: input.patientId,
  });
}

export function recalculateDuplicatesForLead(input: {
  clinicId: string;
  leadId: string;
}) {
  return recalculateDuplicates({
    clinicId: input.clinicId,
    ownerType: 'lead',
    ownerId: input.leadId,
  });
}
