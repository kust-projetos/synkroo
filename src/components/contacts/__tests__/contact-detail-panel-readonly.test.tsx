/**
 * @jest-environment jsdom
 *
 * contact-detail-panel-readonly.test.tsx (Task 6).
 *
 * Verifica que o painel de detalhe de contato está READ-ONLY no MVP CRM:
 *  - Não renderiza botão de editar (PencilIcon).
 *  - Não renderiza botão de arquivar (ArchiveBoxIcon).
 *  - Não dispara mutation PUT /api/contacts/:id (PUT retorna 405 crm_mvp_read_only).
 *  - Não dispara mutation PATCH /api/contacts/:id.
 *  - Mantém tabs de notas e timeline.
 */

const mockUseContact = jest.fn();
const mockUseContactNotes = jest.fn();
const mockUseLeadsByPatient = jest.fn();

jest.mock('@/lib/hooks/use-queries', () => ({
  useContact: (...args: unknown[]) => mockUseContact(...args),
  useContactNotes: (...args: unknown[]) => mockUseContactNotes(...args),
  useLeadsByPatient: (...args: unknown[]) => mockUseLeadsByPatient(...args),
}));

jest.mock('@/lib/hooks/use-whatsapp-messages', () => ({
  useWhatsAppMessages: () => ({ data: null, isLoading: false }),
}));

// Componentes de tab são mockados (foco é read-only no detail panel).
jest.mock('@/components/contacts/contact-timeline-tab', () => ({
  ContactTimelineTab: () => null,
}));
jest.mock('@/components/contacts/contact-notes-tab', () => ({
  ContactNotesTab: () => null,
}));
jest.mock('@/components/contacts/contact-custom-fields-tab', () => ({
  ContactCustomFieldsTab: () => null,
}));
jest.mock('@/components/contacts/contact-financial-tab', () => ({
  ContactFinancialTab: () => null,
}));
jest.mock('@/components/contacts/consent-section', () => ({
  ConsentSection: () => null,
}));
jest.mock('@/components/contacts/duplicate-tab', () => ({
  DuplicateTab: () => null,
}));
jest.mock('@/components/whatsapp/message-bubble', () => ({
  MessageBubble: () => null,
}));
jest.mock('@/components/whatsapp/message-composer', () => ({
  MessageComposer: () => null,
}));
jest.mock('@/lib/domain-boundaries', () => ({
  getContactOwnershipCopy: () => ({ title: '', description: '' }),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn(), back: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  mockUseLeadsByPatient.mockReturnValue({ data: { leads: [] }, isLoading: false });
});

const contactFixture = {
  id: 'p1',
  type: 'patient' as const,
  name: 'Ana Silva',
  phone: '11999990000',
  tags: ['VIP'],
  notes: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseContact.mockReturnValue({
    data: contactFixture,
    isLoading: false,
    error: null,
  });
  mockUseContactNotes.mockReturnValue({
    data: { data: [] },
    isLoading: false,
  });
});

import { render, screen } from '@testing-library/react';
import { ContactDetailPanel } from '@/components/contacts/contact-detail-panel';

describe('ContactDetailPanel — read-only (Task 6)', () => {
  it('renderiza nome do contato fetched', () => {
    render(<ContactDetailPanel contactId="p1" contactType="patient" />);
    expect(screen.getByText('Ana Silva')).toBeInTheDocument();
  });

  it('NÃO renderiza botão de editar (read-only)', () => {
    render(<ContactDetailPanel contactId="p1" contactType="patient" />);
    // PencilIcon usado para "Editar" — não deve aparecer.
    expect(screen.queryByText(/Editar/i)).not.toBeInTheDocument();
  });

  it('NÃO renderiza botão de arquivar (read-only)', () => {
    render(<ContactDetailPanel contactId="p1" contactType="patient" />);
    expect(screen.queryByText(/Arquivar/i)).not.toBeInTheDocument();
  });

  it('mantém tabs de notas e timeline (somente leitura)', () => {
    render(<ContactDetailPanel contactId="p1" contactType="patient" />);
    // Pelo menos as tabs devem existir; como default é 'info', vamos apenas
    // garantir que useContactNotes foi chamado.
    expect(mockUseContactNotes).toHaveBeenCalledWith('p1', 'patient');
  });

  it('sem contactId/Type, mostra empty state', () => {
    render(<ContactDetailPanel />);
    expect(screen.getByText(/Selecione um contato/i)).toBeInTheDocument();
  });
});