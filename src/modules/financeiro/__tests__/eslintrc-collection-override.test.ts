import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Config assertion: the declared minimal boundary edge that allows the
 * legitimate cross-module deep imports (@/core/actions/run, .../context)
 * from the collection reminder service. The @/core/actions barrel
 * intentionally does not re-export these (pg bundling concern), so the
 * established codebase pattern is the deep import — see the comment in
 * src/core/actions/index.ts. This test guards the override so a future
 * refactor that silently removes it is caught.
 */
describe('.eslintrc.json — collection-service boundaries override', () => {
  const cfg = JSON.parse(
    readFileSync(join(process.cwd(), '.eslintrc.json'), 'utf8'),
  ) as {
    overrides?: Array<{ files?: string[]; rules?: Record<string, unknown> }>;
  };

  it('declares a minimal boundaries/dependencies edge for the collection reminder file', () => {
    const override = (cfg.overrides ?? []).find(
      (o) =>
        Array.isArray(o.files) &&
        o.files.includes('src/modules/financeiro/services/collection-service.ts'),
    );

    expect(override).toBeDefined();
    expect(override!.rules).toBeDefined();
    expect(override!.rules!['boundaries/dependencies']).toBe('off');
  });
});