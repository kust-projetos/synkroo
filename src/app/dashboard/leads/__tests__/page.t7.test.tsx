/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockSearchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: jest.fn() }),
}));
jest.mock('@/lib/auth/context', () => ({
  useAuth: () => ({ profile: { clinic_id: 'clinic-1' } }),
}));
jest.mock('@/lib/hooks/use-queries', () => ({
  useLeads: jest.fn((params: any) => ({ data: { leads: [{ id: '1', name: 'Hot Lead', temperature: 'hot', status: 'new', phone: '119', source: 'whatsapp', score: 90 }] }, isLoading: false, error: null, refetch: jest.fn() })),
  useLeadStats: jest.fn(() => ({ data: { total: 1, byStatus: { new: 1 }, byTemperature: { hot: 1 } } })),
  useLeadNotifications: jest.fn(() => ({ data: { notifications: [] }, refetch: jest.fn() })),
}));

import LeadsPage from '../page';
import { useLeads } from '@/lib/hooks/use-queries';

describe('T7 — Leads ?filter=hot', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient();
    jest.clearAllMocks();
    mockSearchParams.delete('filter');
  });

  it('aplica filtro hot quando ?filter=hot está presente', async () => {
    mockSearchParams.set('filter', 'hot');
    render(
      <QueryClientProvider client={queryClient}>
        <LeadsPage />
      </QueryClientProvider>
    );
    // Wait for the leads to be filtered - the hook should have been called with temperature=hot
    await new Promise((r) => setTimeout(r, 100));
    expect(useLeads).toHaveBeenCalledWith(expect.objectContaining({ temperature: 'hot' }));
  });

  it('não aplica filtro hot quando ausente', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <LeadsPage />
      </QueryClientProvider>
    );
    await new Promise((r) => setTimeout(r, 100));
    // Should be called without temperature filter or with 'all'
    const calls = (useLeads as jest.Mock).mock.calls;
    const lastCall = calls[calls.length - 1][0];
    expect(lastCall.temperature).toBeUndefined();
  });
});
