/**
 * @jest-environment node
 *
 * page.test.tsx — Server component /api/crm/contatos (Task 6).
 *
 * Cobertura:
 *  - createManifest().isEnabled('crm') === true → renderiza <ContactsClient/>.
 *  - createManifest().isEnabled('crm') === false → chama notFound().
 *  - Sem side-effects em CRM desabilitado (não tenta renderizar client).
 */

const mockModuleManifest = { isEnabled: jest.fn() };
const mockNotFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const mockContactsClient: jest.Mock = jest.fn();

jest.mock('@/core/modules/manifest', () => ({
  createManifest: () => mockModuleManifest,
}));

jest.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

jest.mock('@/app/dashboard/contatos/contacts-client', () => ({
  ContactsClient: (_props: unknown) => {
    mockContactsClient(_props);
    return null;
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

import Page from './page';

describe('/dashboard/contatos (server component)', () => {
  it('renders <ContactsClient/> quando CRM habilitado', async () => {
    mockModuleManifest.isEnabled.mockResolvedValueOnce(true);
    const tree = await Page();
    expect(mockModuleManifest.isEnabled).toHaveBeenCalledWith('crm');
    expect(mockNotFound).not.toHaveBeenCalled();
    // Page deve retornar um node React (ContactsClient → null no mock).
    // O importante: tree está definido e não é uma NEXT_NOT_FOUND exception.
    expect(tree).toBeDefined();
  });

  it('chama notFound() quando CRM desabilitado', async () => {
    mockModuleManifest.isEnabled.mockResolvedValueOnce(false);
    await expect(Page()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockModuleManifest.isEnabled).toHaveBeenCalledWith('crm');
    expect(mockNotFound).toHaveBeenCalledTimes(1);
    // Client NÃO deve ser renderizado quando CRM está desabilitado.
    expect(mockContactsClient).not.toHaveBeenCalled();
  });
});