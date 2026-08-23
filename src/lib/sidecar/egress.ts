/**
 * Sidecar Egress Allowlist Validation (F6.14)
 */

function matchDomainPattern(domain: string, pattern: string): boolean {
  const normDomain = domain.toLowerCase();
  const normPattern = pattern.toLowerCase();

  if (normPattern.startsWith('*.')) {
    const suffix = normPattern.slice(2);
    return normDomain.endsWith('.' + suffix) || normDomain === suffix;
  }

  return normDomain === normPattern;
}

/**
 * Validates that an outgoing egress URL belongs to the allowed domain patterns.
 */
export function validateEgressUrl(rawUrl: string, allowlist: string[]): boolean {
  if (!rawUrl || typeof rawUrl !== 'string') return false;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }

  // Only allow HTTP/HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const hostname = parsed.hostname;

  // Block private and loopback IPs
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('169.254.') || // Cloud metadata
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    return false;
  }

  for (const pattern of allowlist) {
    if (matchDomainPattern(hostname, pattern)) {
      return true;
    }
  }

  return false;
}
