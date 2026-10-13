export const OUTBOX_PATH = '/api/cron/outbox?limit=25';

export const CRON_JOBS = [
  { name: 'reminders', path: '/api/cron/reminders', everyMinutes: 5 },
  { name: 'cleanup', path: '/api/cron/cleanup', everyMinutes: 60 },
  { name: 'hot-leads', path: '/api/cron/hot-leads', everyMinutes: 60 },
  { name: 'followups', path: '/api/cron/followups', dailyAtMinute: 9 * 60 },
  { name: 'financeiro-collections', path: '/api/cron/financeiro-collections', dailyAtMinute: 3 * 60 },
  { name: 'crm-duplicates', path: '/api/cron/crm-duplicates', dailyAtMinute: 4 * 60 },
];

export function parseEnabledJobs(cronEnabledCsv) {
  return new Set(
    String(cronEnabledCsv ?? '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean),
  );
}

export function selectDueJobs(cronEnabledCsv, utcDate) {
  const enabled = parseEnabledJobs(cronEnabledCsv);
  if (enabled.size === 0) return [];
  const minuteOfDay = utcDate.getUTCHours() * 60 + utcDate.getUTCMinutes();
  return CRON_JOBS.filter((job) => {
    if (!enabled.has(job.name)) return false;
    if (job.everyMinutes !== undefined) return minuteOfDay % job.everyMinutes === 0;
    return minuteOfDay === job.dailyAtMinute;
  });
}

export async function postCronJob(fetchImpl, cronSecret, path) {
  if (!cronSecret) throw new Error('CRON_SECRET is required for cron job');
  const response = await fetchImpl(
    new Request('https://synkroo.internal' + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cronSecret}` },
    }),
  );
  if (!response.ok) throw new Error(`CRON_FAILED:${path}:${response.status}`);
}

export async function runDueJobs(fetchImpl, cronSecret, jobs) {
  const settled = await Promise.allSettled(
    jobs.map((job) => postCronJob(fetchImpl, cronSecret, job.path)),
  );
  settled.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`CRON_JOB_FAILED:${jobs[index].name}`, result.reason);
    }
  });
  return settled;
}

export async function dispatchScheduledJobs(env, clock, fetcher) {
  const cronSecret = env?.CRON_SECRET;
  if (!cronSecret) return [];
  const fetchImpl = fetcher ?? ((request) => env.WORKER_SELF_REFERENCE.fetch(request));
  const now = clock instanceof Date ? clock : new Date(clock ?? Date.now());
  const due = selectDueJobs(env?.CRON_JOBS_ENABLED, now);
  return runDueJobs(fetchImpl, cronSecret, [
    { name: 'outbox', path: OUTBOX_PATH },
    ...due,
  ]);
}
