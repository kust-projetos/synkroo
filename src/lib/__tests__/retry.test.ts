/**
 * Tests for Retry Utility
 */

import { withRetry, CircuitBreaker, tryCatch } from '@/lib/retry'

describe('Retry Utility', () => {
  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn(() => Promise.resolve('success'))

      const result = await withRetry(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable error', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNRESET'))
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValue('success')

      const result = await withRetry(fn, {
        initialDelay: 10, // Speed up test
        maxDelay: 100,
      })

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should not retry on non-retryable error', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('invalid input'))

      await expect(withRetry(fn)).rejects.toThrow('invalid input')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn()
      const fn = jest
        .fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success')

      await withRetry(fn, {
        onRetry,
        initialDelay: 10,
      })

      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error))
    })

    it('should throw after max attempts', async () => {
      const fn = jest.fn().mockRejectedValue(new Error('ECONNRESET'))

      await expect(
        withRetry(fn, { maxAttempts: 2, initialDelay: 10 })
      ).rejects.toThrow('ECONNRESET')

      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('CircuitBreaker', () => {
    it('should execute function when closed', async () => {
      const breaker = new CircuitBreaker(3, 1000)
      const fn = jest.fn(() => Promise.resolve('result'))

      const result = await breaker.execute(fn)

      expect(result).toBe('result')
      expect(fn).toHaveBeenCalledTimes(1)
      expect(breaker.getState()).toBe('closed')
    })

    it('should open after threshold failures', async () => {
      const breaker = new CircuitBreaker(2, 1000)
      const fn = jest.fn().mockRejectedValue(new Error('fail'))

      // First failure
      await expect(breaker.execute(fn)).rejects.toThrow('fail')
      expect(breaker.getState()).toBe('closed')

      // Second failure - should open
      await expect(breaker.execute(fn)).rejects.toThrow('fail')
      expect(breaker.getState()).toBe('open')

      // Third attempt should fail immediately
      await expect(breaker.execute(fn)).rejects.toThrow('Circuit breaker is open')
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should transition to half-open after reset timeout', async () => {
      const breaker = new CircuitBreaker(1, 50) // 50ms reset timeout
      const failFn = jest.fn().mockRejectedValue(new Error('fail'))
      const successFn = jest.fn().mockResolvedValue('success')

      // Trigger open state
      await expect(breaker.execute(failFn)).rejects.toThrow()
      expect(breaker.getState()).toBe('open')

      // Wait for reset timeout
      await new Promise((resolve) => setTimeout(resolve, 60))

      // Should transition to half-open and execute
      const result = await breaker.execute(successFn)
      expect(result).toBe('success')
      expect(breaker.getState()).toBe('closed')
    })
  })

  describe('tryCatch', () => {
    it('should return success result', async () => {
      const result = await tryCatch(() => Promise.resolve('data'))

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('data')
      }
    })

    it('should return error result', async () => {
      const result = await tryCatch(() =>
        Promise.reject(new Error('test error'))
      )

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.message).toBe('test error')
      }
    })
  })
})