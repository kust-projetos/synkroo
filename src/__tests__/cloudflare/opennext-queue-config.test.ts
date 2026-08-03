import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('OpenNext revalidation queue configuration', () => {
  const root = resolve(__dirname, '../../..');
  const openNextConfig = readFileSync(resolve(root, 'open-next.config.ts'), 'utf8');
  const wranglerConfig = readFileSync(resolve(root, 'wrangler.toml'), 'utf8');

  it('uses the durable-object queue adapter instead of direct revalidation', () => {
    expect(openNextConfig).toContain('import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue"');
    expect(openNextConfig).toContain('queue: doQueue');
    expect(openNextConfig).not.toContain('queue: "direct"');
  });

  it('binds and migrates the OpenNext durable-object queue', () => {
    expect(wranglerConfig).toMatch(/name = "NEXT_CACHE_DO_QUEUE"[\s\S]*class_name = "DOQueueHandler"/);
    expect(wranglerConfig).toContain('new_sqlite_classes = ["DOQueueHandler"]');
  });

  it('binds the worker self-reference required by DOQueueHandler', () => {
    expect(wranglerConfig).toMatch(/binding = "WORKER_SELF_REFERENCE"[\s\S]*service = "synkroo"/);
  });
});
