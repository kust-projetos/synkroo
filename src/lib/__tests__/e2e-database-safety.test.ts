import { assertDisposableE2EDatabaseUrl, isDisposableE2EDatabaseUrl } from '../e2e-database-safety';

describe('E2E database safety', () => {
  it.each([
    'postgres://user:pass@localhost:5432/synkroo',
    'postgresql://user:pass@127.0.0.1:5432/synkroo_test',
    'postgres://user:pass@[::1]:5432/synkroo',
  ])('accepts explicitly test-scoped target %s', (url) => {
    expect(isDisposableE2EDatabaseUrl(url)).toBe(true);
    expect(() => assertDisposableE2EDatabaseUrl(url)).not.toThrow();
  });

  it.each([
    undefined,
    '',
    'not-a-url',
    'mysql://localhost:3306/synkroo',
    'postgres://user:pass@db.example.test:5432/synkroo',
    'postgres://user:pass@db.example.test:5432/synkroo_test',
    'postgres://user:pass@localhost:5432/synkroo_production',
    'postgres://user:pass@localhost:5432/synkroo_test?host=prod-db.example',
    'postgres://user:pass@localhost:5432/synkroo_test?port=5432',
    'postgres://user:pass@localhost:5432/synkroo_test?options=-csearch_path=public',
    'postgres://user:pass@localhost:5432/synkroo_test#production',
    'postgres://user:pass@localhost,prod-db.example:5432/synkroo_test',
    'postgres://user:pass@lo%63alhost:5432/synkroo_test',
  ])('rejects non-disposable target %s', (url) => {
    expect(isDisposableE2EDatabaseUrl(url)).toBe(false);
    expect(() => assertDisposableE2EDatabaseUrl(url)).toThrow(/Playwright E2E blocked/);
  });
});
