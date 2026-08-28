import openNextWorker from './.open-next/worker.js';
export { DOQueueHandler } from './.open-next/.build/durable-objects/queue.js';

const OUTBOX_PATH = '/api/cron/outbox?limit=25';

async function runOutboxCron(env) {
  const cronSecret = env.CRON_SECRET;
  if (!cronSecret) throw new Error('CRON_SECRET is required for outbox cron');
  // W9.3: service binding roteia ao Worker via env.WORKER_SELF_REFERENCE.fetch com URL absoluta sintética
  const url = 'https://synkroo.internal' + OUTBOX_PATH;
  const response = await env.WORKER_SELF_REFERENCE.fetch(new Request(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cronSecret}` },
  }));
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
