/**
 * @jest-environment jsdom
 *
 * Real (non-mock) tests for the new useContactDuplicateSuggestion hook in
 * use-queries.ts. Only the underlying network call is mocked; the hook
 * itself (selection, data-shape unwrap, error/loading propagation) runs
 * for real via renderHook + a fresh QueryClient.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useContactDuplicateSuggestion, type DuplicateTabSuggestion } from '@/lib/hooks/use-queries';

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
Wrapper.displayName = 'UseContactDuplicateSuggestionWrapper';

function createWrapper() {
  return Wrapper;
}

function makeSuggestion(overrides: Partial<DuplicateTabSuggestion> = {}): DuplicateTabSuggestion {
  return {
    id: 's1',
    ownerType: 'patient',
    leftId: 'c1',
    rightId: 'c2',
    duplicateScore: 85,
    confidence: 'high',
    status: 'pending',
    winnerSuggestedId: null,
    leftSnapshot: { id: 'c1', name: 'A' },
    rightSnapshot: { id: 'c2', name: 'B' },
    signals: {},
    detectedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function mockFetchOk(body: unknown) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => body,
  });
}

function mockFetchNotOk() {
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 });
}

describe('useContactDuplicateSuggestion (real hook)', () => {
  beforeEach(() => {
    (global.fetch as jest.Mock) = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('selects the suggestion whose leftId matches the contact id', async () => {
    mockFetchOk([makeSuggestion({ id: 'match' })]);
    const { result } = renderHook(
      () => useContactDuplicateSuggestion('c1', 'patient'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.selected?.id).toBe('match'));
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('selects the suggestion whose rightId matches the contact id', async () => {
    mockFetchOk([makeSuggestion({ id: 'match', leftId: 'x', rightId: 'c1' })]);
    const { result } = renderHook(
      () => useContactDuplicateSuggestion('c1', 'patient'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.selected?.id).toBe('match'));
  });

  it('returns undefined selected when no suggestion involves the contact', async () => {
    mockFetchOk([makeSuggestion({ leftId: 'other1', rightId: 'other2' })]);
    const { result } = renderHook(
      () => useContactDuplicateSuggestion('c1', 'patient'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.selected).toBeUndefined();
  });

  it('returns empty selected when the duplicate list is empty', async () => {
    mockFetchOk([]);
    const { result } = renderHook(
      () => useContactDuplicateSuggestion('c1', 'patient'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.selected).toBeUndefined();
  });

  it('unwraps data when the response is wrapped in { data: [...] }', async () => {
    mockFetchOk({ data: [makeSuggestion({ id: 'wrapped' })] });
    const { result } = renderHook(
      () => useContactDuplicateSuggestion('c1', 'patient'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.selected?.id).toBe('wrapped'));
  });

  it('propagates the error when the underlying fetch fails', async () => {
    mockFetchNotOk();
    const { result } = renderHook(
      () => useContactDuplicateSuggestion('c1', 'patient'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.selected).toBeUndefined();
  });

  it('forwards the contactType as owner_type to the duplicates endpoint', async () => {
    mockFetchOk([]);
    renderHook(
      () => useContactDuplicateSuggestion('c1', 'lead'),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const url = (global.fetch as jest.Mock).mock.calls[0][0];
    expect(url).toContain('owner_type=lead');
  });
});