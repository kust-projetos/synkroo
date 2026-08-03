/**
 * @jest-environment jsdom
 *
 * Updated for Task 6: DuplicateQueuePanel agora busca via
 * useDuplicateSuggestions (não array literal `suggestions` prop).
 */
import { render, screen, waitFor } from '@testing-library/react';
import { DuplicateQueuePanel } from '@/components/contacts/duplicate-queue-panel';

const mockUseDuplicateSuggestions = jest.fn();

jest.mock('@/lib/hooks/use-queries', () => ({
  useDuplicateSuggestions: (...args: unknown[]) =>
    mockUseDuplicateSuggestions(...args),
}));

const fixture = {
  id: 's1',
  clinicId: 'c1',
  ownerType: 'patient',
  leftId: 'l1',
  rightId: 'r1',
  status: 'pending',
  confidence: 'high',
  duplicateScore: 85,
  signals: {},
  leftSnapshot: { id: 'l1', name: 'Alice' },
  rightSnapshot: { id: 'r1', name: 'Bob' },
  winnerSuggestedId: 'l1',
  winnerConfirmedId: null,
  dismissReason: null,
  detectedAt: new Date('2026-01-10'),
  refreshedAt: new Date('2026-01-10'),
  createdAt: new Date('2026-01-10'),
  updatedAt: new Date('2026-01-10'),
};

describe('DuplicateQueuePanel (Task 6 — useDuplicateSuggestions)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('chama useDuplicateSuggestions com { status: pending }', () => {
    mockUseDuplicateSuggestions.mockReturnValue({ data: [], isLoading: false });
    render(<DuplicateQueuePanel />);
    expect(mockUseDuplicateSuggestions).toHaveBeenCalledWith({ status: 'pending' });
  });

  it('renderiza lista quando o hook retorna sugestões', async () => {
    mockUseDuplicateSuggestions.mockReturnValue({ data: [fixture], isLoading: false });
    render(<DuplicateQueuePanel />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('85')).toBeInTheDocument();
    });
  });

  it('mostra empty state quando hook retorna lista vazia', () => {
    mockUseDuplicateSuggestions.mockReturnValue({ data: [], isLoading: false });
    render(<DuplicateQueuePanel />);
    expect(screen.getByText(/Possíveis duplicidades/i)).toBeInTheDocument();
  });

  it('mostra loading skeleton quando isLoading é true', () => {
    mockUseDuplicateSuggestions.mockReturnValue({ data: [], isLoading: true });
    const { container } = render(<DuplicateQueuePanel />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renderiza múltiplas sugestões', async () => {
    const s2 = { ...fixture, id: 's2', leftSnapshot: { id: 'l2', name: 'Charlie' }, rightSnapshot: { id: 'r2', name: 'Diana' } };
    mockUseDuplicateSuggestions.mockReturnValue({ data: [fixture, s2], isLoading: false });
    render(<DuplicateQueuePanel />);
    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('Diana')).toBeInTheDocument();
    });
  });

  it('dispara onSelect quando uma sugestão é clicada', async () => {
    mockUseDuplicateSuggestions.mockReturnValue({ data: [fixture], isLoading: false });
    const onSelect = jest.fn();
    render(<DuplicateQueuePanel onSelect={onSelect} />);
    const btn = await screen.findByRole('button', { name: /Alice.*Bob/i });
    btn.click();
    expect(onSelect).toHaveBeenCalledWith('s1');
  });
});