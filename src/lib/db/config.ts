export function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL
  }

  const host = process.env.POSTGRES_HOST || '127.0.0.1'
  const port = process.env.POSTGRES_PORT || '55432'
  const database = process.env.POSTGRES_DB || 'synkroo'
  const user = process.env.POSTGRES_USER || 'synkroo'
  const password = process.env.POSTGRES_PASSWORD || 'synkroo'

  return `postgresql://${user}:${password}@${host}:${port}/${database}`
}
