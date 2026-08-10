import openNextWorker from './.open-next/worker.js';
export { DOQueueHandler } from './.open-next/.build/durable-objects/queue.js';

const OUTBOX_PATH = '/api/cron/outbox?limit=25';

function outboxEndpoint(env) {
  const baseUrl = env.OUTBOX_WORKER_URL;
  if (!baseUrl) throw new Error('OUTBOX_WORKER_URL is required');
  return new URL(OUTBOX_PATH, baseUrl).toString();
}

async function runOutboxCron(env) {
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) throw new Error('CRON_SECRET is required for outbox cron');
  const response = await fetch(outboxEndpoint(env), {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
  });
  if (!response.ok) throw new Error(`OUTBOX_CRON_FAILED:${response.status}`);
}

const worker = {
  fetch(request, env, ctx) {
    return openNextWorker.fetch(request, env, ctx);
  },
  scheduled(_controller, env, ctx) {
    ctx.waitUntil(runOutboxCron(env));
  },
};

export default worker;
