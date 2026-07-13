/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { DuplicateTab } from '@/components/contacts/duplicate-tab';

const baseSuggestion = {
  id: 's1',
  ownerType: 'patient',
  duplicateScore: 85,
  confidence: 'high',
  status: 'pending',
  winnerSuggestedId: null,
  leftSnapshot: { id: 'l1', name: 'Alice' },
  rightSnapshot: { id: 'r1', name: 'Bob' },
  signals: {},
  detectedAt: new Date('2026-01-10'),
};

describe('DuplicateTab', () => {
  it('renders suggestion details with score and status', () => {
    render(<DuplicateTab suggestion={baseSuggestion} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText(/Score:/)).toBeInTheDocument();
  });

  it('shows blocked alert when document conflict exists', () => {
    render(<DuplicateTab suggestion={{
      ...baseSuggestion,
      leftSnapshot: { id: 'l1', name: 'Alice', document: '111.111.111-11' },
      rightSnapshot: { id: 'r1', name: 'Bob', document: '222.222.222-22' },
    }} />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('shows approve button for pending suggestion', () => {
    render(<DuplicateTab suggestion={baseSuggestion} />);
    expect(screen.getByText('Aprovar')).toBeInTheDocument();
  });

  it('shows merge button for approved suggestion without doc conflict', () => {
    render(<DuplicateTab suggestion={{ ...baseSuggestion, status: 'approved' }} />);
    expect(screen.getByText('Mesclar')).toBeInTheDocument();
  });

  it('hides approve button for merged suggestion', () => {
    render(<DuplicateTab suggestion={{ ...baseSuggestion, status: 'merged' }} />);
    expect(screen.queryByText('Aprovar')).not.toBeInTheDocument();
  });

  it('renders nothing when suggestion is null', () => {
    const { container } = render(<DuplicateTab suggestion={null} />);
    expect(container.innerHTML).toBe('');
  });
});
