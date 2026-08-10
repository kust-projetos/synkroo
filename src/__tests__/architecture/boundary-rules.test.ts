/**
 * Executable architecture contracts. These tests fail closed: missing files,
 * forbidden content, or an unknown fixture all fail instead of becoming a
 * passing existence check.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { discoverRequiredFiles } from './test-file-discovery';

const SRC = resolve(__dirname, '../..');

function requiredFile(relativePath: string): string {
  const path = resolve(SRC, relativePath);
  if (!existsSync(path)) throw new Error(`ARCH_REQUIRED_FILE_MISSING:${relativePath}`);
  return readFileSync(path, 'utf8');
}

function assertTransportOnly(source: string): void {
  const forbidden = [/getDb\s*\(/, /from ['"]drizzle-orm['"]/, /from ['"]@\/lib\/db/];
  for (const pattern of forbidden) {
    if (pattern.test(source)) throw new Error(`ARCH_TRANSPORT_FORBIDDEN:${pattern}`);
  }
}

function assertOutboxConsumer(source: string): void {
  expect(source).toContain('dispatchNextOutbox');
  expect(source).toContain('operation');
}

describe('Boundary Rules (Spec Section 5)', () => {
  it('fails closed for violating transport fixtures', () => {
    expect(() => assertTransportOnly("import { getDb } from '@/lib/db/client';")).toThrow('ARCH_TRANSPORT_FORBIDDEN');
    expect(() => assertTransportOnly("import { eq } from 'drizzle-orm';")).toThrow('ARCH_TRANSPORT_FORBIDDEN');
    expect(() => assertTransportOnly("export async function GET() { return runActionRoute(); }")).not.toThrow();
  });

  it('API transport routes do not access the database directly', () => {
    const route = requiredFile('app/api/whatsapp/evolution/route.ts');
    assertTransportOnly(route);
    expect(route).toContain('processEvolutionMessage');
  });

  it('outbound financial and campaign effects are queue consumers', () => {
    const chargeService = requiredFile('modules/financeiro/services/charge-service.ts');
    const campaignService = requiredFile('services/followup/campaign.service.ts');
    expect(chargeService).not.toMatch(/provider\.(createCharge|cancelCharge)\s*\(/);
    expect(campaignService).not.toContain('fetch(');
    assertOutboxConsumer(requiredFile('modules/financeiro/services/dispatch-charge-job.ts'));
    assertOutboxConsumer(requiredFile('services/followup/dispatch-campaign-recipient.ts'));
  });

  it('tenant repositories require clinic scope at their public boundary', () => {
    const financeiro = requiredFile('modules/financeiro/repositories/financeiro-repository.ts');
    expect(financeiro).toMatch(/findPaymentChargeByBudget\(clinicId: string, budgetId: string\)/);
    expect(financeiro).toMatch(/listOverdueCharges\(clinicId: string\)/);
    const campaigns = requiredFile('repositories/campaigns/index.ts');
    expect(campaigns).toMatch(/findScheduledCampaigns\(clinicId: string/);
    expect(campaigns).toMatch(/findCampaignsByClinic\(clinicId: string/);
  });

  it('source discovery fails closed instead of accepting an empty tree', () => {
    expect(() => discoverRequiredFiles(`${SRC}/modules/financeiro/**/*.ts`, { ignore: ['**/*.test.*'] })).not.toThrow();
    expect(() => discoverRequiredFiles(`${SRC}/__missing_architecture_fixture__/**/*.ts`)).toThrow('ARCH_SCAN_EMPTY');
  });
});
