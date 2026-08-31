import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

describe('Instagram webhook v1 boundary', () => {
  it('keeps verification disabled', async () => {
    const response = await GET(new NextRequest(
      'https://localhost/api/instagram/webhook?hub.mode=subscribe&hub.verify_token=token&hub.challenge=challenge',
    ));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'not_found' });
  });

  it('does not route POST payloads into the inbound pipeline', async () => {
    const response = await POST(new NextRequest('https://localhost/api/instagram/webhook', {
      method: 'POST',
      body: JSON.stringify({ object: 'instagram', entry: [] }),
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: 'not_found' });
  });
});
