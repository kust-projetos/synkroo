/**
 * Retry Utility
 * Exponential backoff retry with configurable options
 */

export interface RetryOptions {
  maxAttempts?: number // Maximum number of attempts (default: 3)
  initialDelay?: number // Initial delay in ms (default: 1000)
  maxDelay?: number // Maximum delay in ms (default: 10000)
  backoffFactor?: number // Backoff multiplier (default: 2)
  retryableErrors?: string[] // Error messages that should trigger retry
  onRetry?: (attempt: number, error: Error) => void // Callback on each retry
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, 'onRetry'>> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2,
  retryableErrors: [
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
    'ECONNREFUSED',
    'network',
    'timeout',
    'rate limit',
    '429',
    '503',
    '502',
    '500',
  ],
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Check if an error should trigger a retry
 */
function isRetryableError(error: unknown, retryableErrors: string[]): boolean {
  if (!error) return false

  const errorMessage = error instanceof Error ? error.message : String(error)
  const errorString = errorMessage.toLowerCase()

  return retryableErrors.some((retryable) => errorString.includes(retryable.toLowerCase()))
}

/**
 * Calculate delay for a given attempt with exponential backoff
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffFactor: number
): number {
  const delay = initialDelay * Math.pow(backoffFactor, attempt - 1)
  // Add jitter (±10%) to prevent thundering herd
  const jitter = delay * 0.1 * (Math.random() * 2 - 1)
  return Math.min(delay + jitter, maxDelay)
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if we should retry
      if (attempt === opts.maxAttempts || !isRetryableError(error, opts.retryableErrors)) {
        throw error
      }

      const delay = calculateDelay(
        attempt,
        opts.initialDelay,
        opts.maxDelay,
        opts.backoffFactor
      )

      if (options.onRetry) {
        options.onRetry(attempt, lastError)
      }

      console.warn(
        `Retry attempt ${attempt}/${opts.maxAttempts} after ${delay.toFixed(0)}ms:`,
        lastError.message
      )

      await sleep(delay)
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError
}

/**
 * Circuit Breaker pattern implementation
 */
export class CircuitBreaker {
  private failures = 0
  private lastFailureTime = 0
  private state: 'closed' | 'open' | 'half-open' = 'closed'

  constructor(
    private readonly threshold: number = 5,
    private readonly resetTimeout: number = 30000
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.state = 'half-open'
      } else {
        throw new Error('Circuit breaker is open')
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failures = 0
    this.state = 'closed'
  }

  private onFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()

    if (this.failures >= this.threshold) {
      this.state = 'open'
    }
  }

  getState(): string {
    return this.state
  }
}

/**
 * Result type for operations that can fail
 */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

/**
 * Wrap an operation to return a Result type
 */
export async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    const data = await fn()
    return { success: true, data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error : new Error(String(error)) }
  }
}