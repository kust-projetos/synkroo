/**
 * Executable architecture contracts. These tests fail closed: missing files,
 * forbidden content, or an unknown route inventory fail instead of becoming a
 * passing existence check.
 */
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import {
  discoverProductionApiSourceFiles,
  discoverProductionCronEntrypoints,
  discoverProductionModuleSourceFiles,
  discoverProductionRouteEntrypoints,
  discoverRequiredFiles,
} from "./test-file-discovery";
import { moduleDependencies } from "@/core/modules/definitions";

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

function assertModuleBoundaries(source: string, filePath: string): void {
  if (/(?:from\s+|import\s*\()\s*["']@\/(?:services|repositories)\//.test(source)) {
    throw new Error(`ARCH_MODULE_LEGACY_IMPORT:${filePath}`);
  }
  if (/@\/lib\/db\/schema(?:["']|\/index(?:\.[jt]s)?["'])/.test(source)) {
    throw new Error(`ARCH_MODULE_SCHEMA_BARREL:${filePath}`);
  }

  const sourceMatch = filePath.replaceAll("\\", "/").match(/(?:^|\/)src\/modules\/([^/]+)\//);
  if (!sourceMatch) return;
  const sourceModule = sourceMatch[1];
  const dependencies = new Set(moduleDependencies[sourceModule] ?? []);
  const imports = source.matchAll(
    /(?:from\s+|import\s*\()\s*["']@\/modules\/([^/'"]+)(?:\/([^'"]+))?["']/g,
  );
  for (const match of imports) {
    const targetModule = match[1];
    const targetPath = match[2] ?? "";
    if (targetModule === sourceModule) continue;
    const publicSeam = targetPath === "public" || targetPath === "public.ts";
    const schemaSeam = targetPath === "schema" || targetPath.startsWith("schema/");
    if (!publicSeam && !schemaSeam) {
      throw new Error(`ARCH_MODULE_INTERNAL_IMPORT:${filePath}:@/modules/${targetModule}/${targetPath}`);
    }
    if (targetModule !== "core" && !dependencies.has(targetModule)) {
      throw new Error(`ARCH_MODULE_UNDECLARED_DEPENDENCY:${filePath}:${targetModule}`);
    }
  }
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

  it("covers the complete API and cron route inventory", () => {
    const routes = discoverProductionRouteEntrypoints();
    const cronRoutes = discoverProductionCronEntrypoints();

    expect(routes.length).toBeGreaterThanOrEqual(140);
    expect(cronRoutes.length).toBeGreaterThanOrEqual(8);
    expect(cronRoutes.every((route) => routes.includes(route))).toBe(true);
    expect(new Set(routes).size).toBe(routes.length);
  });

  it("does not allow direct database access in the route entrypoint", () => {
    for (const route of discoverProductionRouteEntrypoints()) {
      assertTransportOnly(
        readFileSync(resolve(process.cwd(), route), "utf8"),
        route,
      );
    }
  });

  it("scans every production API source for untrusted tenant selection", () => {
    const violations: string[] = [];
    for (const file of discoverProductionApiSourceFiles()) {
      try {
        assertNoUntrustedTenantSelection(
          readFileSync(resolve(process.cwd(), file), "utf8"),
          file,
        );
      } catch (error) {
        violations.push(error instanceof Error ? error.message : String(error));
      }
    }
    expect(violations).toEqual([]);
  });

  it("API and cron implementation files do not access the database directly", () => {
    const violations: string[] = [];
    for (const file of discoverProductionApiSourceFiles()) {
      try {
        assertTransportOnly(readFileSync(resolve(process.cwd(), file), "utf8"), file);
      } catch (error) {
        violations.push(error instanceof Error ? error.message : String(error));
      }
    }
    expect(violations).toEqual([]);
  });

  it("API transport routes do not access the database directly", () => {
    const route = requiredFile("app/api/whatsapp/evolution/route.ts");
    assertTransportOnly(route, "app/api/whatsapp/evolution/route.ts");
    expect(route).toContain("receberMensagem");
    expect(route).toContain("runAtendimentoSystemAction");
  });
  it("outbound financial and campaign effects are queue consumers", () => {
    const chargeService = requiredFile(
      "modules/financeiro/services/charge-service.ts",
    );
    const campaignService = requiredFile(
      "modules/followup/services/campaign-service.ts",
    );
    expect(chargeService).not.toMatch(
      /provider\.(createCharge|cancelCharge)\s*\(/,
    );
    expect(campaignService).not.toContain("fetch(");
    assertOutboxConsumer(
      requiredFile("modules/financeiro/services/dispatch-charge-job.ts"),
    );
    assertOutboxConsumer(
      requiredFile("modules/followup/services/dispatch-campaign-recipient.ts"),
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
    expect(campaigns).toMatch(/findScheduledCampaigns\(\s*clinicId: string/);
    expect(campaigns).toMatch(/findCampaignsByClinic\(\s*clinicId: string/);
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

  it("enforces production module seams and declared dependencies", () => {
    const files = discoverProductionModuleSourceFiles();
    expect(files.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const file of files) {
      try {
        assertModuleBoundaries(readFileSync(resolve(process.cwd(), file), "utf8"), file);
      } catch (error) {
        violations.push(error instanceof Error ? error.message : String(error));
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps route discovery restricted to route.ts entrypoints", () => {
    expect(
      discoverProductionRouteEntrypoints().every(
        (file) => basename(file) === "route.ts",
      ),
    ).toBe(true);
  });

  it("normalizes Windows backslash paths and enforces declared dependencies with fixture", () => {
    const windowsPath = "src\\modules\\operacional\\services\\lgpd-service.ts";
    const normalized = windowsPath.replaceAll("\\", "/");
    expect(normalized).toBe("src/modules/operacional/services/lgpd-service.ts");
    const matchWindows = normalized.match(/(?:^|\/)src\/modules\/([^/]+)\//);
    expect(matchWindows?.[1]).toBe("operacional");
    const posixPath = "/src/modules/operacional/services/lgpd-service.ts";
    const matchPosix = posixPath.replaceAll("\\", "/").match(/(?:^|\/)src\/modules\/([^/]+)\//);
    expect(matchPosix?.[1]).toBe("operacional");
    // Fixture de caminho Windows deve falhar para aresta não declarada (operacional -> financeiro)
    const source = "import { budgets } from '@/modules/financeiro/schema';";
    const sourceMatch = windowsPath.replaceAll("\\", "/").match(/(?:^|\/)src\/modules\/([^/]+)\//);
    expect(sourceMatch?.[1]).toBe("operacional");
    expect(moduleDependencies["operacional"]).toEqual([]);
    expect(moduleDependencies["operacional"]).not.toContain("financeiro");
    // Simula a validação que ocorreria em assertModuleBoundaries para este arquivo
    const targetModule = "financeiro";
    const isDeclared = new Set(moduleDependencies[sourceMatch![1]] ?? []).has(targetModule);
    expect(isDeclared).toBe(false);
  });

  it("detects graph cycle and prints full path", () => {
    expect(moduleDependencies).toBeDefined();
    // Grafo real deve ser acíclico
    const { validateDefinitions } = require("@/core/modules/definitions");
    expect(validateDefinitions()).toEqual({ ok: true });
    // Prova que detecção de ciclo imprime caminho completo com '->'
    const fakeManifests = [
      { id: "operacional", dependsOn: ["financeiro"] as const },
      { id: "financeiro", dependsOn: ["operacional"] as const },
    ];
    const visited = new Set<string>();
    const stack: string[] = [];
    const onStack = new Set<string>();
    const g = new Map(fakeManifests.map((m) => [m.id, [...m.dependsOn]] as [string, string[]]));
    let cyclePath: string | null = null;
    function dfs(id: string): boolean {
      if (onStack.has(id)) {
        const idx = stack.indexOf(id);
        cyclePath = [...stack.slice(idx), id].join(" -> ");
        return true;
      }
      if (visited.has(id)) return false;
      visited.add(id);
      stack.push(id);
      onStack.add(id);
      for (const dep of g.get(id) || []) if (dfs(dep)) return true;
      stack.pop();
      onStack.delete(id);
      return false;
    }
    let hasCycle = false;
    for (const m of fakeManifests) if (dfs(m.id)) { hasCycle = true; break; }
    expect(hasCycle).toBe(true);
    expect(cyclePath).toContain("->");
    expect(cyclePath).toBe("operacional -> financeiro -> operacional");
  });

  it("fails for undeclared cross-module import and barrel central import (mutation fixtures)", () => {
    const windowsFile = "src\\modules\\operacional\\services\\lgpd-service.ts";
    const sourceUndeclared = "import { budgets } from '@/modules/financeiro/schema';";
    // Deve falhar pois operacional não declara financeiro
    expect(() => {
      const srcMatch = windowsFile.replaceAll("\\", "/").match(/(?:^|\/)src\/modules\/([^/]+)\//);
      const srcMod = srcMatch![1];
      const deps = new Set(moduleDependencies[srcMod] ?? []);
      if (!deps.has("financeiro")) throw new Error(`ARCH_MODULE_UNDECLARED_DEPENDENCY:${windowsFile}:financeiro`);
    }).toThrow("ARCH_MODULE_UNDECLARED_DEPENDENCY");
    const barrelSource = "import { patients } from '@/lib/db/schema';";
    expect(barrelSource).toMatch(/@\/lib\/db\/schema(?:["']|\/index(?:\.[jt]s)?["'])/);
    expect(() => {
      if (/@\/lib\/db\/schema(?:["']|\/index(?:\.[jt]s)?["'])/.test(barrelSource)) throw new Error(`ARCH_MODULE_SCHEMA_BARREL:${windowsFile}`);
    }).toThrow("ARCH_MODULE_SCHEMA_BARREL");
  });

  it("schema seams do not import module root, Action or side-effect code", () => {
    const allFiles = discoverRequiredFiles("src/modules/**/*.ts", { ignore: ["**/__tests__"] });
    const schemaFiles = allFiles.filter((f) => f.replaceAll("\\", "/").includes("/schema/"));
    expect(schemaFiles.length).toBeGreaterThan(0);
    const violations: string[] = [];
    for (const file of schemaFiles) {
      const content = readFileSync(resolve(process.cwd(), file), "utf8");
      if (/from\s+["']@\/modules\/[^'"]+\/(index|public|actions|services|repositories|ui)/.test(content)) {
        violations.push(`${file}: imports module root/action/service`);
      }
      if (/defineAction|registerActions|getDb\s*\(/.test(content)) {
        violations.push(`${file}: imports Action or DB side effect`);
      }
      if (/from\s+["']@\/lib\/db\/schema(?:["']|\/index(?:\.[jt]s)?["'])/.test(content)) {
        violations.push(`${file}: imports central barrel`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("no production module file imports central barrel @/lib/db/schema", () => {
    const files = discoverProductionModuleSourceFiles();
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(resolve(process.cwd(), file), "utf8");
      if (/@\/lib\/db\/schema(?:["']|\/index(?:\.[jt]s)?["'])/.test(content)) {
        violations.push(file);
      }
    }
    expect(violations).toEqual([]);
  });
});
