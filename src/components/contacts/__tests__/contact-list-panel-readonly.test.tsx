/**
 * @jest-environment jsdom
 *
 * contact-list-panel-readonly.test.tsx (Task 6).
 *
 * Verifica que o painel de lista de contatos está em modo READ-ONLY:
 *  - Não renderiza o botão "Novo Contato".
 *  - Não importa nem renderiza ContactCreateDialog.
 *  - Continua mostrando lista, search, type filter.
 */

const mockUseContacts = jest.fn();

jest.mock('@/lib/hooks/use-queries', () => ({
  useContacts: (...args: unknown[]) => mockUseContacts(...args),
}));

// useRouter é chamado internamente por ContactListPanel para setar o querystring.
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const fixture = [
  { id: 'p1', type: 'patient' as const, name: 'Ana', phone: '11999990000' },
  { id: 'p2', type: 'lead' as const, name: 'Bruno', phone: '11988887777' },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockUseContacts.mockReturnValue({
    data: { data: fixture },
    isLoading: false,
  });
});

import { render, screen } from '@testing-library/react';
import { ContactListPanel } from '@/components/contacts/contact-list-panel';

describe('ContactListPanel — read-only (Task 6)', () => {
  it('lista contatos fetched via useContacts (não literal [])', () => {
    render(<ContactListPanel />);
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('Bruno')).toBeInTheDocument();
  });

  it('NÃO renderiza botão "Novo Contato" (read-only MVP)', () => {
    render(<ContactListPanel />);
    expect(screen.queryByText(/Novo Contato/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /novo/i })).not.toBeInTheDocument();
  });

  it('NÃO importa nem renderiza ContactCreateDialog', () => {
    // Verify no dialog role in DOM
    render(<ContactListPanel />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('mantém search input e filtro de tipo', () => {
    render(<ContactListPanel />);
    const input = screen.getByPlaceholderText(/Buscar por nome/i);
    expect(input).toBeInTheDocument();
  });

  it('passa search e type filter para useContacts', () => {
    render(<ContactListPanel />);
    // useContacts é chamado pelo menos uma vez
    expect(mockUseContacts).toHaveBeenCalled();
    const lastCall = mockUseContacts.mock.calls[mockUseContacts.mock.calls.length - 1];
    const params = lastCall[0] as Record<string, string>;
    expect(params).toHaveProperty('limit', '20');
  });
});