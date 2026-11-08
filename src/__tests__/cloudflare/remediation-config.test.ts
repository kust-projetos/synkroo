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
  // F6.11: Vectorize removed, consolidated to pgvector — staging must NOT contain Vectorize bindings
  expect(config).not.toContain('VECTORIZE');
  expect(config).not.toContain('index_name = "synkroo-staging-embeddings"');
  expect(config).toContain('id = "e0033a75f4e2449084b00b41e22e49a6"');
  expect(config).toContain('service = "synkroo-ia-bridge-staging"');
  expect(config).toContain('service = "synkroo-staging"');
});

test('staging keeps reminders disabled while production keeps them (P4/P5 staging safety)', () => {
  const config = readFileSync(resolve(__dirname, '../../../wrangler.toml'), 'utf8');
  const parseCronEnabled = (section: string): string[] => {
    const re = new RegExp(`\\[${section}\\][\\s\\S]*?CRON_JOBS_ENABLED\\s*=\\s*"([^"]+)"`, 'm');
    const m = config.match(re);
    expect(m).not.toBeNull();
    return (m?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  };
  // Split the file into the two vars blocks: prod is the base [vars], staging is [env.staging.vars].
  const prodJobs = parseCronEnabled('vars');
  const stagingJobs = parseCronEnabled('env\\.staging\\.vars');
  // Production must keep reminders (scheduler unchanged in prod).
  expect(prodJobs).toContain('reminders');
  // Staging must NOT include reminders while outbox is paused and WAHA is prepared.
  expect(stagingJobs).not.toContain('reminders');
  // Other jobs are preserved in staging where possible.
  expect(stagingJobs).toContain('cleanup');
  expect(stagingJobs).toContain('hot-leads');
  expect(stagingJobs).toContain('followups');
});
