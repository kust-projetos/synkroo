/**
 * Executable architecture contracts. These tests fail closed: missing files,
 * forbidden content, or an unknown route inventory fail instead of becoming a
 * passing existence check.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import {
  discoverProductionRouteEntrypoints,
  discoverRequiredFiles,
} from "./test-file-discovery";

const SRC = resolve(__dirname, "../..");
const DIRECT_DATABASE =
  /getDb\s*\(|from ['"]drizzle-orm['"]|from ['"]@\/lib\/db/;
const UNTRUSTED_TENANT = [
  /(?:searchParams|params|sp)\.get\(['"]clinic[_I]d['"]\)/,
  /body\.clinic[_I]d\b/,
  /body\[['"]clinic[_I]d['"]\]/,
];

function requiredFile(relativePath: string): string {
  const path = resolve(SRC, relativePath);
  if (!existsSync(path))
    throw new Error(`ARCH_REQUIRED_FILE_MISSING:${relativePath}`);
  return readFileSync(path, "utf8");
}

function assertTransportOnly(source: string, filePath = "fixture"): void {
  if (DIRECT_DATABASE.test(source)) {
    throw new Error(
      `ARCH_TRANSPORT_FORBIDDEN:${filePath}:direct_database_access`,
    );
  }
}

function routeImplementation(routePath: string): string {
  const normalized = routePath.replaceAll("\\", "/");
  const routeFile = resolve(process.cwd(), normalized);
  const handlerPath = resolve(dirname(routeFile), "_handler.ts");
  const routeSource = readFileSync(routeFile, "utf8");
  const implementation = existsSync(handlerPath)
    ? readFileSync(handlerPath, "utf8")
    : "";
  return `${normalized}\n${routeSource}\n${implementation}`;
}

function assertNoUntrustedTenantSelection(
  source: string,
  filePath: string,
): void {
  for (const pattern of UNTRUSTED_TENANT) {
    if (pattern.test(source)) {
      throw new Error(`ARCH_TENANT_FORBIDDEN:${filePath}:${pattern}`);
    }
  }
}

function assertOutboxConsumer(source: string): void {
  expect(source).toContain("dispatchNextOutbox");
  expect(source).toContain("operation");
}

describe("Boundary Rules (Spec Section 5)", () => {
  it("fails closed for violating transport fixtures", () => {
    expect(() =>
      assertTransportOnly("import { getDb } from '@/lib/db/client';"),
    ).toThrow("ARCH_TRANSPORT_FORBIDDEN");
    expect(() =>
      assertTransportOnly("import { eq } from 'drizzle-orm';"),
    ).toThrow("ARCH_TRANSPORT_FORBIDDEN");
    expect(() =>
      assertTransportOnly(
        "export async function GET() { return runActionRoute(); }",
      ),
    ).not.toThrow();
  });

  it("discovers and scans every production API route entrypoint", () => {
    const routes = discoverProductionRouteEntrypoints();
    expect(routes.length).toBeGreaterThanOrEqual(140);
    expect(new Set(routes).size).toBe(routes.length);

    const violations: string[] = [];
    for (const route of routes) {
      try {
        assertTransportOnly(
          requiredFile(route.replaceAll("\\", "/").replace(/^src\//, "")),
          route,
        );
        assertNoUntrustedTenantSelection(routeImplementation(route), route);
      } catch (error) {
        violations.push(error instanceof Error ? error.message : String(error));
      }
    }
    expect(violations).toEqual([]);
  });

  it("does not allow direct database access in the route entrypoint", () => {
    for (const route of discoverProductionRouteEntrypoints()) {
      assertTransportOnly(
        readFileSync(resolve(process.cwd(), route), "utf8"),
        route,
      );
    }
  });

  it("API transport routes do not access the database directly", () => {
    const route = requiredFile("app/api/whatsapp/evolution/route.ts");
    assertTransportOnly(route, "app/api/whatsapp/evolution/route.ts");
    expect(route).toContain("processEvolutionMessage");
  });

  it("outbound financial and campaign effects are queue consumers", () => {
    const chargeService = requiredFile(
      "modules/financeiro/services/charge-service.ts",
    );
    const campaignService = requiredFile(
      "services/followup/campaign.service.ts",
    );
    expect(chargeService).not.toMatch(
      /provider\.(createCharge|cancelCharge)\s*\(/,
    );
    expect(campaignService).not.toContain("fetch(");
    assertOutboxConsumer(
      requiredFile("modules/financeiro/services/dispatch-charge-job.ts"),
    );
    assertOutboxConsumer(
      requiredFile("services/followup/dispatch-campaign-recipient.ts"),
    );
  });

  it("tenant repositories require clinic scope at their public boundary", () => {
    const financeiro = requiredFile(
      "modules/financeiro/repositories/financeiro-repository.ts",
    );
    expect(financeiro).toMatch(
      /findPaymentChargeByBudget\(clinicId: string, budgetId: string\)/,
    );
    expect(financeiro).toMatch(/listOverdueCharges\(clinicId: string\)/);
    const campaigns = requiredFile("repositories/campaigns/index.ts");
    expect(campaigns).toMatch(/findScheduledCampaigns\(clinicId: string/);
    expect(campaigns).toMatch(/findCampaignsByClinic\(clinicId: string/);
  });

  it("source discovery fails closed instead of accepting an empty tree", () => {
    expect(() =>
      discoverRequiredFiles(`${SRC}/modules/financeiro/**/*.ts`, {
        ignore: ["**/*.test.*"],
      }),
    ).not.toThrow();
    expect(() =>
      discoverRequiredFiles(`${SRC}/__missing_architecture_fixture__/**/*.ts`),
    ).toThrow("ARCH_SCAN_EMPTY");
  });

  it("keeps route discovery restricted to route.ts entrypoints", () => {
    expect(
      discoverProductionRouteEntrypoints().every(
        (file) => basename(file) === "route.ts",
      ),
    ).toBe(true);
  });
});
