import { defineConfig } from 'drizzle-kit';

function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;

  const host = process.env.POSTGRES_HOST || '127.0.0.1';
  const port = process.env.POSTGRES_PORT || '55432';
  const database = process.env.POSTGRES_DB || 'synkroo';
  const user = process.env.POSTGRES_USER || 'synkroo';
  const password = process.env.POSTGRES_PASSWORD || 'change-me-local-dev-password';

  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './src/lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: getDatabaseUrl(),
  },
});
