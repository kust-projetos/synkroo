import type { OutboxJob } from './outbox-repository';
import { dispatchNextOutbox } from './dispatch-outbox';
import { dispatchChargeJob } from '@/modules/financeiro/services/dispatch-charge-job';
import { dispatchCampaignRecipientJob, markCampaignRecipientDeadLetter } from '@/modules/followup/services/dispatch-campaign-recipient';
import { dispatchInboundMessageJob } from '@/modules/atendimento/services/dispatch-inbound-message';
import { dispatchOutboundMessageJob } from '@/modules/atendimento/services/dispatch-outbound-message';
import { dispatchContactChangedJob } from '@/modules/crm/services/dispatch-contact-changed-job';
import { OUTBOX_OPERATIONS, type OutboxOperation } from './operations';

type OutboxHandlerDefinition = {
  operation: OutboxOperation;
  moduleId: string;
  handle(job: OutboxJob): Promise<void>;
  onDeadLetter?(job: OutboxJob, error: unknown): Promise<void>;
};

const HANDLERS: OutboxHandlerDefinition[] = [
  { operation: OUTBOX_OPERATIONS.FINANCE_CHARGE_CREATE, moduleId: 'financeiro', handle: dispatchChargeJob },
  { operation: OUTBOX_OPERATIONS.FINANCE_CHARGE_CANCEL, moduleId: 'financeiro', handle: dispatchChargeJob },
  { operation: OUTBOX_OPERATIONS.FOLLOWUP_CAMPAIGN_RECIPIENT, moduleId: 'followup', handle: dispatchCampaignRecipientJob, onDeadLetter: markCampaignRecipientDeadLetter },
  { operation: OUTBOX_OPERATIONS.ATENDIMENTO_INBOUND_MESSAGE, moduleId: 'atendimento', handle: dispatchInboundMessageJob },
  { operation: OUTBOX_OPERATIONS.ATENDIMENTO_OUTBOUND_MESSAGE, moduleId: 'atendimento', handle: dispatchOutboundMessageJob },
  { operation: OUTBOX_OPERATIONS.CRM_CONTACT_CHANGED, moduleId: 'crm', handle: dispatchContactChangedJob },
];

const handlerMap = new Map(HANDLERS.map((h) => [h.operation, h]));

function isKnownOperation(operation: string): operation is OutboxOperation {
  return HANDLERS.some((handler) => handler.operation === operation);
}

export async function processOutboxBatch(limit = 25, concurrency = 5) {
  const { createManifest } = await import('@/core/modules/manifest');
  const manifest = createManifest();
  const enabled = await manifest.enabledModules();
  const allowedOps = HANDLERS.filter((h) => enabled.has(h.moduleId)).map((h) => h.operation);
  // Detect unknown pending operations against ALL known operations (not just enabled) — observable, fail-open for monitoring
  const { getDb } = await import('@/lib/db/client');
  const { sql } = await import('drizzle-orm');
  try {
    const db: any = getDb();
    const knownOps = HANDLERS.map((h) => h.operation);
    const unknownQuery = sql`SELECT DISTINCT operation FROM outbox_jobs WHERE status = 'pending' AND operation NOT IN (${sql.join(knownOps.map((o) => sql`${o}`), sql`, `)}) LIMIT 5`;
    const unknown = await db.execute(unknownQuery);
    const rows = (unknown as any)?.rows ?? unknown;
    if (Array.isArray(rows) && rows.length > 0) {
      console.error('[outbox] unknown pending operations:', rows.map((r: any) => r.operation));
    }
  } catch (err) {
    console.error('[outbox] diagnostic query failed:', err);
  }

  const results: Array<{ status: string; jobId?: string }> = [];
  let dispatched = 0;
  const takeSlot = (): boolean => {
    if (dispatched >= limit) return false;
    dispatched += 1;
    return true;
  };
  // Worker pool com concorrência fixa, cada worker faz claim com SKIP LOCKED
  const workers = Array.from({ length: Math.min(concurrency, limit) }, async () => {
    while (takeSlot()) {
      const result = await dispatchNextOutbox(async (job) => {
        if (!isKnownOperation(job.operation)) {
          throw new Error(`UNKNOWN_OUTBOX_OPERATION:${job.operation}`);
        }
        const def = handlerMap.get(job.operation);
        if (!def) throw new Error(`UNKNOWN_OUTBOX_OPERATION:${job.operation}`);
        await def.handle(job);
      }, {
        operations: allowedOps,
        onDeadLetter: async (job, err) => {
          const def = isKnownOperation(job.operation) ? handlerMap.get(job.operation) : undefined;
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
