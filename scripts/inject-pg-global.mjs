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
const pgInjection = `// W4.8: pg externalizado → injeta como global para o bundle que referencia \`let e = pg\`.
import pg from 'pg';
globalThis.pg = pg;

`;
const runtimeMarker = '    async fetch(request, env, ctx) {\n';
const runtimeInjection = `        // W4.9: expose Hyperdrive before Next middleware and route handlers run.
        if (env.HYPERDRIVE?.connectionString) {
            globalThis.__SYNKROO_HYPERDRIVE = env.HYPERDRIVE.connectionString;
        }
`;

let nextContent = content;
if (!nextContent.includes('globalThis.pg = pg')) {
  nextContent = pgInjection + nextContent;
}

if (!nextContent.includes('globalThis.__SYNKROO_HYPERDRIVE')) {
  if (!nextContent.includes(runtimeMarker)) {
    throw new Error(`[inject-pg-global] fetch marker not found in ${workerPath}`);
  }
  nextContent = nextContent.replace(runtimeMarker, runtimeMarker + runtimeInjection);
}

writeFileSync(workerPath, nextContent, 'utf-8');
console.log('[inject-pg-global] pg and Hyperdrive runtime globals ensured in', workerPath);
