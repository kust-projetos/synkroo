import openNextWorker from './.open-next/worker.js';
import { dispatchScheduledJobs } from './scripts/lib/cron-schedule.mjs';
export { DOQueueHandler } from './.open-next/.build/durable-objects/queue.js';

const worker = {
  fetch(request, env, ctx) {
    return openNextWorker.fetch(request, env, ctx);
  },
  scheduled(controller, env, ctx) {
    ctx.waitUntil(
      dispatchScheduledJobs(env, new Date(controller?.scheduledTime ?? Date.now())),
    );
  },
};

export default worker;
