/**
 * mTLS & Client Certificate Verification (F6.14)
 */

import type { MtlsValidationConfig, MtlsValidationResult } from './types';

/**
 * Validates mTLS headers injected by Cloudflare Access, ingress proxies or TLS termination.
 */
export function validateMtlsHeaders(
  headers: Record<string, string | undefined>,
  config: MtlsValidationConfig = {},
): MtlsValidationResult {
  const normHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value !== undefined) {
      normHeaders[key.toLowerCase()] = value;
    }
  }

  const presented =
    normHeaders['cf-client-cert-presented'] === '1' ||
    normHeaders['x-client-cert-presented'] === '1' ||
    normHeaders['x-forwarded-client-cert'] !== undefined ||
    normHeaders['x-client-cert-sha256'] !== undefined;

  if (config.requireMtls && !presented) {
    return { ok: false, error: 'mtls_required' };
  }

  if (!presented) {
    // If not strictly required and not presented, allow if allowedSanDns not specified
    if (config.allowedSanDns?.length || config.allowedThumbprints?.length) {
      return { ok: false, error: 'mtls_required' };
    }
    return { ok: true };
  }

  const sanDns =
    normHeaders['cf-client-cert-san-dns'] ||
    normHeaders['x-client-cert-san-dns'] ||
    normHeaders['x-client-cert-cn'];

  const thumbprint =
    normHeaders['cf-client-cert-sha256'] ||
    normHeaders['x-client-cert-sha256'] ||
    normHeaders['x-client-cert-fingerprint'];

  if (config.allowedSanDns && config.allowedSanDns.length > 0) {
    if (!sanDns || !config.allowedSanDns.includes(sanDns)) {
      return { ok: false, error: 'mtls_untrusted' };
    }
  }

  if (config.allowedThumbprints && config.allowedThumbprints.length > 0) {
    if (!thumbprint || !config.allowedThumbprints.includes(thumbprint)) {
      return { ok: false, error: 'mtls_untrusted' };
    }
  }

  return { ok: true, sanDns, thumbprint };
}
