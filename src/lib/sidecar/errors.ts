/**
 * Sidecar Error Hierarchy (F6.14)
 */

export type SidecarErrorCode =
  | 'unauthenticated'
  | 'invalid_signature'
  | 'replayed_nonce'
  | 'expired_timestamp'
  | 'mtls_required'
  | 'mtls_untrusted'
  | 'egress_blocked'
  | 'timeout'
  | 'sidecar_disabled'
  | 'http_error';

export class SidecarError extends Error {
  public readonly code: SidecarErrorCode;
  public readonly statusCode?: number;

  constructor(options: {
    message: string;
    code: SidecarErrorCode;
    statusCode?: number;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = 'SidecarError';
    this.code = options.code;
    this.statusCode = options.statusCode;
    if (options.cause) {
      this.cause = options.cause;
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
    };
  }
}
