import { POST } from '@/app/api/admin/run-migration/route';

describe('POST /api/admin/run-migration', () => {
  it('rejects migration execution with Drizzle CLI guidance', async () => {
    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: 'Migrations are managed by Drizzle CLI; run npm run db:migrate',
    });
  });
});
