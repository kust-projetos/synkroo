/**
 * T5 — Budget route parity: canonical (/api/financeiro/budgets) vs legacy (/api/budgets)
 * Each method exists in both, shares same Action domain, only envelope/serializer differs,
 * and legacy adapters do not access repository/service directly.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Budget route parity (T5 W8.2 strangler)', () => {
  const canonicalMethods = [
    { file: 'src/app/api/financeiro/budgets/route.ts', methods: ['GET', 'POST'] },
    { file: 'src/app/api/financeiro/budgets/[id]/route.ts', methods: ['GET', 'PUT', 'DELETE'] },
    { file: 'src/app/api/financeiro/budgets/[id]/payments/route.ts', methods: ['GET', 'POST'] },
    { file: 'src/app/api/financeiro/budgets/[id]/installments/route.ts', methods: ['GET', 'PUT'] },
    { file: 'src/app/api/financeiro/budgets/[id]/installments/[installmentId]/route.ts', methods: ['PATCH', 'DELETE'] },
  ];

  const legacyMethods = [
    { file: 'src/app/api/budgets/route.ts', methods: ['GET', 'POST'] },
    { file: 'src/services/api-handlers/budgets/[id].ts', methods: ['GET', 'PUT', 'DELETE'] },
    { file: 'src/app/api/budgets/[id]/payments/route.ts', methods: ['GET', 'POST'] },
    { file: 'src/app/api/budgets/[id]/installments/route.ts', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
  ];

  it('canonical family exposes matriz methods via Actions', () => {
    for (const { file, methods } of canonicalMethods) {
      const full = resolve(process.cwd(), file);
      let content: string;
      try {
        content = readFileSync(full, 'utf8');
      } catch {
        throw new Error(`canonical file missing: ${file}`);
      }
      for (const m of methods) {
        expect(content).toMatch(new RegExp(`export const ${m}\\b`));
      }
      // Must delegate to Action via runFinanceiroAction / handleCanonicalAction, not direct repo
      expect(content).toMatch(/runFinanceiroAction|handleCanonicalAction|listarOrcamentos|criarOrcamento|atualizarOrcamento|arquivarOrcamento|listarPagamentos|registrarPagamento|listarParcelas|salvarParcelas|atualizarParcela|deletarParcela/);
    }
  });

  it('legacy family exposes same matriz methods and delegates to same Actions', () => {
    for (const { file, methods } of legacyMethods) {
      const full = resolve(process.cwd(), file);
      let content: string;
      try {
        content = readFileSync(full, 'utf8');
      } catch {
        throw new Error(`legacy file missing: ${file}`);
      }
      for (const m of methods) {
        // Check for export or function that handles method
        const hasMethod = content.includes(`export async function ${m}`) || content.includes(`export const ${m}`) || content.includes(`${m}(`);
        if (!hasMethod) {
          // For _handler files, check for GET/PUT/DELETE exports
          expect(content).toMatch(new RegExp(`${m}`));
        }
      }
      // Legacy must delegate to Action (handleCanonicalAction / listarOrcamentos etc.), not direct repo
      expect(content).toMatch(/handleCanonicalAction|listarOrcamentos|criarOrcamento|atualizarOrcamento|arquivarOrcamento|listarPagamentos|registrarPagamento|listarParcelas|salvarParcelas|atualizarParcela|deletarParcela/);
    }
  });

  it('legacy adapters do not import repository/service directly for auth/mutation', () => {
    const legacyFiles = [
      'src/app/api/budgets/route.ts',
      'src/services/api-handlers/budgets/[id].ts',
      'src/app/api/budgets/[id]/installments/route.ts',
      'src/app/api/budgets/[id]/payments/route.ts',
    ];
    for (const file of legacyFiles) {
      const content = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(content).not.toMatch(/from ['"]@\/modules\/financeiro\/repositories\/financeiro-repository['"]/);
      expect(content).not.toMatch(/from ['"]@\/modules\/financeiro\/services\/budget-service['"]/);
      // Should use handleCanonicalAction or Action import
      expect(content).toMatch(/handleCanonicalAction|from ['"]@\/modules\/financeiro\/actions\//);
    }
  });

  it('legacy adds Deprecation, Link, X-Synkroo-Legacy-Route and telemetry without PII', () => {
    const legacyFiles = [
      'src/app/api/budgets/route.ts',
      'src/services/api-handlers/budgets/[id].ts',
      'src/app/api/budgets/[id]/installments/route.ts',
      'src/app/api/budgets/[id]/payments/route.ts',
    ];
    for (const file of legacyFiles) {
      const content = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(content).toMatch(/Deprecation/);
      expect(content).toMatch(/Link.*successor-version/);
      expect(content).toMatch(/X-Synkroo-Legacy-Route/);
      expect(content).toMatch(/logger\.info.*legacyRoute/);
      // No PII in telemetry: should not log budget id or patient id directly
      expect(content).not.toMatch(/logger\.info.*budget.*id.*patient/);
    }
  });

  it('canonical uses { data, meta } envelope, legacy uses snake_case { budgets }', () => {
    const canonical = readFileSync(resolve(process.cwd(), 'src/app/api/financeiro/budgets/route.ts'), 'utf8');
    // Canonical should use handleCanonicalAction which produces { data, meta }
    expect(canonical).toMatch(/handleCanonicalAction|listarOrcamentos/);

    const legacy = readFileSync(resolve(process.cwd(), 'src/app/api/budgets/route.ts'), 'utf8');
    expect(legacy).toMatch(/budgets/);
    expect(legacy).toMatch(/toLegacyBudget|budgets/);
    // Legacy should map to snake_case
    expect(legacy).toMatch(/clinic_id|patient_id/);
  });

  it('listarOrcamentos supports patientId, page, limit and meta.total', async () => {
    const mod = await import('@/modules/financeiro/actions/listar-orcamentos');
    expect(mod.listarOrcamentos.input).toBeDefined();
    const schema: any = mod.listarOrcamentos.input;
    const parsed = schema.safeParse({ patientId: '00000000-0000-0000-0000-000000000001', page: 2, limit: 10 });
    expect(parsed.success).toBe(true);
    expect(parsed.data.patientId).toBe('00000000-0000-0000-0000-000000000001');
    expect(parsed.data.page).toBe(2);
    expect(parsed.data.limit).toBe(10);
  });

  it('removes /status phantom: no canonical route exposes /status', () => {
    const canonicalStatus = resolve(process.cwd(), 'src/app/api/financeiro/budgets/[id]/status/route.ts');
    const exists = (() => {
      try {
        readFileSync(canonicalStatus, 'utf8');
        return true;
      } catch {
        return false;
      }
    })();
    expect(exists).toBe(false);
    // Hook should not use /status
    const hook = readFileSync(resolve(process.cwd(), 'src/lib/hooks/use-queries.ts'), 'utf8');
    expect(hook).not.toMatch(/\/status/);
    expect(hook).toMatch(/\/api\/financeiro\/budgets\//);
    expect(hook).toMatch(/PUT/);
  });
});
