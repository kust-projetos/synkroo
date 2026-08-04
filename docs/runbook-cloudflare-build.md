# Cloudflare build runbook

## Local prerequisites

- WSL2
- Node/npm matching `package-lock.json`
- staging-only Hyperdrive, KV, Vectorize and Durable Object bindings
- Wrangler authenticated without production deploy approval

## Reproducible build

```bash
wsl bash -lc 'rm -rf /tmp/synkroo-cf && mkdir /tmp/synkroo-cf && cd /mnt/d/projetos/synkroo && git archive HEAD | tar -x -C /tmp/synkroo-cf && cd /tmp/synkroo-cf && npm ci && npm run build:cf'
wsl bash -lc 'cd /tmp/synkroo-cf && npx wrangler deploy --dry-run --config wrangler.toml'
wsl bash -lc 'cd /tmp/synkroo-cf && npx wrangler check startup --worker .open-next/worker.js'
```

Record commit SHA, Node, npm, OpenNext, Wrangler, worker size, bindings and warnings in release evidence.

## Gate

- exit code zero for all commands;
- no new queue, binding or startup warning;
- no secret or PII in output;
- production deploy remains owner-approved and separate.
