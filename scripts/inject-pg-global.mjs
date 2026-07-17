/**
 * W4.8 post-build injection: resolve 'pg is not defined' no workerd local.
 *
 * O bundle OpenNext/Cloudflare referencia `pg` como global (`let e = pg`)
 * porque pg está em serverExternalPackages. O workerd local não provê pg como npm global.
 * Este script injeta `import pg from 'pg'; globalThis.pg = pg;` no worker.js
 * logo após `opennextjs-cloudflare build`.
 *
 * Run: node scripts/inject-pg-global.mjs [.open-next/worker.js]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const workerPath = resolve(process.argv[2] ?? '.open-next/worker.js');

const content = readFileSync(workerPath, 'utf-8');
const injection = `// W4.8: pg externalizado → injeta como global para o bundle que referencia \`let e = pg\`.
import pg from 'pg';
globalThis.pg = pg;

`;

if (content.includes('globalThis.pg = pg')) {
  console.log('[inject-pg-global] already injected, skipping.');
  process.exit(0);
}

writeFileSync(workerPath, injection + content, 'utf-8');
console.log('[inject-pg-global] pg injected into', workerPath);
