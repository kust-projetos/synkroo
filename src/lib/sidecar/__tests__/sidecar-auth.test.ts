/**
 * Unit & Contract tests for Sidecar Authentication, mTLS, HMAC Nonce, Egress & Idempotency (F6.14)
 */

import {
  signSidecarRequest,
  verifySidecarSignature,
  validateMtlsHeaders,
  validateEgressUrl,
  SidecarClient,
  SidecarError,
  type NonceSeenStore,
} from '../index';

describe('Sidecar mTLS, HMAC Nonce, Timeout & Egress (F6.14)', () => {
  const SECRET = 'sidecar-shared-secret-must-be-at-least-32-chars-long';
  const IDEMPOTENCY_KEY = 'test-idempotency-key';
  const BODY = JSON.stringify({ action: 'send_message', phone: '+5511999999999', text: 'Olá' });

  let inMemorySeen: Set<string>;
  let mockStore: NonceSeenStore;

  beforeEach(() => {
    inMemorySeen = new Set<string>();
    mockStore = {
      wasSeen: jest.fn(async (nonce: string) => inMemorySeen.has(nonce)),
      markSeen: jest.fn(async (nonce: string) => {
        inMemorySeen.add(nonce);
      }),
    };
  });

  describe('HMAC SHA-256 Signing and Verification with Nonce', () => {
    it('successfully signs and verifies a valid sidecar payload', async () => {
      const timestamp = Date.now();
      const nonce = 'nonce-uuid-1234';

      const sig = await signSidecarRequest(SECRET, {
        timestamp,
        nonce,
        idempotencyKey: IDEMPOTENCY_KEY,
        body: BODY,
      });

      expect(typeof sig).toBe('string');
      expect(sig.length).toBeGreaterThan(20);

      const verifyRes = await verifySidecarSignature(
        SECRET,
        sig,
        { timestamp, nonce, idempotencyKey: IDEMPOTENCY_KEY, body: BODY },
        mockStore,
      );

      expect(verifyRes.ok).toBe(true);
      expect(mockStore.markSeen).toHaveBeenCalledWith(nonce, expect.any(Number));
    });

    it('rejects tampered body or parameters', async () => {
      const timestamp = Date.now();
      const nonce = 'nonce-uuid-tamper';

      const sig = await signSidecarRequest(SECRET, {
        timestamp,
        nonce,
        idempotencyKey: IDEMPOTENCY_KEY,
        body: BODY,
      });

      const tamperedRes = await verifySidecarSignature(
        SECRET,
        sig,
        { timestamp, nonce, idempotencyKey: IDEMPOTENCY_KEY, body: BODY + 'tampered' },
        mockStore,
      );

      expect(tamperedRes.ok).toBe(false);
      if (!tamperedRes.ok) {
        expect(tamperedRes.error).toBe('invalid_signature');
      }
    });

    it('rejects replayed nonce (replay attack protection)', async () => {
      const timestamp = Date.now();
      const nonce = 'nonce-uuid-replay';

      const sig = await signSidecarRequest(SECRET, {
        timestamp,
        nonce,
        idempotencyKey: IDEMPOTENCY_KEY,
        body: BODY,
      });

      // First verification succeeds and marks nonce as seen
      const firstRes = await verifySidecarSignature(
        SECRET,
        sig,
        { timestamp, nonce, idempotencyKey: IDEMPOTENCY_KEY, body: BODY },
        mockStore,
      );
      expect(firstRes.ok).toBe(true);

      // Second verification with identical nonce is rejected
      const secondRes = await verifySidecarSignature(
        SECRET,
        sig,
        { timestamp, nonce, idempotencyKey: IDEMPOTENCY_KEY, body: BODY },
        mockStore,
      );
      expect(secondRes.ok).toBe(false);
      if (!secondRes.ok) {
        expect(secondRes.error).toBe('replayed_nonce');
      }
    });

    it('rejects expired timestamp (clock skew > 300s)', async () => {
      const oldTimestamp = Date.now() - 400_000; // 400s ago
      const nonce = 'nonce-uuid-old';

      const sig = await signSidecarRequest(SECRET, {
        timestamp: oldTimestamp,
        nonce,
        idempotencyKey: IDEMPOTENCY_KEY,
        body: BODY,
      });

      const res = await verifySidecarSignature(
        SECRET,
        sig,
        { timestamp: oldTimestamp, nonce, idempotencyKey: IDEMPOTENCY_KEY, body: BODY },
        mockStore,
      );

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('expired_timestamp');
      }
    });
  });

  describe('mTLS Header / Client Certificate Validation', () => {
    it('accepts valid Cloudflare / Reverse Proxy mTLS presentation header', () => {
      const validHeaders = {
        'cf-client-cert-presented': '1',
        'cf-client-cert-san-dns': 'sidecar.synkroo.internal',
      };

      const res = validateMtlsHeaders(validHeaders, {
        allowedSanDns: ['sidecar.synkroo.internal'],
      });

      expect(res.ok).toBe(true);
    });

    it('accepts valid x-client-cert-sha256 fingerprint matching allowlist', () => {
      const validHeaders = {
        'x-client-cert-sha256': 'abc123certthumbprint456',
      };

      const res = validateMtlsHeaders(validHeaders, {
        allowedThumbprints: ['abc123certthumbprint456'],
      });

      expect(res.ok).toBe(true);
    });

    it('rejects missing or unverified client certificate', () => {
      const emptyHeaders = {};

      const res = validateMtlsHeaders(emptyHeaders, {
        requireMtls: true,
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('mtls_required');
      }
    });

    it('rejects untrusted SAN DNS or certificate fingerprint', () => {
      const untrustedHeaders = {
        'cf-client-cert-presented': '1',
        'cf-client-cert-san-dns': 'unauthorized.external.com',
      };

      const res = validateMtlsHeaders(untrustedHeaders, {
        allowedSanDns: ['sidecar.synkroo.internal'],
      });

      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe('mtls_untrusted');
      }
    });
  });

  describe('Egress Allowlist Enforcement', () => {
    const allowlist = ['web.whatsapp.com', '*.whatsapp.net', '*.whatsapp.com'];

    it('allows valid WhatsApp endpoints in allowlist', () => {
      expect(validateEgressUrl('https://web.whatsapp.com/send', allowlist)).toBe(true);
      expect(validateEgressUrl('https://mmg.whatsapp.net/v/t24/upload', allowlist)).toBe(true);
      expect(validateEgressUrl('https://media-gru1-1.cdn.whatsapp.net/download', allowlist)).toBe(true);
    });

    it('blocks malicious or non-allowlisted destinations', () => {
      expect(validateEgressUrl('https://evil-hacker.com/steal', allowlist)).toBe(false);
      expect(validateEgressUrl('http://169.254.169.254/latest/meta-data', allowlist)).toBe(false); // Cloud metadata
      expect(validateEgressUrl('http://127.0.0.1:8080/internal', allowlist)).toBe(false);
      expect(validateEgressUrl('invalid-url', allowlist)).toBe(false);
    });
  });

  describe('SidecarClient Request Execution & Timeout', () => {
    it('signs outgoing request and attaches all required security headers', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ success: true, messageId: 'msg_987' }),
      });

      const client = new SidecarClient({
        baseUrl: 'https://sidecar.synkroo.internal',
        sharedSecret: SECRET,
        fetchImpl: mockFetch as any,
      });

      const res = await client.request<{ success: boolean; messageId: string }>('/send', {
        action: 'send_message',
        phone: '+5511999999999',
        text: 'Olá',
      });

      expect(res.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toBe('https://sidecar.synkroo.internal/send');
      expect(init.headers['x-sidecar-signature']).toBeTruthy();
      expect(init.headers['x-sidecar-timestamp']).toBeTruthy();
      expect(init.headers['x-sidecar-nonce']).toBeTruthy();
      expect(init.headers['x-sidecar-idempotency-key']).toBeTruthy();
    });

    it('fails closed on timeout without leaking partial state', async () => {
      const mockFetch = jest.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          const err = new Error('The operation was aborted');
          err.name = 'AbortError';
          setTimeout(() => reject(err), 20);
        });
      });

      const client = new SidecarClient({
        baseUrl: 'https://sidecar.synkroo.internal',
        sharedSecret: SECRET,
        timeoutMs: 10,
        fetchImpl: mockFetch as any,
      });

      await expect(
        client.request('/send', { action: 'send_message' }),
      ).rejects.toThrow(SidecarError);

      try {
        await client.request('/send', { action: 'send_message' });
      } catch (err: any) {
        expect(err.code).toBe('timeout');
      }
    });
  });
});
