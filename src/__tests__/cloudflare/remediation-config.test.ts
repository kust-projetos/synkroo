import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('Cloudflare remediation config has edge-compatible bindings', () => {
  const config = readFileSync(resolve(__dirname, '../../../wrangler.toml'), 'utf8');

  expect(config).toContain('compatibility_flags = ["nodejs_compat"]');
  expect(config).toContain('binding = "HYPERDRIVE"');
  expect(config).toContain('name = "NEXT_CACHE_DO_QUEUE"');
});
