import { NextRequest } from 'next/server';

jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }));
import { validateApiAuth } from '@/lib/auth/session';

jest.mock('@/lib/db/client', () => ({ getDb: jest.fn() }));
import { getDb } from '@/lib/db/client';

import { PUT } from '../settings';
import { clinics } from '@/lib/db/schema';

describe('T5 — PUT /api/clinics/settings preserves unknown keys (server-side merge)', () => {
  const clinicId = 'clinic-1';
  let capturedUpdate: any = null;
  let existingSettings: Record<string, unknown> = {};

  function mockDbWithExisting(settings: Record<string, unknown>) {
    existingSettings = settings;
    const mockDb: any = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue(Promise.resolve([{ id: clinicId, name: 'Clinica', phone: '119999', email: 'a@b.com', settings, timezone: 'America/Sao_Paulo' }])),
        }),
      }),
      update: jest.fn().mockReturnValue({
        set: jest.fn().mockImplementation((data: any) => {
          capturedUpdate = data;
          return {
            where: jest.fn().mockResolvedValue(undefined),
          };
        }),
      }),
    };
    (getDb as jest.Mock).mockReturnValue(mockDb);
    return mockDb;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    capturedUpdate = null;
    (validateApiAuth as jest.Mock).mockResolvedValue({ success: true, profile: { clinic_id: clinicId } });
  });

  it('preserves whatsapp_phone_number_id when updating appointment_durations', async () => {
    mockDbWithExisting({ whatsapp_phone_number_id: '12345', existing_key: 'keep-me', appointment_durations: [30] });

    const req = new NextRequest('http://localhost/api/clinics/settings', {
      method: 'PUT',
      body: JSON.stringify({ appointment_durations: [60] }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(200);
    expect(capturedUpdate).toBeDefined();
    expect(capturedUpdate.settings).toEqual({
      whatsapp_phone_number_id: '12345',
      existing_key: 'keep-me',
      appointment_durations: [60],
    });
    expect(capturedUpdate.settings.whatsapp_phone_number_id).toBe('12345');
  });

  it('preserves unknown keys when updating settings with new field', async () => {
    mockDbWithExisting({ whatsapp_phone_number_id: '999', custom_meta: { foo: 'bar' } });

    const req = new NextRequest('http://localhost/api/clinics/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: { new_field: 'new_value' } }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(200);
    expect(capturedUpdate.settings).toEqual({
      whatsapp_phone_number_id: '999',
      custom_meta: { foo: 'bar' },
      new_field: 'new_value',
    });
  });

  it('does not overwrite settings when only top-level fields sent', async () => {
    mockDbWithExisting({ whatsapp_phone_number_id: 'keep', appointment_durations: [30] });

    const req = new NextRequest('http://localhost/api/clinics/settings', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New Name' }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(200);
    // Should have name but not touch settings
    expect(capturedUpdate.name).toBe('New Name');
    expect(capturedUpdate.settings).toBeUndefined();
  });

  it('merges settings and appointment_durations without losing existing', async () => {
    mockDbWithExisting({ whatsapp_phone_number_id: 'wid-1', appointment_durations: [15, 30] });

    const req = new NextRequest('http://localhost/api/clinics/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings: { instagram_account_id: 'ig-1' }, appointment_durations: [45] }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(200);
    expect(capturedUpdate.settings).toEqual({
      whatsapp_phone_number_id: 'wid-1',
      instagram_account_id: 'ig-1',
      appointment_durations: [45],
    });
  });
});
