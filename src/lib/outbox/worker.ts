import type { OutboxJob } from './outbox-repository';
import { dispatchNextOutbox } from './dispatch-outbox';
import { dispatchChargeJob } from '@/modules/financeiro/services/dispatch-charge-job';
import { dispatchCampaignRecipientJob, markCampaignRecipientDeadLetter } from '@/services/followup/dispatch-campaign-recipient';

type OutboxHandlerDefinition = {
  operation: string;
  moduleId: string;
  handle(job: OutboxJob): Promise<void>;
  onDeadLetter?(job: OutboxJob, error: unknown): Promise<void>;
};

const HANDLERS: OutboxHandlerDefinition[] = [
  { operation: 'financeiro.charge.create', moduleId: 'financeiro', handle: dispatchChargeJob },
  { operation: 'financeiro.charge.cancel', moduleId: 'financeiro', handle: dispatchChargeJob },
  { operation: 'followup.campaign.recipient', moduleId: 'followup', handle: dispatchCampaignRecipientJob, onDeadLetter: markCampaignRecipientDeadLetter },
];

const handlerMap = new Map(HANDLERS.map((h) => [h.operation, h]));

export async function processOutboxBatch(limit = 25, concurrency = 5) {
  const { createManifest } = await import('@/core/modules/manifest');
  const manifest = createManifest();
  const enabled = await manifest.enabledModules();
  const allowedOps = HANDLERS.filter((h) => enabled.has(h.moduleId) && enabled.has(h.moduleId)).map((h) => h.operation);
  // Detect unknown pending operations before batch (observável, não invisible pelo filtro de claim)
  const { getDb } = await import('@/lib/db/client');
  const { outboxJobs } = await import('@/lib/db/schema/infra');
  const { sql } = await import('drizzle-orm');
  try {
    const db: any = getDb();
    const unknown = await db.execute(sql`SELECT DISTINCT operation FROM outbox_jobs WHERE status = 'pending' AND operation NOT IN (${sql.join(allowedOps.map((o) => sql`${o}`), sql`, `)}) LIMIT 5`);
    const rows = (unknown as any)?.rows ?? unknown;
    if (Array.isArray(rows) && rows.length > 0) {
      console.error('[outbox] unknown pending operations:', rows.map((r: any) => r.operation));
    }
  } catch {}

  const results: Array<{ status: string; jobId?: string }> = [];
  const queue = Array.from({ length: Math.min(limit, allowedOps.length > 0 ? limit : 0) });
  // Worker pool com concorrência fixa, cada worker faz claim com SKIP LOCKED
  const workers = Array.from({ length: Math.min(concurrency, limit) }, async () => {
    while (results.length < limit) {
      const result = await dispatchNextOutbox(async (job) => {
        const def = handlerMap.get(job.operation);
        if (!def) throw new Error(`UNKNOWN_OUTBOX_OPERATION:${job.operation}`);
        await def.handle(job);
      }, {
        operations: allowedOps,
        onDeadLetter: async (job, err) => {
          const def = handlerMap.get(job.operation);
          if (def?.onDeadLetter) await def.onDeadLetter(job, err);
        },
      });
      results.push(result);
      if (result.status === 'empty') break;
    }
  });
  await Promise.all(workers);
  return results.slice(0, limit);
}

export const outboxOperations = HANDLERS.map((h) => h.operation);
