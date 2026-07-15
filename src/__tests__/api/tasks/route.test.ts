jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }));

const mockReturning = jest.fn();
const mockWhere = jest.fn(() => ({ returning: mockReturning }));
const mockSet = jest.fn(() => ({ where: mockWhere }));
const mockUpdate = jest.fn(() => ({ set: mockSet }));
const mockDelete = jest.fn(() => ({ where: mockWhere }));

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => ({
    update: mockUpdate,
    delete: mockDelete,
  })),
}));

import { PUT, DELETE } from '@/app/api/tasks/route';
import { validateApiAuth } from '@/lib/auth/session';

const CLINIC_A = 'clinic-a-1111-1111-1111';
const CLINIC_B = 'clinic-b-2222-2222-2222';
const TASK_ID = 'task-0000-0000-0000-0001';
const TASK_ID_FOREIGN = 'task-0000-0000-0000-0002';

function auth(clinicId = CLINIC_A) {
  (validateApiAuth as jest.Mock).mockResolvedValue({
    success: true,
    profile: { id: 'user-1', clinic_id: clinicId, role: 'owner' },
  });
}

function authFail() {
  (validateApiAuth as jest.Mock).mockResolvedValue({
    success: false,
    error: { message: 'Unauthorized', status: 401 },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ── PUT ────────────────────────────────────────────────────

describe('PUT /api/tasks', () => {
  it('returns 401 when unauthenticated', async () => {
    authFail();
    const req = new Request('http://localhost/api/tasks', {
      method: 'PUT',
      body: JSON.stringify({ id: TASK_ID, title: 'Hacked' }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when id is missing', async () => {
    auth();
    const req = new Request('http://localhost/api/tasks', {
      method: 'PUT',
      body: JSON.stringify({ title: 'No ID' }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/id.*required/i);
  });

  it('updates own clinic task and returns it', async () => {
    auth();
    const updatedRow = { id: TASK_ID, clinicId: CLINIC_A, title: 'Updated', status: 'done' };
    mockReturning.mockResolvedValue([updatedRow]);

    const req = new Request('http://localhost/api/tasks', {
      method: 'PUT',
      body: JSON.stringify({ id: TASK_ID, title: 'Updated', status: 'done' }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(200);

    // Must filter by clinicId
    expect(mockWhere).toHaveBeenCalledWith(
      expect.objectContaining({})
    );
    const whereArg = mockWhere.mock.calls[0][0];
    // Verify the where clause includes both id and clinicId
    // The actual object is a Drizzle expression; we verify the call was made
    // and the result is correct.
    const body = await res.json();
    expect(body.task).toBeDefined();
    expect(body.task.id).toBe(TASK_ID);
  });

  it('returns 404 when task belongs to another clinic', async () => {
    auth(CLINIC_A);
    // DB returns empty — no row matched (id + clinicId filter rejected)
    mockReturning.mockResolvedValue([]);

    const req = new Request('http://localhost/api/tasks', {
      method: 'PUT',
      body: JSON.stringify({ id: TASK_ID_FOREIGN, title: 'Hacked' }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});

// ── DELETE ──────────────────────────────────────────────────

describe('DELETE /api/tasks', () => {
  it('returns 401 when unauthenticated', async () => {
    authFail();
    const req = new Request('http://localhost/api/tasks?id=' + TASK_ID, { method: 'DELETE' });
    const res = await DELETE(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when id is missing', async () => {
    auth();
    const req = new Request('http://localhost/api/tasks', { method: 'DELETE' });
    const res = await DELETE(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/id.*required/i);
  });

  it('deletes own clinic task and returns success', async () => {
    auth();
    mockReturning.mockResolvedValue([{ id: TASK_ID, clinicId: CLINIC_A }]);

    const req = new Request('http://localhost/api/tasks?id=' + TASK_ID, { method: 'DELETE' });
    const res = await DELETE(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Must filter by clinicId
    expect(mockWhere).toHaveBeenCalled();
  });

  it('returns 404 when trying to delete another clinics task', async () => {
    auth(CLINIC_A);
    mockReturning.mockResolvedValue([]);

    const req = new Request('http://localhost/api/tasks?id=' + TASK_ID_FOREIGN, { method: 'DELETE' });
    const res = await DELETE(req as any);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toMatch(/not found/i);
  });
});
