// Synkroo — OpenNext Cloudflare config
// ISR revalidation uses the official Durable Object queue adapter.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import doQueue from "@opennextjs/cloudflare/overrides/queue/do-queue";

export default defineCloudflareConfig({
  incrementalCache: "dummy",   // TODO(W4.4): substituir por KV provider real
  queue: doQueue,
});
