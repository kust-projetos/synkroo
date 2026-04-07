/**
 * Application Error Classes
 * Standardized error handling for APIs
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'EXTERNAL_SERVICE_ERROR'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR'

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly statusCode: number
  public readonly isOperational: boolean
  public readonly details?: Record<string, unknown>

  constructor(
    message: string,
    code: ErrorCode = 'INTERNAL_ERROR',
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.isOperational = isOperational
    this.details = details

    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      ...(this.details && { details: this.details }),
    }
  }
}

// Specific error classes
export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'VALIDATION_ERROR', 400, true, details)
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      `${resource} not found${id ? `: ${id}` : ''}`,
      'NOT_FOUND',
      404,
      true
    )
    this.name = 'NotFoundError'
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401, true)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 'FORBIDDEN', 403, true)
    this.name = 'ForbiddenError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'CONFLICT', 409, true, details)
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super('Rate limit exceeded', 'RATE_LIMITED', 429, true, { retryAfter })
    this.name = 'RateLimitError'
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, originalError?: Error) {
    super(
      `${service} service error`,
      'EXTERNAL_SERVICE_ERROR',
      502,
      true,
      originalError ? { originalMessage: originalError.message } : undefined
    )
    this.name = 'ExternalServiceError'
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, originalError?: Error) {
    super(
      message,
      'DATABASE_ERROR',
      500,
      true,
      originalError ? { originalMessage: originalError.message } : undefined
    )
    this.name = 'DatabaseError'
  }
}

// Error handler helper for API routes
import { NextResponse } from 'next/server'
import { logger } from './logger'

export function handleApiError(error: unknown): NextResponse {
  logger.error('API Error', error)

  if (error instanceof AppError) {
    return NextResponse.json(error.toJSON(), { status: error.statusCode })
  }

  if (error instanceof Error) {
    // Generic error
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    )
  }

  // Unknown error type
  return NextResponse.json(
    { error: 'An unexpected error occurred', code: 'INTERNAL_ERROR' },
    { status: 500 }
  )
}