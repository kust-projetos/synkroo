import { parse as parsePostgresConnectionString } from 'pg-connection-string';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export function isDisposableE2EDatabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    // Reject every query parameter: pg/libpq options can override destination,
    // authentication, TLS, or connection behavior after URL parsing.
    if (value.includes('?') || value.includes('#')) return false;
    const url = new URL(value);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return false;
    const authority = value.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]*)/i)?.[1] ?? '';
    const rawHost = authority.slice(authority.lastIndexOf('@') + 1);
    if (rawHost.includes('%') || rawHost.includes(',')) return false;

    // Validate the host pg actually uses, not only WHATWG URL's hostname.
    const driverConfig = parsePostgresConnectionString(value);
    if (!driverConfig.host || driverConfig.host.includes(',') || driverConfig.host.includes('%')) {
      return false;
    }
    const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    if (/(^|[_-])(prod|production)([_-]|$)/i.test(database)) return false;
    return LOOPBACK_HOSTS.has(driverConfig.host);
  } catch {
    return false;
  }
}

export function assertDisposableE2EDatabaseUrl(value: string | undefined): asserts value is string {
  if (!isDisposableE2EDatabaseUrl(value)) {
    throw new Error(
      'Playwright E2E blocked: DATABASE_URL must use a PostgreSQL loopback host with no query string.',
    );
  }
}
