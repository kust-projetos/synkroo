// Synkroo — OpenNext Cloudflare config
// Consolidação do spike W4.1: incrementalCache dummy + queue direct (MVP)
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  incrementalCache: "dummy",   // TODO(W4.4): substituir por KV provider real
  queue: "direct",             // TODO(W4.4): substituir por Cloudflare Queues
});
