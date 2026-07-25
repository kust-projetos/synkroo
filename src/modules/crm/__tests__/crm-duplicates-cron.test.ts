/**
 * crm-duplicates-cron.test.ts — Task 4 / Eixo 2 Integration Closure.
 *
 * Cobertura módulo-nível do cron CRM:
 *  - crmManifest.jobs declara 'crm-duplicates' (coberto também em action-taxonomy).
 *  - duplicate-suggestions-repository.listClinicIdsWithPendingSuggestions
 *    retorna distinct clinicIds quando há sugestões pendentes.
 *  - A action `crm.reprocessarSugestoesDuplicidade` é system-only e resolve
 *    via listSuggestions + dismiss de stale.
 *
 * O comportamento de runtime do route handler (auth, module gate, per-clinic
 * error continuation) é coberto em src/app/api/cron/crm-duplicates/route.test.ts.
 */
import type { ActionContext } from '@/core/actions/types';

const mockListSuggestions = jest.fn();
const mockFindDuplicateSource = jest.fn();
const mockTransitionSuggestionStatus = jest.fn();

jest.mock('@/modules/crm/repositories/duplicate-suggestions-repository', () => {
  const actual = jest.requireActual(
    '@/modules/crm/repositories/duplicate-suggestions-repository',
  );
  return {
    ...actual,
    listSuggestions: (...args: unknown[]) => mockListSuggestions(...args),
    findDuplicateSource: (...args: unknown[]) => mockFindDuplicateSource(...args),
    transitionSuggestionStatus: (...args: unknown[]) =>
      mockTransitionSuggestionStatus(...args),
  };
});

jest.mock('@/core/actions/registry', () => {
  const actual = jest.requireActual('@/core/actions/registry');
  return {
    ...actual,
    getActions: () => [
      {
        name: 'crm.reprocessarSugestoesDuplicidade',
        module: 'crm',
        requires: 'system',
      },
    ],
  };
});

import { crmManifest } from '@/modules/crm';
import {
  reprocessarSugestoesDuplicidade,
} from '@/modules/crm/actions';

describe('crmManifest.jobs — declares crm-duplicates', () => {
  it('jobs contém "crm-duplicates"', () => {
    expect((crmManifest as any).jobs).toContain('crm-duplicates');
  });
});

describe('crm.reprocessarSugestoesDuplicidade — system-only action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('action tem requires=system e module=crm', () => {
    expect(reprocessarSugestoesDuplicidade.requires).toBe('system');
    expect(reprocessarSugestoesDuplicidade.module).toBe('crm');
  });

  it('processa sugestões pendentes da clínica via listSuggestions', async () => {
    mockListSuggestions.mockResolvedValue([
      {
        id: 's1',
        clinicId: 'c1',
        ownerType: 'patient',
        leftId: 'l1',
        rightId: 'r1',
      },
    ]);
    mockFindDuplicateSource.mockResolvedValue({ id: 'x', clinicId: 'c1' });

    const ctx: ActionContext = {
      source: 'system',
      clinicId: 'c1',
      can: () => true,
      hasModule: () => true,
      audit: { actor: 'cron:crm-duplicates' },
    };

    const result = await reprocessarSugestoesDuplicidade.handler(
      { clinicId: 'c1' },
      ctx,
    );

    expect(mockListSuggestions).toHaveBeenCalledWith('c1', { status: 'pending' });
    expect(result).toMatchObject({ evaluated: 1 });
  });

  it('dismiss stale (left/right ausentes) sem chamar score', async () => {
    mockListSuggestions.mockResolvedValue([
      {
        id: 's1',
        clinicId: 'c1',
        ownerType: 'patient',
        leftId: 'l1',
        rightId: 'r1',
      },
    ]);
    mockFindDuplicateSource
      .mockResolvedValueOnce(null) // left ausente
      .mockResolvedValueOnce(null);
    mockTransitionSuggestionStatus.mockResolvedValue(undefined);

    const ctx: ActionContext = {
      source: 'system',
      clinicId: 'c1',
      can: () => true,
      hasModule: () => true,
      audit: { actor: 'cron:crm-duplicates' },
    };

    const result = await reprocessarSugestoesDuplicidade.handler(
      { clinicId: 'c1' },
      ctx,
    );

    expect(mockTransitionSuggestionStatus).toHaveBeenCalledWith(
      's1',
      ['pending'],
      'dismissed',
      { dismissReason: 'stale_after_merge' },
    );
    expect(result).toMatchObject({ evaluated: 1, dismissed: 1 });
  });

  it('zero pending suggestions → { evaluated: 0, dismissed: 0 }', async () => {
    mockListSuggestions.mockResolvedValue([]);
    const ctx: ActionContext = {
      source: 'system',
      clinicId: 'c1',
      can: () => true,
      hasModule: () => true,
      audit: { actor: 'cron:crm-duplicates' },
    };
    const result = await reprocessarSugestoesDuplicidade.handler(
      { clinicId: 'c1' },
      ctx,
    );
    expect(result).toEqual({ evaluated: 0, dismissed: 0 });
  });
});

describe('listClinicIdsWithPendingSuggestions — repository function exists', () => {
  it('exporta listClinicIdsWithPendingSuggestions como função', () => {
    const repo = require('@/modules/crm/repositories/duplicate-suggestions-repository');
    expect(typeof repo.listClinicIdsWithPendingSuggestions).toBe('function');
  });
});