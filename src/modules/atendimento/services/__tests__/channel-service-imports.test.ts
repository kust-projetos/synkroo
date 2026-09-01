import { readFileSync } from 'fs';
import { join } from 'path';

it('channel-service does not import playwright at all (Workers runtime safe & zero bundle bloat)', () => {
  const src = readFileSync(join(process.cwd(), 'src/modules/atendimento/services/channel-service.ts'), 'utf8');
  expect(src).not.toMatch(/from\s+['"]playwright['"]/);
  expect(src).not.toMatch(/import\(['"]playwright['"]\)/);
});
