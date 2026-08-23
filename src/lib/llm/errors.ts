/**
 * LLM Error Classes & Secret Redaction (F6.06)
 */

import type { LlmProviderType } from './types';

export type LlmErrorCode =
  | 'missing_api_key'
  | 'unauthorized'
  | 'rate_limited'
  | 'timeout'
  | 'provider_down'
  | 'invalid_response'
  | 'invalid_input'
  | 'context_length_exceeded'
  | 'network_error';

export function redactSecrets(text: string, secrets: string[] = []): string {
  if (!text) return text;
  let result = text;
  for (const s of secrets) {
    if (s && s.length > 4) {
      result = result.split(s).join('[REDACTED_API_KEY]');
    }
  }
  // Generic token pattern redaction
  result = result.replace(/Bearer\s+[A-Za-z0-9_\-\.]{8,}/gi, 'Bearer [REDACTED_TOKEN]');
  result = result.replace(/sk-[A-Za-z0-9_\-\.]{8,}/gi, 'sk-[REDACTED_KEY]');
  return result;
}

export class LlmError extends Error {
  public readonly code: LlmErrorCode;
  public readonly provider?: LlmProviderType;
  public readonly statusCode?: number;
  public readonly retryable: boolean;

  constructor(options: {
    message: string;
    code: LlmErrorCode;
    provider?: LlmProviderType;
    statusCode?: number;
    retryable?: boolean;
    cause?: unknown;
    secrets?: string[];
  }) {
    const cleanMessage = redactSecrets(options.message, options.secrets);
    super(cleanMessage);
    this.name = 'LlmError';
    this.code = options.code;
    this.provider = options.provider;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? false;
    if (options.cause) {
      this.cause = options.cause;
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      provider: this.provider,
      statusCode: this.statusCode,
      retryable: this.retryable,
    };
  }
}
