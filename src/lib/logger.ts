/**
 * Structured Logger Utility
 * Respects environment (dev/prod) with configurable log levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LoggerConfig {
  level: LogLevel
  isDevelopment: boolean
  enableConsole: boolean
}

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: Record<string, unknown>
  service?: string
  requestId?: string
  correlationId?: string
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

const SENSITIVE_LOG_KEYS = new Set([
  'apikey', 'authorization', 'connectionstring', 'cookie', 'databaseurl', 'password',
  'refreshtoken', 'secret', 'setcookie', 'token',
])

function redactLogValue(value: unknown, key?: string): unknown {
  const normalizedKey = key?.toLowerCase().replace(/[-_]/g, '')
  if (normalizedKey && SENSITIVE_LOG_KEYS.has(normalizedKey)) return '[REDACTED]'
  if (Array.isArray(value)) return value.map((item) => redactLogValue(item))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value).map(([nestedKey, nestedValue]) => [nestedKey, redactLogValue(nestedValue, nestedKey)]),
  )
}

class Logger {
  private config: LoggerConfig
  private service: string

  constructor(service: string = 'app', config?: Partial<LoggerConfig>) {
    this.service = service
    this.config = {
      level: (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'development' ? 'debug' : 'info'),
      isDevelopment: process.env.NODE_ENV === 'development',
      enableConsole: true,
      ...config,
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level]
  }

  private formatEntry(level: LogLevel, message: string, context?: Record<string, unknown>): LogEntry {
    const safeContext = (redactLogValue(context) || {}) as Record<string, unknown>
    const requestId = typeof safeContext.requestId === 'string' ? safeContext.requestId : undefined
    const correlationId = typeof safeContext.correlationId === 'string' ? safeContext.correlationId : undefined
    delete safeContext.requestId
    delete safeContext.correlationId
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: Object.keys(safeContext).length > 0 ? safeContext : undefined,
      service: this.service,
      requestId,
      correlationId,
    }
  }

  private output(entry: LogEntry): void {
    if (!this.config.enableConsole) return
    if (!this.config.isDevelopment) {
      const serialized = JSON.stringify(entry)
      switch (entry.level) {
        case 'debug': console.debug(serialized); break
        case 'info': console.log(serialized); break
        case 'warn': console.warn(serialized); break
        case 'error': console.error(serialized); break
      }
      return
    }

    const prefix = this.config.isDevelopment
      ? `[${entry.timestamp}] [${entry.level.toUpperCase()}] [${entry.service}]`
      : `[${entry.level.toUpperCase()}]`

    const formattedMessage = entry.context
      ? `${entry.message} ${JSON.stringify(entry.context)}`
      : entry.message

    switch (entry.level) {
      case 'debug':
        if (this.config.isDevelopment) {
          console.log(prefix, formattedMessage)
        }
        break
      case 'info':
        console.log(prefix, formattedMessage)
        break
      case 'warn':
        console.warn(prefix, formattedMessage)
        break
      case 'error':
        console.error(prefix, formattedMessage)
        break
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('debug')) return
    this.output(this.formatEntry('debug', message, context))
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('info')) return
    this.output(this.formatEntry('info', message, context))
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (!this.shouldLog('warn')) return
    this.output(this.formatEntry('warn', message, context))
  }

  error(message: string, error?: Error | unknown, context?: Record<string, unknown>): void {
    if (!this.shouldLog('error')) return

    const errorContext = error instanceof Error
      ? { ...context, error: error.message, stack: error.stack }
      : { ...context, error }

    this.output(this.formatEntry('error', message, errorContext))
  }

  child(service: string): Logger {
    return new Logger(`${this.service}:${service}`, this.config)
  }
}

// Singleton instances for common services
export const logger = new Logger()
export const apiLogger = logger.child('api')
export const dbLogger = logger.child('db')
export const aiLogger = logger.child('ai')
export const whatsappLogger = logger.child('whatsapp')

// Factory function for custom loggers
export function createLogger(service: string, config?: Partial<LoggerConfig>): Logger {
  return new Logger(service, config)
}

export default logger