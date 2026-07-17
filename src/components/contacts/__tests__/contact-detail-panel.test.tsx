/**
 * @jest-environment jsdom
 *
 * Direct end-to-end test for the ContactDetailPanel Duplicados tab wiring.
 *
 * Strategy (no new dependencies):
 * - Mock the Radix `@/components/ui/tabs` primitive to a simple controlled
 *   implementation so a plain `fireEvent.click` on a TabsTrigger calls the
 *   panel's `onValueChange` (Radix in jsdom doesn't react to synthetic clicks
 *   without `user-event`). This lets us switch from the default 'info' tab
 *   to the 'duplicados' tab and exercise the panel's new
 *   `<DuplicateTab contactId contactType .../>` JSX.
 * - Mock the panel's data hooks and sibling tab components so the default
 *   'info' tab renders cleanly, and `useContactDuplicateSuggestion` is
 *   controlled to drive DuplicateTab's loaded/empty/error states.
 * - Leave DuplicateTab real so the assertion proves the panel passes the
 *   real contact id/type to it (and DuplicateTab calls the real mocked hook).
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('@/components/ui/tabs', () => {
  const Tabs = ({ value, onValueChange, children }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'tabs', 'data-value': value },
      React.Children.map(children, (child: any) =>
        React.isValidElement(child)
          // The custom __active/__setActive props cannot be expressed in
          // React.cloneElement's overload (props are constrained to the
          // element's known props), so a local `as any` is required.
          ? React.cloneElement(child, { __active: value, __setActive: onValueChange } as any)
          : child,
      ),
    );
  const TabsList = ({ children, __active, __setActive }: any) =>
    React.createElement(
      'div',
      { role: 'tablist' },
      React.Children.map(children, (child: any) =>
        React.isValidElement(child)
          ? React.cloneElement(child, { __active, __setActive } as any)
          : child,
      ),
    );
  const TabsTrigger = ({ value, __active, __setActive, children }: any) =>
    React.createElement(
      'button',
      {
        role: 'tab',
        'aria-selected': __active === value,
        onClick: () => __setActive && __setActive(value),
      },
      children,
    );
  const TabsContent = ({ value, __active, children }: any) =>
    __active === value ? React.createElement('div', null, children) : null;
  return { Tabs, TabsList, TabsTrigger, TabsContent };
});

jest.mock('@/lib/hooks/use-queries', () => ({
  useContact: jest.fn(),
  useContactNotes: jest.fn(),
  useLeadsByPatient: jest.fn(),
  useContactDuplicateSuggestion: jest.fn(),
}));

jest.mock('@tanstack/react-query', () => {
  const actual = jest.requireActual('@tanstack/react-query');
  return {
    ...actual,
    useMutation: jest.fn(() => ({ mutate: jest.fn(), isLoading: false, isError: false })),
    useQueryClient: jest.fn(() => ({ invalidateQueries: jest.fn() })),
  };
});

jest.mock('@/components/contacts/contact-timeline-tab', () => ({
  ContactTimelineTab: () => <div data-testid="stub-timeline" />,
}));
jest.mock('@/components/contacts/contact-notes-tab', () => ({
  ContactNotesTab: () => <div data-testid="stub-notes" />,
}));
jest.mock('@/components/contacts/contact-custom-fields-tab', () => ({
  ContactCustomFieldsTab: () => <div data-testid="stub-custom" />,
}));
jest.mock('@/components/contacts/contact-financial-tab', () => ({
  ContactFinancialTab: () => <div data-testid="stub-financial" />,
}));
jest.mock('@/components/contacts/consent-section', () => ({
  ConsentSection: () => <div data-testid="stub-consent" />,
}));

import {
  useContact,
  useContactNotes,
  useLeadsByPatient,
  useContactDuplicateSuggestion,
} from '@/lib/hooks/use-queries';
import { ContactDetailPanel } from '@/components/contacts/contact-detail-panel';

const baseContact = {
  id: 'c1',
  name: 'Alice',
  phone: '11999990000',
  email: null,
  type: 'patient',
  status: 'active',
  tags: [],
};

const baseSuggestion = {
  id: 's1',
  ownerType: 'patient',
  leftId: 'c1',
  rightId: 'c2',
  duplicateScore: 85,
  confidence: 'high',
  status: 'pending',
  winnerSuggestedId: null,
  leftSnapshot: { id: 'c1', name: 'Alice' },
  rightSnapshot: { id: 'c2', name: 'Bob' },
  signals: {},
  detectedAt: new Date('2026-01-10'),
};

function setupPanel(duplicatesState: {
  selected?: any;
  isLoading?: boolean;
  error?: unknown;
} = {}) {
  (useContact as jest.Mock).mockReturnValue({
    data: baseContact,
    isLoading: false,
    error: null,
  });
  (useContactNotes as jest.Mock).mockReturnValue({ data: null });
  (useLeadsByPatient as jest.Mock).mockReturnValue({ data: null, isLoading: false });
  (useContactDuplicateSuggestion as jest.Mock).mockReturnValue({
    selected: baseSuggestion,
    isLoading: false,
    error: null,
    ...duplicatesState,
  });
}

describe('ContactDetailPanel Duplicados tab wiring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('passes the real contact id and type to the duplicates query and renders the loaded suggestion', () => {
    setupPanel();
    render(<ContactDetailPanel contactId="c1" contactType="patient" />);

    fireEvent.click(screen.getByRole('tab', { name: /Duplicados/i }));

    expect(useContactDuplicateSuggestion).toHaveBeenCalledWith('c1', 'patient');
    // DuplicateTab's CardTitle + the rightSnapshot.name (unique to the tab).
    expect(screen.getByText('Comparação de duplicidade')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('renders the empty state when no duplicate involves the contact', () => {
    setupPanel({ selected: undefined });
    render(<ContactDetailPanel contactId="c1" contactType="patient" />);

    fireEvent.click(screen.getByRole('tab', { name: /Duplicados/i }));

    expect(useContactDuplicateSuggestion).toHaveBeenCalledWith('c1', 'patient');
    expect(screen.getByText('Sem duplicidades')).toBeInTheDocument();
  });

  it('renders the error state when the duplicates query fails', () => {
    setupPanel({ selected: undefined, error: new Error('boom') });
    render(<ContactDetailPanel contactId="c1" contactType="patient" />);

    fireEvent.click(screen.getByRole('tab', { name: /Duplicados/i }));

    expect(useContactDuplicateSuggestion).toHaveBeenCalledWith('c1', 'patient');
    expect(screen.getByRole('alert')).toHaveTextContent(/Erro ao carregar duplicidades/i);
  });
});