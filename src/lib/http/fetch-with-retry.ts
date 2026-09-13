/**
 * Resilient HTTP helper — Trilha A (etapa A2 do plano de hardening).
 *
 * `fetchWithRetry` centraliza timeout explícito e retry com budget único para
 * os clients externos (Evolution, Asaas, Instagram Graph, sidecar Playwright).
 * Padrão de referência: `src/lib/llm/providers/base.ts` (timeout + retry +
 * erro estruturado sem vazar segredos).
 *
 * Regras:
 * - Toda chamada tem timeout explícito (default 15s) via AbortController.
 * - Retry (default 2 retries) SOMENTE para operações idempotentes:
 *   GET/HEAD são idempotentes por construção; demais métodos exigem opt-in
 *   via `idempotent: true` ou presença de `idempotencyKey`.
 * - Só retrya erro de rede/timeout e statuses retryable (408/429/5xx).
 *   4xx (ex.: 400) e mutação não-idempotente retornam/throwam sem retry.
 * - Backoff exponencial com jitter (base 200ms): `200 * 2^n * (0.5 + rand)`.
 * - Erros de transporte viram `ExternalHttpError` (status/timeout/retryable).
 *   A mensagem NUNCA inclui headers, body ou query — sem vazamento de segredos.
 * - Respostas HTTP (mesmo não-ok) são RETORNADAS, não throwadas: o client
 *   decide como surfar o corpo de erro do provider. Throw só em falha de
 *   transporte (rede/timeout) após esgotar o budget.
 */

export const DEFAULT_EXTERNAL_TIMEOUT_MS = 15_000;
export const DEFAULT_MAX_RETRIES = 2;
export const RETRY_BASE_DELAY_MS = 200;
export const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

const NETWORK_ERROR_PATTERNS = [
  'fetch failed',
  'econnreset',
  'econnrefused',
  'econnaborted',
  'etimedout',
  'eai_again',
  'enotfound',
  'enotconn',
  'socket hang up',
  'socket disconnected',
  'network request failed',
  'networkerror',
  'connection refused',
  'connection reset',
  'connection closed',
  'dns',
  'timeout',
  'temporarily unavailable',
];

export interface FetchRetryOptions {
  /** Timeout por tentativa em ms (default 15s). */
  timeoutMs?: number;
  /** Retries após a 1ª tentativa (default 2). Só vale p/ op idempotente. */
  maxRetries?: number;
  /** Opt-in de idempotência p/ método não-GET/HEAD (ex.: POST com Idempotency-Key). */
  idempotent?: boolean;
  /**
   * Chave de idempotência da operação. A presença implica `idempotent: true`
   * (ex.: POST de cobrança com `Idempotency-Key`). O helper NÃO envia o header
   * — o client monta os headers; aqui a chave só libera o retry.
   */
  idempotencyKey?: string;
  /** Statuses que disparam retry (default 408/429/500/502/503/504). */
  retryableStatuses?: number[];
  /** Injeção p/ testes (default global fetch). */
  fetchImpl?: typeof fetch;
  /** Injeção p/ testes determinísticos (default setTimeout real). */
  sleep?: (ms: number) => Promise<void>;
  /** Injeção p/ jitter determinístico (default Math.random). */
  random?: () => number;
  /** Id de correlação p/ logs (nunca vai p/ a mensagem de erro externa). */
  correlationId?: string;
}

/** Erro estruturado de transporte externo — sem segredos na mensagem. */
export class ExternalHttpError extends Error {
  readonly status?: number;
  readonly timeout: boolean;
  readonly retryable: boolean;
  readonly correlationId?: string;

  constructor(args: {
    message: string;
    status?: number;
    timeout?: boolean;
    retryable?: boolean;
    correlationId?: string;
    cause?: unknown;
  }) {
    super(args.message);
    this.name = 'ExternalHttpError';
    this.status = args.status;
    this.timeout = args.timeout ?? false;
    this.retryable = args.retryable ?? false;
    this.correlationId = args.correlationId;
    if (args.cause !== undefined) (this as { cause?: unknown }).cause = args.cause;
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.message.toLowerCase().includes('abort'))
  );
}

function isRetryableNetworkError(error: unknown): boolean {
  if (isAbortError(error)) return true; // timeout-connect (só retrya se idempotente — ver loop)
  if (error instanceof TypeError || error instanceof Error) {
    const msg = error.message.toLowerCase();
    return NETWORK_ERROR_PATTERNS.some((p) => msg.includes(p));
  }
  return false;
}

function isRetryableStatus(status: number, retryableStatuses: number[]): boolean {
  if (retryableStatuses.includes(status)) return true;
  return status >= 500 && status < 600;
}

/** Delay da n-ésima retry (n=0 → 1º retry): base 200ms * 2^n com jitter [0.5x, 1.5x]. */
export function computeRetryDelayMs(retryIndex: number, random: () => number = Math.random): number {
  return RETRY_BASE_DELAY_MS * 2 ** retryIndex * (0.5 + random());
}

/** Descreve `input` sem query/segredos: `POST https://host/path`. */
function describeTarget(input: string | URL | Request, method: string): string {
  try {
    const url = typeof input === 'string' ? new URL(input) : input instanceof Request ? new URL(input.url) : input;
    return `${method.toUpperCase()} ${url.host}${url.pathname}`;
  } catch {
    return method.toUpperCase();
  }
}

function isIdempotentMethod(method: string): boolean {
  return method === 'GET' || method === 'HEAD';
}

/**
 * fetch com timeout explícito + retry orçado para operações idempotentes.
 *
 * Retorna a última `Response` (inclusive não-ok). Lança `ExternalHttpError`
 * apenas em falha de transporte após esgotar o budget — ou imediatamente para
 * operação não-idempotente (sem retry, mas COM timeout).
 */
export async function fetchWithRetry(
  input: string | URL | Request,
  init: RequestInit = {},
  options: FetchRetryOptions = {},
): Promise<Response> {
  const {
    timeoutMs = DEFAULT_EXTERNAL_TIMEOUT_MS,
    maxRetries = DEFAULT_MAX_RETRIES,
    idempotent = false,
    idempotencyKey,
    retryableStatuses = DEFAULT_RETRYABLE_STATUSES,
    fetchImpl = fetch,
    sleep = defaultSleep,
    random = Math.random,
    correlationId,
  } = options;

  const method = (init.method ?? 'GET').toUpperCase();
  const idempotentOp = isIdempotentMethod(method) || idempotent || Boolean(idempotencyKey);
  const maxAttempts = idempotentOp ? 1 + Math.max(0, maxRetries) : 1;
  const target = describeTarget(input, method);

  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    const externalSignal = init.signal as AbortSignal | undefined | null;
    const onExternalAbort = (): void => controller.abort();
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }

    try {
      const response = await fetchImpl(input, { ...init, signal: controller.signal });
      clearTimeout(timer);
      if (externalSignal && !externalSignal.aborted) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }

      if (response.ok || !isRetryableStatus(response.status, retryableStatuses)) {
        return response;
      }
      // Status retryable…
      if (attempt >= maxAttempts) return response; // …sem budget (ou não-idempotente): devolve
      await sleep(computeRetryDelayMs(attempt - 1, random));
      continue;
    } catch (error) {
      clearTimeout(timer);
      if (externalSignal && !externalSignal.aborted) {
        externalSignal.removeEventListener('abort', onExternalAbort);
      }
      const timeout = timedOut || isAbortError(error);
      const retryable = isRetryableNetworkError(error);
      const lastAttempt = attempt >= maxAttempts;

      if (!retryable || lastAttempt) {
        throw new ExternalHttpError({
          message: timeout
            ? `External request timed out after ${timeoutMs}ms: ${target}`
            : `External request failed: ${target}`,
          timeout,
          retryable,
          correlationId,
          cause: error,
        });
      }
      await sleep(computeRetryDelayMs(attempt - 1, random));
    }
  }
}
