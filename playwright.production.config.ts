import { loadEnvConfig } from "@next/env";
import baseConfig from "./playwright.config";

loadEnvConfig(process.cwd());

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
    command: "npx next start -p 3003",
    timeout: 300000,
    env: {
      ...process.env,
      NEXTAUTH_URL: "http://127.0.0.1:3003",
      ...(databaseUrl ? { DATABASE_URL: databaseUrl } : {}),
    },
  },
};

export default productionConfig;
