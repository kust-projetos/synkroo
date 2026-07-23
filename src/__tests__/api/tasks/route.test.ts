jest.mock('@/lib/auth/session', () => ({ validateApiAuth: jest.fn() }));

// Query chain: select → from → leftJoin/where/orderBy → then
let mockOrderByReturn: Promise<unknown[]> = Promise.resolve([]);
const mockSelectQuery: {
  leftJoin: jest.Mock<typeof mockSelectQuery>;
  where: jest.Mock<typeof mockSelectQuery>;
  orderBy: jest.Mock<Promise<unknown[]>>;
} = {
  leftJoin: jest.fn(() => mockSelectQuery),
  where: jest.fn(() => mockSelectQuery),
  orderBy: jest.fn(() => mockOrderByReturn),
};
const mockSelectFn = jest.fn(() => ({ from: jest.fn(() => mockSelectQuery) }));

// Insert chain: insert → values → returning
const mockInsertReturning = jest.fn();
const mockInsert = jest.fn(() => ({ values: jest.fn(() => ({ returning: mockInsertReturning })) }));

// Update chain: update → set → where → returning
const mockUpdReturning = jest.fn();
const mockUpdWhere = jest.fn(() => ({ returning: mockUpdReturning }));
const mockUpdSet = jest.fn(() => ({ where: mockUpdWhere }));
const mockUpdate = jest.fn(() => ({ set: mockUpdSet }));

// Delete chain: delete → where → returning
const mockDelReturning = jest.fn();
const mockDelWhere = jest.fn(() => ({ returning: mockDelReturning }));
const mockDelete = jest.fn(() => ({ where: mockDelWhere }));

jest.mock('@/lib/db/client', () => ({
  getDb: jest.fn(() => ({
    select: mockSelectFn,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  })),
}));

import { GET, POST, PUT, DELETE } from '@/app/api/tasks/route';
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
  // Only clear mocks that need resetting (auth), not the query chain
  (validateApiAuth as jest.Mock).mockReset();
  mockInsertReturning.mockReset();
  mockUpdReturning.mockReset();
  mockDelReturning.mockReset();
});

// ── GET ────────────────────────────────────────

describe('GET /api/tasks', () => {
  it('returns 401 when unauthenticated', async () => {
    authFail();
    const req = new Request('http://localhost/api/tasks');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('returns tasks list', async () => {
    auth();
    const data = [{
      id: 't1', title: 'Task 1', description: null, dueDate: null,
      status: 'pending', priority: 'medium', leadId: null,
      leadName: null, createdAt: new Date(), updatedAt: new Date(),
    }];
    mockOrderByReturn = Promise.resolve(data);
    const req = new Request('http://localhost/api/tasks');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0].title).toBe('Task 1');
  });

  it('returns tasks with lead info', async () => {
    auth();
    const data = [{
      id: 't2', title: 'Task 2', description: 'desc', dueDate: new Date(),
      status: 'done', priority: 'low', leadId: 'lead-1',
      leadName: 'John Doe', createdAt: new Date(), updatedAt: new Date(),
    }];
    mockOrderByReturn = Promise.resolve(data);
    const req = new Request('http://localhost/api/tasks');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.tasks[0].leads).not.toBeNull();
    expect(body.tasks[0].leads.name).toBe('John Doe');
  });

  it('filters by status and priority', async () => {
    auth();
    mockOrderByReturn = Promise.resolve([]);
    const req = new Request('http://localhost/api/tasks?status=pending&priority=high');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('handles all status filter', async () => {
    auth();
    mockOrderByReturn = Promise.resolve([]);
    const req = new Request('http://localhost/api/tasks?status=all');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });

  it('filters by lead_id', async () => {
    auth();
    mockOrderByReturn = Promise.resolve([]);
    const req = new Request('http://localhost/api/tasks?lead_id=lead-123');
    const res = await GET(req as any);
    expect(res.status).toBe(200);
  });
});

// ── POST ───────────────────────────────────────

describe('POST /api/tasks', () => {
  it('returns 401 when unauthenticated', async () => {
    authFail();
    const req = new Request('http://localhost/api/tasks', {
      method: 'POST', body: JSON.stringify({ title: 'New Task' }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when title is missing', async () => {
    auth();
    const req = new Request('http://localhost/api/tasks', {
      method: 'POST', body: JSON.stringify({}),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('creates a task and returns 201', async () => {
    auth();
    mockInsertReturning.mockResolvedValue([{
      id: 'new-1', title: 'New Task', description: null, dueDate: null,
      status: 'pending', priority: 'medium', leadId: null, createdAt: new Date(),
    }]);
    const req = new Request('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'New Task', priority: 'high', due_date: '2026-08-15' }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.task.title).toBe('New Task');
  });

  it('creates a task with lead_id', async () => {
    auth();
    mockInsertReturning.mockResolvedValue([{
      id: 'new-2', title: 'Lead Task', description: null, dueDate: null,
      status: 'pending', priority: 'medium', leadId: 'lead-1', createdAt: new Date(),
    }]);
    const req = new Request('http://localhost/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ title: 'Lead Task', description: 'desc', lead_id: 'lead-1' }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(201);
  });
});

// ── PUT ────────────────────────────────────────

describe('PUT /api/tasks', () => {
  it('returns 401 when unauthenticated', async () => {
    authFail();
    const req = new Request('http://localhost/api/tasks', {
      method: 'PUT', body: JSON.stringify({ id: TASK_ID, title: 'Hacked' }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when id is missing', async () => {
    auth();
    const req = new Request('http://localhost/api/tasks', {
      method: 'PUT', body: JSON.stringify({ title: 'No ID' }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/id.*required/i);
  });

  it('updates own clinic task and returns it', async () => {
    auth();
    mockUpdReturning.mockResolvedValue([{ id: TASK_ID, clinicId: CLINIC_A, title: 'Updated', status: 'done' }]);
    const req = new Request('http://localhost/api/tasks', {
      method: 'PUT', body: JSON.stringify({ id: TASK_ID, title: 'Updated', status: 'done' }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.task.id).toBe(TASK_ID);
  });

  it('returns 404 when task belongs to another clinic', async () => {
    auth(CLINIC_A);
    mockUpdReturning.mockResolvedValue([]);
    const req = new Request('http://localhost/api/tasks', {
      method: 'PUT', body: JSON.stringify({ id: TASK_ID_FOREIGN, title: 'Hacked' }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(404);
  });

  it('ignores forged clinicId in PUT body and uses auth clinicId', async () => {
    auth(CLINIC_A);
    mockUpdReturning.mockResolvedValue([]);
    const req = new Request('http://localhost/api/tasks', {
      method: 'PUT',
      body: JSON.stringify({ clinicId: CLINIC_B, id: TASK_ID, title: 'Hacked via body' }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(404);
    // WHERE predicate must contain auth clinicId (CLINIC_A), not forged (CLINIC_B)
    const whereStr = require('util').inspect((mockUpdWhere as jest.Mock).mock.calls[0][0], { depth: 8 });
    expect(whereStr).toContain(CLINIC_A);
    expect(whereStr).not.toContain(CLINIC_B);
  });

  it('ignores forged clinicId in PUT query string and uses auth clinicId', async () => {
    auth(CLINIC_A);
    mockUpdReturning.mockResolvedValue([]);
    const req = new Request('http://localhost/api/tasks?clinicId=' + CLINIC_B, {
      method: 'PUT',
      body: JSON.stringify({ id: TASK_ID, title: 'Hacked via query' }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(404);
    const whereStr = require('util').inspect((mockUpdWhere as jest.Mock).mock.calls[0][0], { depth: 8 });
    expect(whereStr).toContain(CLINIC_A);
    expect(whereStr).not.toContain(CLINIC_B);
  });
});

// ── DELETE ─────────────────────────────────────

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
    mockDelReturning.mockResolvedValue([{ id: TASK_ID, clinicId: CLINIC_A }]);
    const req = new Request('http://localhost/api/tasks?id=' + TASK_ID, { method: 'DELETE' });
    const res = await DELETE(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 404 when trying to delete another clinics task', async () => {
    auth(CLINIC_A);
    mockDelReturning.mockResolvedValue([]);
    const req = new Request('http://localhost/api/tasks?id=' + TASK_ID_FOREIGN, { method: 'DELETE' });
    const res = await DELETE(req as any);
    expect(res.status).toBe(404);
  });

  it('ignores forged x-clinic-id header in DELETE and uses auth clinicId', async () => {
    auth(CLINIC_A);
    mockDelReturning.mockResolvedValue([]);
    const req = new Request('http://localhost/api/tasks?id=' + TASK_ID, {
      method: 'DELETE',
      headers: { 'x-clinic-id': CLINIC_B },
    });
    const res = await DELETE(req as any);
    expect(res.status).toBe(404);
    const whereStr = require('util').inspect((mockDelWhere as jest.Mock).mock.calls[0][0], { depth: 8 });
    expect(whereStr).toContain(CLINIC_A);
    expect(whereStr).not.toContain(CLINIC_B);
  });
});
