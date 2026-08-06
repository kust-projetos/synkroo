import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('Cloudflare remediation config has edge-compatible bindings', () => {
  const config = readFileSync(resolve(__dirname, '../../../wrangler.toml'), 'utf8');

  expect(config).toContain('compatibility_flags = ["nodejs_compat"]');
  expect(config).toContain('binding = "HYPERDRIVE"');
  expect(config).toContain('name = "NEXT_CACHE_DO_QUEUE"');
});

test('Cloudflare staging environment is isolated from production bindings', () => {
  const config = readFileSync(resolve(__dirname, '../../../wrangler.toml'), 'utf8');

  expect(config).toContain('[env.staging]');
  expect(config).toContain('name = "synkroo-staging"');
  expect(config).toContain('id = "f2ad31b71d484e0ba3fc6df1814d7d8e"');
  expect(config).toContain('index_name = "synkroo-staging-embeddings"');
  expect(config).toContain('id = "e0033a75f4e2449084b00b41e22e49a6"');
  expect(config).toContain('service = "synkroo-ia-bridge-staging"');
  expect(config).toContain('service = "synkroo-staging"');
});
