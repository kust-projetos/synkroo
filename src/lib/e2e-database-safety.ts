const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const TEST_DATABASE = 'synkroo_test';

export function isDisposableE2EDatabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return false;
    const database = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    if (/(^|[_-])(prod|production)([_-]|$)/i.test(database)) return false;
    return LOOPBACK_HOSTS.has(url.hostname) || database === TEST_DATABASE;
  } catch {
    return false;
  }
}

export function assertDisposableE2EDatabaseUrl(value: string | undefined): asserts value is string {
  if (!isDisposableE2EDatabaseUrl(value)) {
    throw new Error(
      'Playwright E2E blocked: DATABASE_URL must target loopback or the synkroo_test database.',
    );
  }
}
