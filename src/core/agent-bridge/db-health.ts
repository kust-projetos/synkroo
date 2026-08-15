export type DbHealthQuery = () => Promise<unknown>

export async function runDbHealthCheck(query: DbHealthQuery): Promise<{ ok: true }> {
  await query()
  return { ok: true }
}
