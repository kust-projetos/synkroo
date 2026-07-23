/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react';
import { DuplicateQueuePanel } from '@/components/contacts/duplicate-queue-panel';

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

  it('shows empty title when no suggestions', () => {
    render(<DuplicateQueuePanel suggestions={[]} />);
    expect(screen.getByText(/Possíveis duplicidades/i)).toBeInTheDocument();
  });

  it('shows loading skeleton when isLoading is true', () => {
    const { container } = render(<DuplicateQueuePanel suggestions={[]} isLoading={true} />);
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders multiple suggestions', () => {
    const s2 = { ...fixture, id: 's2', leftSnapshot: { id: 'l2', name: 'Charlie' }, rightSnapshot: { id: 'r2', name: 'Diana' } };
    render(<DuplicateQueuePanel suggestions={[fixture, s2]} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('Charlie')).toBeInTheDocument();
    expect(screen.getByText('Diana')).toBeInTheDocument();
  });

  it('fires onSelect when a suggestion is clicked', () => {
    const onSelect = jest.fn();
    render(<DuplicateQueuePanel suggestions={[fixture]} onSelect={onSelect} />);
    screen.getByRole('button', { name: /Alice.*Bob/i }).click();
    expect(onSelect).toHaveBeenCalledWith('s1');
  });
});
