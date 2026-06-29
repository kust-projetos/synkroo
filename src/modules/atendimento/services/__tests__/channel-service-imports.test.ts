import { readFileSync } from 'fs';
import { join } from 'path';

it('channel-service does not import playwright at top-level (Workers runtime safe)', () => {
  const src = readFileSync(join(process.cwd(), 'src/modules/atendimento/services/channel-service.ts'), 'utf8');
  // import de VALOR puxa playwright em runtime (e __dirname) → proibido no top-level.
  expect(src).not.toMatch(/^import\s+\{[^}]*\bchromium\b[^}]*\}\s+from\s+['"]playwright['"]/m);
  // import TYPE é apagado no compile — permitido.
  // dynamic import (await import('playwright')) dentro de método — permitido.
});
