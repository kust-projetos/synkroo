/**
 * @jest-environment node
 *
 * page.test.tsx — Server component /dashboard/financeiro (Task 7).
 *
 * Cobertura:
 *  - moduleManifest.isEnabled('financeiro') === true → renderiza <FinanceiroDashboardClient/>.
 *  - moduleManifest.isEnabled('financeiro') === false → chama notFound().
 */

const mockModuleManifest = { isEnabled: jest.fn() };
const mockNotFound = jest.fn(() => { throw new Error('NEXT_NOT_FOUND'); });

jest.mock('@/core/modules/manifest', () => ({
  moduleManifest: mockModuleManifest,
}));

jest.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}));

jest.mock('@/app/dashboard/financeiro/financeiro-client', () => ({
  FinanceiroDashboardClient: () => null,
}));

beforeEach(() => { jest.clearAllMocks(); });

import FinanceiroDashboardPage from './page';

describe('/dashboard/financeiro (server component)', () => {
  it('renderiza <FinanceiroDashboardClient/> quando financeiro habilitado', async () => {
    mockModuleManifest.isEnabled.mockResolvedValueOnce(true);
    const tree = await FinanceiroDashboardPage();
    expect(mockModuleManifest.isEnabled).toHaveBeenCalledWith('financeiro');
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(tree).toBeDefined();
  });

  it('chama notFound() quando financeiro desabilitado', async () => {
    mockModuleManifest.isEnabled.mockResolvedValueOnce(false);
    await expect(FinanceiroDashboardPage()).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockModuleManifest.isEnabled).toHaveBeenCalledWith('financeiro');
    expect(mockNotFound).toHaveBeenCalledTimes(1);
  });
});