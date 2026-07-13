import {
  classifyDuplicateScore,
  scoreDuplicatePair,
  suggestDuplicateWinner,
  type DuplicateDetectionRecord,
} from '@/modules/crm/services/duplicate-scoring-service';

function record(
  id: string,
  overrides: Partial<DuplicateDetectionRecord> = {},
): DuplicateDetectionRecord {
  return {
    id,
    clinicId: 'clinic-a',
    ownerType: 'patient',
    name: `Record ${id}`,
    phone: null,
    email: null,
    document: null,
    status: 'active',
    tags: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    relationshipCount: 0,
    ...overrides,
  };
}

describe('CRM duplicate scoring', () => {
  it.each([
    [69, null],
    [70, 'medium'],
    [84, 'medium'],
    [85, 'high'],
    [100, 'high'],
  ] as const)('classifies score %s', (score, expected) => {
    expect(classifyDuplicateScore(score)).toBe(expected);
  });

  it('scores an exact normalized phone as reviewable', () => {
    const left = record('left', { name: 'Ana', phone: '(11) 99999-0000' });
    const right = record('right', { name: 'Maria', phone: '11999990000' });

    expect(scoreDuplicatePair(left, right)).toMatchObject({
      score: 70,
      signals: { phone: { matched: true, weight: 70 } },
    });
  });

  it('caps composite duplicate scores at 100', () => {
    const left = record('left', {
      name: 'Ana Silva',
      phone: '11999990000',
      email: 'ana@example.com',
      document: '12345678900',
    });
    const right = record('right', {
      name: ' ana  silva ',
      phone: '(11) 99999-0000',
      email: 'ANA@example.com',
      document: '123.456.789-00',
    });

    expect(scoreDuplicatePair(left, right).score).toBe(100);
  });

  it('suggests the more complete record as winner', () => {
    const sparse = record('sparse', { name: 'Ana' });
    const complete = record('complete', {
      name: 'Ana Silva',
      phone: '11999990000',
      email: 'ana@example.com',
      tags: ['vip'],
      relationshipCount: 2,
    });

    expect(suggestDuplicateWinner(sparse, complete)).toBe('complete');
  });

  it('uses stable id ordering when winner signals tie', () => {
    expect(suggestDuplicateWinner(record('b'), record('a'))).toBe('a');
  });
});
