import { readFileSync } from 'fs';
import { join } from 'path';

const CHANNEL_SERVICE = join(process.cwd(), 'src/modules/atendimento/services/channel-service.ts');

it('channel-service does not import playwright at all (Workers runtime safe & zero bundle bloat)', () => {
  const src = readFileSync(CHANNEL_SERVICE, 'utf8');
  expect(src).not.toMatch(/from\s+['"]playwright['"]/);
  expect(src).not.toMatch(/import\(['"]playwright['"]\)/);
});

it('channel-service does not import the Evolution leaf directly (P3.1 provider abstraction)', () => {
  const src = readFileSync(CHANNEL_SERVICE, 'utf8');
  expect(src).not.toMatch(/from\s+['"][^'"]*evolution-service['"]/);
  expect(src).not.toMatch(/import\(\s*['"][^'"]*evolution-service['"]\s*\)/);
  expect(src).not.toMatch(/getEvolutionService/);
  expect(src).not.toMatch(/EvolutionApiService/);
});

it('channel-service resolves providers through the registry seam (P3.1)', () => {
  const src = readFileSync(CHANNEL_SERVICE, 'utf8');
  expect(src).toMatch(/integrations\/whatsapp-provider-registry/);
  expect(src).toMatch(/getWhatsAppProviderAdapter\(\s*'evolution'\s*\)/);
});
