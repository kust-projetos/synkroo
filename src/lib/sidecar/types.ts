/**
 * Sidecar Protocol Types & Interfaces (F6.14)
 */

export interface NonceSeenStore {
  wasSeen(nonce: string): Promise<boolean>;
  markSeen(nonce: string, ttlSeconds: number): Promise<void>;
}

export interface SidecarSignPayload {
  timestamp: number;
  nonce: string;
  idempotencyKey: string;
  body: string;
}

export type SidecarVerifyError =
  | 'malformed'
  | 'invalid_signature'
  | 'expired_timestamp'
  | 'replayed_nonce'
  | 'clock_skew';

export type VerifySidecarResult =
  | { ok: true; payload: SidecarSignPayload }
  | { ok: false; error: SidecarVerifyError };

export interface MtlsValidationConfig {
  requireMtls?: boolean;
  allowedSanDns?: string[];
  allowedThumbprints?: string[];
}

export type MtlsValidationError =
  | 'mtls_required'
  | 'mtls_invalid'
  | 'mtls_untrusted';

export type MtlsValidationResult =
  | { ok: true; sanDns?: string; thumbprint?: string }
  | { ok: false; error: MtlsValidationError };

export interface SidecarClientConfig {
  baseUrl: string;
  sharedSecret: string;
  timeoutMs?: number;
  clientCertPem?: string;
  clientKeyPem?: string;
  fetchImpl?: typeof fetch;
}
