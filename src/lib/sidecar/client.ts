/**
 * Sidecar Client with mTLS, HMAC, Nonce, Timeout and Idempotency (F6.14)
 */

import { signSidecarRequest } from './crypto';
import { SidecarError } from './errors';
import type { SidecarClientConfig } from './types';

export class SidecarClient {
  private readonly baseUrl: string;
  private readonly sharedSecret: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(config: SidecarClientConfig) {
    if (!config.sharedSecret || config.sharedSecret.length < 32) {
      throw new SidecarError({
        message: 'SIDECAR_SHARED_SECRET must be at least 32 characters long',
        code: 'unauthenticated',
      });
    }

    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.sharedSecret = config.sharedSecret;
    this.timeoutMs = config.timeoutMs ?? 30000;
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  /**
   * Executes signed and mutually authenticated HTTP request to Sidecar.
   */
  public async request<T = unknown>(
    path: string,
    body: Record<string, unknown>,
    options: { idempotencyKey?: string; timeoutMs?: number } = {},
  ): Promise<T> {
    const timestamp = Date.now();
    const nonce = crypto.randomUUID();
    const idempotencyKey = options.idempotencyKey || `req_${crypto.randomUUID()}`;
    const serializedBody = JSON.stringify(body);

    const signature = await signSidecarRequest(this.sharedSecret, {
      timestamp,
      nonce,
      idempotencyKey,
      body: serializedBody,
    });

    const endpoint = `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
    const controller = new AbortController();
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-sidecar-signature': signature,
          'x-sidecar-timestamp': String(timestamp),
          'x-sidecar-nonce': nonce,
          'x-sidecar-idempotency-key': idempotencyKey,
        },
        body: serializedBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let errMessage = `Sidecar error HTTP ${res.status}`;
        try {
          const errJson = (await res.json()) as any;
          if (errJson.error) errMessage = errJson.error;
        } catch {
          // ignore json parse error
        }

        throw new SidecarError({
          message: errMessage,
          code: res.status === 401 ? 'unauthenticated' : 'http_error',
          statusCode: res.status,
        });
      }

      return (await res.json()) as T;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      if (err instanceof SidecarError) {
        throw err;
      }

      const isAbort = (err as Error)?.name === 'AbortError' || (err as Error)?.message?.includes('aborted');
      if (isAbort) {
        throw new SidecarError({
          message: `Sidecar request timed out after ${timeoutMs}ms`,
          code: 'timeout',
        });
      }

      throw new SidecarError({
        message: `Network error connecting to sidecar: ${(err as Error)?.message ?? 'Unknown error'}`,
        code: 'http_error',
        cause: err,
      });
    }
  }
}
