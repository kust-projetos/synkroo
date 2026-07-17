export type DuplicateOwnerType = 'patient' | 'lead';
export type DuplicateConfidence = 'medium' | 'high';

export interface DuplicateDetectionRecord {
  id: string;
  clinicId: string;
  ownerType: DuplicateOwnerType;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  status: string | null;
  tags: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
  relationshipCount: number;
}

export interface DuplicateSignal {
  matched: boolean;
  weight: number;
}

export interface DuplicateScoreResult {
  score: number;
  signals: Record<'document' | 'phone' | 'email' | 'name', DuplicateSignal>;
}

export function classifyDuplicateScore(
  score: number,
): DuplicateConfidence | null {
  if (score < 70) return null;
  return score >= 85 ? 'high' : 'medium';
}

function normalizeDigits(value: string | null): string {
  return value?.replace(/\D/g, '') ?? '';
}

function normalizeText(value: string | null): string {
  return value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ') ?? '';
}

function exactSignal(left: string, right: string, weight: number): DuplicateSignal {
  const matched = Boolean(left && right && left === right);
  return { matched, weight: matched ? weight : 0 };
}

function nameSignal(left: string | null, right: string | null): DuplicateSignal {
  const normalizedLeft = normalizeText(left);
  const normalizedRight = normalizeText(right);
  if (!normalizedLeft || !normalizedRight) return { matched: false, weight: 0 };
  if (normalizedLeft === normalizedRight) return { matched: true, weight: 30 };
  const contained = normalizedLeft.length >= 4
    && normalizedRight.length >= 4
    && (normalizedLeft.includes(normalizedRight)
      || normalizedRight.includes(normalizedLeft));
  return { matched: contained, weight: contained ? 15 : 0 };
}

function duplicateSignals(
  left: DuplicateDetectionRecord,
  right: DuplicateDetectionRecord,
) {
  return {
    document: exactSignal(
      normalizeDigits(left.document),
      normalizeDigits(right.document),
      90,
    ),
    phone: exactSignal(normalizeDigits(left.phone), normalizeDigits(right.phone), 70),
    email: exactSignal(normalizeText(left.email), normalizeText(right.email), 70),
    name: nameSignal(left.name, right.name),
  };
}

export function scoreDuplicatePair(
  left: DuplicateDetectionRecord,
  right: DuplicateDetectionRecord,
): DuplicateScoreResult {
  const signals = duplicateSignals(left, right);
  const total = Object.values(signals)
    .reduce((score, signal) => score + signal.weight, 0);
  return { score: Math.min(100, total), signals };
}

function winnerScore(record: DuplicateDetectionRecord): number {
  const completeFields = [record.phone, record.email, record.document, record.status]
    .filter(Boolean).length;
  return completeFields + record.tags.length + Math.min(record.relationshipCount, 5) * 2;
}

export function suggestDuplicateWinner(
  left: DuplicateDetectionRecord,
  right: DuplicateDetectionRecord,
): string {
  const scoreDifference = winnerScore(left) - winnerScore(right);
  if (scoreDifference !== 0) return scoreDifference > 0 ? left.id : right.id;
  const leftCreatedAt = left.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const rightCreatedAt = right.createdAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt < rightCreatedAt ? left.id : right.id;
  }
  return left.id.localeCompare(right.id) <= 0 ? left.id : right.id;
}
