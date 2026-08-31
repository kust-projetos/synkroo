import { GET, POST } from '@/app/api/instagram/webhook/route';

describe('Instagram webhook contract', () => {
  it('is explicitly disabled in v1 for verification and delivery', async () => {
    const getResponse = await GET(new Request('https://localhost/api/instagram/webhook'));
    const postResponse = await POST(new Request('https://localhost/api/instagram/webhook', { method: 'POST' }));

    expect(getResponse.status).toBe(404);
    expect(postResponse.status).toBe(404);
  });
});
