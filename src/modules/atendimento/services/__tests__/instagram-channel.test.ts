import { sendInstagram } from '../channel-service';

describe('sendInstagram', () => {
  const originalFetch = global.fetch;
  const originalToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const originalAccount = process.env.INSTAGRAM_ACCOUNT_ID;

  beforeEach(() => {
    process.env.INSTAGRAM_ACCESS_TOKEN = 'token-test';
    process.env.INSTAGRAM_ACCOUNT_ID = 'account-1';
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.INSTAGRAM_ACCESS_TOKEN = originalToken;
    process.env.INSTAGRAM_ACCOUNT_ID = originalAccount;
  });

  it('sends a text message through the Meta Graph API', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ message_id: 'ig-1' }) });
    await expect(sendInstagram('user-1', 'Olá')).resolves.toEqual({ success: true, messageId: 'ig-1' });
    expect(global.fetch).toHaveBeenCalledWith('https://graph.facebook.com/v18.0/account-1/messages', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ recipient: { id: 'user-1' }, message: { text: 'Olá' } }),
    }));
  });

  it('returns a sanitized provider error', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, text: async () => 'provider detail' });
    await expect(sendInstagram('user-1', 'Olá')).resolves.toEqual({ success: false, error: 'Instagram provider request failed' });
  });
});
