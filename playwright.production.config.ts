import { loadEnvConfig } from "@next/env";
import baseConfig, { E2E_CRON_SECRET, E2E_OUTBOX_RELEASE_ID } from "./playwright.config";

loadEnvConfig(process.cwd());

// Sinaliza aos specs que rodam sob `next start` (NODE_ENV=production).
// Usado para pular fluxos bloqueados de propósito em prod (ex.: /signup → 404, ADR-BASE-11).
process.env.E2E_PRODUCTION = '1';
process.env.CRON_SECRET = E2E_CRON_SECRET;
process.env.OUTBOX_RELEASE_ID = E2E_OUTBOX_RELEASE_ID;

function normalizeDatabaseUrl(value: string | undefined): string | undefined {
  if (!value) return value;

  try {
    const url = new URL(value);
    if (url.hostname === "localhost") url.hostname = "127.0.0.1";
    return url.toString();
  } catch {
    return value;
  }
}

const databaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
process.env.NEXTAUTH_URL = "http://127.0.0.1:3003";

const productionConfig = {
  ...baseConfig,
  retries: 0,
  webServer: {
    ...baseConfig.webServer,
    command: "node scripts/next-start-safe.mjs -p 3003",
    timeout: 300000,
    env: {
      ...process.env,
      NEXTAUTH_URL: "http://127.0.0.1:3003",
      CRON_SECRET: E2E_CRON_SECRET,
      OUTBOX_RELEASE_ID: E2E_OUTBOX_RELEASE_ID,
      ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
    },
  },
};

export default productionConfig;
