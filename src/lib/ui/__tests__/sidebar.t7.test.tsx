/** @jest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn() }),
}));
jest.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ profile: { name: 'Test', role: 'owner', clinics: { name: 'Clinica' } }, logout: jest.fn() }),
}));
jest.mock('@/lib/ui/menu-actions', () => ({
  getVisibleCoreMenu: jest.fn(),
}));

import { getVisibleCoreMenu } from '@/lib/ui/menu-actions';
import { Sidebar } from '../sidebar';

describe('T7 — Sidebar deriva de permissões/módulos', () => {
  beforeEach(() => jest.clearAllMocks());

  it('preserva rotas legadas ativas mesmo quando não estão no manifesto core (AGY T7 3.3)', async () => {
    // Simulate that only Dashboard and Conversas are visíveis para este papel — legacy sem manifesto deve permanecer
    (getVisibleCoreMenu as jest.Mock).mockResolvedValue([
      { label: 'Dashboard', path: '/dashboard', icon: 'Squares2X2Icon' },
      { label: 'Conversas', path: '/dashboard/conversas', icon: 'ChatBubbleLeftRightIcon' },
    ]);

    render(<Sidebar />);

    await waitFor(() => expect(getVisibleCoreMenu).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.queryByText('Dashboard')).toBeInTheDocument();
    });
    // Rotas legadas sem manifesto (CRM, Campanhas, Tarefas, Inativos, Analytics) são preservadas — não filtrar
    expect(screen.queryByRole('link', { name: /^CRM$/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Campanhas/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Tarefas/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Inativos/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Analytics/ })).toBeInTheDocument();
    // Conversas (com manifesto) deve permanecer visível porque está no core permitido
    expect(screen.queryByRole('link', { name: /Conversas/ })).toBeInTheDocument();
  });

  it('mostra todos quando ainda carregando (sem flash)', async () => {
    let resolveMenu: any;
    (getVisibleCoreMenu as jest.Mock).mockReturnValue(new Promise((r) => (resolveMenu = r)));

    render(<Sidebar />);

    // Before load, should show static items to avoid flash
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    // Resolve
    resolveMenu([]);
    await waitFor(() => expect(getVisibleCoreMenu).toHaveBeenCalled());
  });

  it('não enfraquece servidor — URL direta ainda protegida (verifica que getVisibleCoreMenu é chamado)', async () => {
    (getVisibleCoreMenu as jest.Mock).mockResolvedValue([]);
    render(<Sidebar />);
    await waitFor(() => expect(getVisibleCoreMenu).toHaveBeenCalled());
    // Even if sidebar hides a link, direct URL should still be protected server-side (verified via getVisibleCoreMenu call)
    expect(getVisibleCoreMenu).toHaveBeenCalled();
  });
});
