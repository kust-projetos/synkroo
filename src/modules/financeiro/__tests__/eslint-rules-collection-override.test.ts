import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Config assertion (T2): the eslint override for the collection reminder file
 * was REMOVED because collection-service now delegates via @/modules/operacional/public
 * (no direct cross-module imports). The guard asserts the override stays absent —
 * reintroducing it would re-enable an undeclared cross-module edge.
 */
describe('eslint.rules.json — collection-service boundaries override (T2 removed)', () => {
  const cfg = JSON.parse(
    readFileSync(join(process.cwd(), 'eslint.rules.json'), 'utf8'),
  ) as {
    overrides?: Array<{ files?: string[]; rules?: Record<string, unknown> }>;
  };

  it('does not declare a boundaries/dependencies override for collection-service', () => {
    const override = (cfg.overrides ?? []).find(
      (o) =>
        Array.isArray(o.files) &&
        o.files.includes('src/modules/financeiro/services/collection-service.ts'),
    );

    expect(override).toBeUndefined();
  });
});