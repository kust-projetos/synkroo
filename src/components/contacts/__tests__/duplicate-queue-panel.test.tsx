/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { DuplicateQueuePanel } from '@/components/contacts/duplicate-queue-panel';
import { DuplicateTab } from '@/components/contacts/duplicate-tab';

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

describe('DuplicateQueuePanel', () => {
  it('renders a list of duplicate suggestions', () => {
    render(<DuplicateQueuePanel suggestions={[fixture]} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('shows empty state when no suggestions', () => {
    render(<DuplicateQueuePanel suggestions={[]} />);
    expect(screen.getByText(/Possíveis duplicidades/i)).toBeInTheDocument();
  });
});

describe('DuplicateTab', () => {
  it('renders suggestion details', () => {
    render(<DuplicateTab suggestion={fixture} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows blocked state when document conflict exists', () => {
    render(<DuplicateTab suggestion={{
      ...fixture,
      leftSnapshot: { id: 'l1', name: 'Alice', document: '111.111.111-11' },
      rightSnapshot: { id: 'r1', name: 'Bob', document: '222.222.222-22' },
    }} />);
    expect(screen.getByText(/documento/i)).toBeInTheDocument();
  });

  it('renders null when no suggestion', () => {
    const { container } = render(<DuplicateTab suggestion={null} />);
    expect(container.innerHTML).toBe('');
  });
});
