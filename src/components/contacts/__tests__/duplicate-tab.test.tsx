/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { DuplicateTab } from '@/components/contacts/duplicate-tab';

jest.mock('@/lib/hooks/use-queries', () => ({
  useContactDuplicateSuggestion: jest.fn(),
}));

import { useContactDuplicateSuggestion } from '@/lib/hooks/use-queries';

const baseSuggestion = {
  id: 's1',
  ownerType: 'patient',
  leftId: 'l1',
  rightId: 'r1',
  duplicateScore: 85,
  confidence: 'high',
  status: 'pending',
  winnerSuggestedId: null,
  leftSnapshot: { id: 'l1', name: 'Alice' },
  rightSnapshot: { id: 'r1', name: 'Bob' },
  signals: {},
  detectedAt: new Date('2026-01-10'),
};

function mockState(state: { selected?: any; isLoading?: boolean; error?: unknown }) {
  (useContactDuplicateSuggestion as jest.Mock).mockReturnValue({
    selected: state.selected ?? undefined,
    isLoading: state.isLoading ?? false,
    error: state.error ?? null,
  });
}

describe('DuplicateTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the selected suggestion (loaded) with score and status', () => {
    mockState({ selected: baseSuggestion });
    render(<DuplicateTab contactId="l1" contactType="patient" />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText(/Score:/)).toBeInTheDocument();
  });

  it('shows an empty state when no suggestion is found (empty)', () => {
    mockState({ selected: undefined });
    render(<DuplicateTab contactId="l1" contactType="patient" />);
    expect(screen.getByText('Sem duplicidades')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('shows an error message when the query fails (error)', () => {
    mockState({ selected: undefined, error: new Error('boom') });
    render(<DuplicateTab contactId="l1" contactType="patient" />);
    expect(screen.getByRole('alert')).toHaveTextContent(/Erro ao carregar duplicidades/i);
  });

  it('shows a loading skeleton while loading', () => {
    mockState({ selected: undefined, isLoading: true });
    const { container } = render(<DuplicateTab contactId="l1" contactType="patient" />);
    expect(container.querySelector('.animate-pulse, [class*="skeleton"], [class*="Skeleton"]')).toBeInTheDocument();
    expect(screen.queryByText('Alice')).not.toBeInTheDocument();
  });

  it('shows blocked alert when document conflict exists', () => {
    mockState({
      selected: {
        ...baseSuggestion,
        leftSnapshot: { id: 'l1', name: 'Alice', document: '111.111.111-11' },
        rightSnapshot: { id: 'r1', name: 'Bob', document: '222.222.222-22' },
      },
    });
    render(<DuplicateTab contactId="l1" contactType="patient" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows approve button for pending suggestion', () => {
    mockState({ selected: baseSuggestion });
    render(<DuplicateTab contactId="l1" contactType="patient" />);
    expect(screen.getByText('Aprovar')).toBeInTheDocument();
  });

  it('shows merge button for approved suggestion without doc conflict', () => {
    mockState({ selected: { ...baseSuggestion, status: 'approved' } });
    render(<DuplicateTab contactId="l1" contactType="patient" />);
    expect(screen.getByText('Mesclar')).toBeInTheDocument();
  });

  it('hides approve button for merged suggestion', () => {
    mockState({ selected: { ...baseSuggestion, status: 'merged' } });
    render(<DuplicateTab contactId="l1" contactType="patient" />);
    expect(screen.queryByText('Aprovar')).not.toBeInTheDocument();
  });
});
