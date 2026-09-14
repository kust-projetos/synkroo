/**
 * Unit tests — fetchWithRetry / ExternalHttpError (Trilha A, etapa A2).
 *
 * fetch é injetado via `fetchImpl` (sem mock global); sleep/random injetados
 * para backoff/jitter determinísticos.
 */

import {
  fetchWithRetry,
  ExternalHttpError,
  computeRetryDelayMs,
  DEFAULT_EXTERNAL_TIMEOUT_MS,
} from '../fetch-with-retry';

function okResponse(): Response {
  return { ok: true, status: 200, json: async () => ({}) } as unknown as Response;
}

function errorResponse(status: number): Response {
  return {
    ok: false,
    status,
    json: async () => ({ message: `err-${status}` }),
    text: async () => `err-${status}`,
  } as unknown as Response;
}

function abortAwareHang(): typeof fetch {
  return ((_url: unknown, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      const signal = init?.signal as AbortSignal | undefined;
      if (!signal) return; // nunca resolve — só usado com timeout+abort
      if (signal.aborted) {
        const e = new Error('This operation was aborted');
        e.name = 'AbortError';
        reject(e);
        return;
      }
      signal.addEventListener(
        'abort',
        () => {
          const e = new Error('This operation was aborted');
          e.name = 'AbortError';
          reject(e);
        },
        { once: true },
      );
    })) as unknown as typeof fetch;
}

describe('fetchWithRetry (A2)', () => {
  it('timeout dispara ExternalHttpError estruturado (flag timeout)', async () => {
    const fetchImpl = abortAwareHang();
    await expect(
      fetchWithRetry('https://provider.example.com/send/text', { method: 'POST' }, {
        fetchImpl,
        timeoutMs: 20,
        sleep: async () => {},
      }),
    ).rejects.toMatchObject({ name: 'ExternalHttpError', timeout: true });
  });

  it('usa timeout default de 15s quando não configurado', () => {
    expect(DEFAULT_EXTERNAL_TIMEOUT_MS).toBe(15_000);
  });

  it('429 retrya e depois sucede (GET)', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(errorResponse(429))
      .mockResolvedValueOnce(okResponse());
    const res = await fetchWithRetry('https://provider.example.com/status', { method: 'GET' }, {
      fetchImpl,
      sleep: async () => {},
    });
    expect(res.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('500 retrya e depois sucede (GET)', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(okResponse());
    const res = await fetchWithRetry('https://provider.example.com/status', { method: 'GET' }, {
      fetchImpl,
      sleep: async () => {},
    });
    expect(res.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('400 NÃO retrya (retorna a resposta)', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(errorResponse(400));
    const res = await fetchWithRetry('https://provider.example.com/send/text', { method: 'POST' }, {
      fetchImpl,
      sleep: async () => {},
    });
    expect(res.status).toBe(400);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('POST 500 sem idempotência NÃO retrya', async () => {
    const fetchImpl = jest.fn().mockResolvedValueOnce(errorResponse(500));
    const res = await fetchWithRetry('https://provider.example.com/send/text', { method: 'POST' }, {
      fetchImpl,
      sleep: async () => {},
    });
    expect(res.status).toBe(500);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('POST 500 COM idempotencyKey retrya (opt-in)', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(okResponse());
    const res = await fetchWithRetry('https://provider.example.com/payments', { method: 'POST' }, {
      fetchImpl,
      idempotencyKey: 'charge-123',
      sleep: async () => {},
    });
    expect(res.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('erro de rede em POST não-idempotente throwa sem retry', async () => {
    const fetchImpl = jest.fn().mockRejectedValueOnce(new Error('fetch failed'));
    await expect(
      fetchWithRetry('https://provider.example.com/send/text', { method: 'POST' }, {
        fetchImpl,
        sleep: async () => {},
      }),
    ).rejects.toBeInstanceOf(ExternalHttpError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('erro de rede em GET retrya até o budget e throwa estruturado', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('fetch failed'));
    await expect(
      fetchWithRetry('https://provider.example.com/status', { method: 'GET' }, {
        fetchImpl,
        maxRetries: 2,
        sleep: async () => {},
      }),
    ).rejects.toMatchObject({ name: 'ExternalHttpError', retryable: true });
    expect(fetchImpl).toHaveBeenCalledTimes(3); // 1 tentativa + 2 retries
  });

  it('backoff exponencial com jitter determinístico (base 200ms)', async () => {
    expect(computeRetryDelayMs(0, () => 0.5)).toBe(200);
    expect(computeRetryDelayMs(1, () => 0.5)).toBe(400);
    expect(computeRetryDelayMs(2, () => 0.5)).toBe(800);

    const delays: number[] = [];
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(okResponse());
    await fetchWithRetry('https://provider.example.com/status', { method: 'GET' }, {
      fetchImpl,
      sleep: async (ms: number) => {
        delays.push(ms);
      },
      random: () => 0.5,
    });
    expect(delays).toEqual([200, 400]);
  });

  it('abort do signal externo NÃO retrya (1 tentativa, aborted:true)', async () => {
    const controller = new AbortController();
    let calls = 0;
    const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
      calls += 1;
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => {
          const e = new Error('This operation was aborted');
          e.name = 'AbortError';
          reject(e);
        });
        // Aborta pelo lado do chamador logo após o início.
        setTimeout(() => controller.abort(), 5);
      });
    }) as unknown as typeof fetch;

    const err = await fetchWithRetry('https://provider.example.com/status', {
      method: 'GET',
      signal: controller.signal,
    }, {
      fetchImpl,
      timeoutMs: 1000,
      maxRetries: 2,
      sleep: async () => {},
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ExternalHttpError);
    expect(err as ExternalHttpError).toMatchObject({ aborted: true, timeout: false, retryable: false });
    expect(calls).toBe(1);
  });

  it('abort durante o backoff → nenhuma tentativa adicional', async () => {
    const controller = new AbortController();
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(errorResponse(500))
      .mockResolvedValueOnce(okResponse());

    const err = await fetchWithRetry('https://provider.example.com/status', {
      method: 'GET',
      signal: controller.signal,
    }, {
      fetchImpl,
      maxRetries: 2,
      // Simula o chamador abortando no meio do backoff.
      sleep: async () => {
        controller.abort();
        await new Promise((r) => setTimeout(r, 20));
      },
    }).catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ExternalHttpError);
    expect(err as ExternalHttpError).toMatchObject({ aborted: true, retryable: false });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('mensagem de erro NÃO vaza segredos (headers/body/query)', async () => {
    const secret = 'super-secret-api-key-123';
    const fetchImpl = jest.fn().mockRejectedValueOnce(new Error('fetch failed'));
    const err = await fetchWithRetry(
      'https://provider.example.com/send?token=abc',
      { method: 'POST', headers: { Authorization: `Bearer ${secret}`, apikey: secret } },
      { fetchImpl, sleep: async () => {} },
    ).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ExternalHttpError);
    expect((err as Error).message).not.toContain(secret);
    expect((err as Error).message).not.toContain('token=abc');
    expect((err as Error).message).toContain('provider.example.com');
  });
});
