import { chromium, type FullConfig } from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { testCredentials } from "./fixtures/test-data";
import { assertSeedPayload, type SeedPayload } from "./seed-validation";
import fs from "node:fs/promises";
import path from "node:path";

const AUTH_FILE = path.join(__dirname, ".auth", "admin.json");
const BASE_URL = "http://127.0.0.1:3003";

export default async function globalSetup(_config: FullConfig) {
  loadEnvConfig(process.cwd());
  const seedSecret = process.env.SEED_SECRET;
  if (!seedSecret)
    throw new Error(
      "E2E setup requires SEED_SECRET to create deterministic fixtures",
    );
  await fs.mkdir(path.dirname(AUTH_FILE), { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // Retry seed fetch on ECONNRESET / compilation race (dev server may need warmup)
    let seedResponse: import("@playwright/test").APIResponse | null = null;
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= 5; attempt++) {
      try {
        seedResponse = await page.request.get(
          `${BASE_URL}/api/seed?secret=${encodeURIComponent(seedSecret)}`,
          { timeout: 300_000 },
        );
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        const msg = String((e as Error)?.message ?? e);
        const isRetryable = msg.includes("ECONNRESET") || msg.includes("aborted") || msg.includes("Timeout");
        if (!isRetryable || attempt === 5) throw e;
        await new Promise((r) => setTimeout(r, attempt * 4000));
      }
    }
    if (!seedResponse) throw lastErr ?? new Error("seed fetch failed after retries");
    const seedBody = await seedResponse.text();
    let seedPayload: SeedPayload;
    try {
      seedPayload = JSON.parse(seedBody) as SeedPayload;
    } catch {
      throw new Error(
        `E2E fixture seed returned invalid JSON: status=${seedResponse.status()}; body=${seedBody.slice(0, 300).replace(/\s+/g, " ")}`,
      );
    }
    assertSeedPayload(seedResponse.status(), seedPayload, seedBody);
    const loginResponse = await page.goto(`${BASE_URL}/login`);
    if (!loginResponse || !loginResponse.ok())
      throw new Error(
        `E2E setup login page failed: ${loginResponse?.status()}`,
      );
    const csrfResponse = await page.request.get(`${BASE_URL}/api/auth/csrf`);
    if (!csrfResponse.ok())
      throw new Error(`E2E setup CSRF failed: ${csrfResponse.status()}`);
    const { csrfToken } = (await csrfResponse.json()) as { csrfToken?: string };
    if (!csrfToken)
      throw new Error("E2E setup CSRF response did not include a token");

    const callbackResponse = await page.request.post(
      `${BASE_URL}/api/auth/callback/credentials`,
      {
        form: {
          csrfToken,
          email: testCredentials.email,
          password: testCredentials.password,
          callbackUrl: `${BASE_URL}/dashboard`,
          json: "true",
        },
      },
    );
    if (!callbackResponse.ok()) {
      const body = (await callbackResponse.text())
        .slice(0, 500)
        .replace(/\s+/g, " ");
      throw new Error(
        `E2E setup credentials failed: status=${callbackResponse.status()}; body=${body}`,
      );
    }
    await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    if (page.url().includes("/login")) {
      const body = (await page.locator("body").innerText())
        .slice(0, 500)
        .replace(/\s+/g, " ");
      throw new Error(
        `E2E setup login redirect failed: url=${page.url()}; body=${body}`,
      );
    }
    const session = await page.evaluate(async () => {
      const response = await fetch("/api/auth/session");
      return { status: response.status, body: await response.json() };
    });
    if (session.status !== 200 || !session.body.authenticated) {
      throw new Error(`E2E setup session failed: status=${session.status}`);
    }
    const cookies = await page.context().cookies();
    if (
      !cookies.some((cookie) => cookie.name.endsWith("next-auth.session-token"))
    ) {
      throw new Error("E2E setup did not produce a NextAuth session cookie");
    }
    await page.context().storageState({ path: AUTH_FILE });
  } finally {
    await browser.close();
  }
}
