# WAHA target candidate scaffold (loopback-only; not deployed)

This compose file prepares a **local staging candidate** only. It does not
create a WAHA container, public route, DNS record, Cloudflare rule, secret,
backup, or provider selection. The Contabo target was checked read-only on
2026-10-06 and currently has no WAHA container or session volume.

## Image and engine

- Hostinger source was inspected read-only on 2026-10-06. Its running image was
  `devlikeapro/waha:latest`, with RepoDigest
  `devlikeapro/waha@sha256:41283bd89922ec3f722e5a772b844c451634d4aa72e9c34043c3480184f970fe`.
- That digest is a **candidate only**, shown as a comment in `.env.example`.
  Verify the upstream repository, version/edition and target platform before
  placing an immutable digest in the private `.env`; do not copy `:latest`.
- NOWEB appears in the VPS project documentation, but the live engine variable
  was not read. `WAHA_ENGINE` has no default; select WEBJS/GOWS/NOWEB only after
  the P3.5 compatibility matrix.

## Access boundary

This candidate binds port 3000 only to `127.0.0.1` on the VPS. There is no
Traefik router, external Docker network, public DNS or Cloudflare access rule.
The app Worker cannot reach it yet. Dashboard is disabled; Swagger is
credential-protected and loopback-only. Operator access for staging is through
an approved SSH tunnel. Do not change the bind to `0.0.0.0` or add public
ingress as a shortcut.

The future Worker-to-WAHA connectivity pattern is still a security decision.
Before P3.7 activation, choose and review a private/edge-authenticated path,
then configure the app-side `WAHA_API_URL` and raw `WAHA_API_KEY` in server-side
secrets. The WAHA service receives only `WAHA_API_KEY_HASH` in recommended
`sha512:<128 hex>` form. Never put either raw key in Git.

The target `.env` must be a private mode-0600 file. Generate a fresh
`WAHA_WEBHOOK_HMAC_KEY` (minimum 32 chars) for the target; do not copy the
Hostinger secret. The same HMAC value belongs in the target WAHA config and the
app's server-side `WAHA_WEBHOOK_HMAC_KEY`. Keep `WAHA_WEBHOOK_URL` blank until an
enabled `channel_installations` row maps the WAHA session to a clinic; otherwise
valid inbound messages are deliberately acknowledged as ignored.

## Read-only preflight

Copy `.env.example` to the private target `.env`, fill approved values, then run
the read-only Node validator. It prints key names/reasons only, never values:

```bash
node ops/vps/waha/preflight.mjs /path/to/private/waha/.env
env -u WAHA_IMAGE_DIGEST -u WAHA_ENGINE -u WAHA_API_KEY_HASH \
  -u WAHA_SWAGGER_USERNAME -u WAHA_SWAGGER_PASSWORD \
  -u WAHA_WEBHOOK_HMAC_KEY -u WAHA_WEBHOOK_URL \
  docker compose --env-file /path/to/private/waha/.env \
  -f ops/vps/waha/docker-compose.yml config --quiet
```

The env file accepts only simple unquoted `KEY=value` lines from the listed
allowlist. Do not use inline comments, quotes or `$` interpolation. The validator
rejects inherited WAHA variables so the checked file remains the source of truth;
the `env -u` options also prevent shell variables from overriding Compose values.

These commands are read-only validation; they do not pull images, create
volumes or start containers. No `docker compose up` was run for this scaffold.

## Persistence and remaining GO gates

`synkroo_waha_sessions_candidate` persists `/app/.sessions`, which contains
reusable WhatsApp credentials/state. The target `backup-synkroo.sh` does not
cover this volume and currently covers PostgreSQL/config only; this scaffold deliberately does not add the
session volume to a plaintext/off-host backup. P3.4 must define confidentiality,
encryption, retention, restore and re-pair behavior before a real session is
used. Do not copy an Evolution or Hostinger session into this volume.

The local in-memory limiter is not the app-edge gate: a Cloudflare Rate Limiting
Rule for the exact `POST /api/whatsapp/waha` path, verified
`CF-Connecting-IP`, and a non-bypassable Worker origin remain required before
canary/cutover. Any later Traefik limit for the WAHA backend API is a separate
boundary. Engine matrix, live webhook/QR, media, session restore and canary are
still unverified.

## Provenance decision (2026-10-07, P3 tranche 3)

- Source live engine confirmed read-only: `NOWEB`.
- Source digest `41283bd8…` could NOT be attributed to any upstream amd64
  manifest (`noweb`/`gows`/`chrome`/`latest` 2026.9.1, `noweb`/`gows` 2026.9.2,
  current `latest`); the source pulls floating `:latest` (empty RepoDigests).
  It stays a non-approved candidate: do not reuse it.
- Approved target pin: upstream tag `noweb-2026.9.2` (amd64 manifest
  `sha256:0999fb38…`, pushed 2026-10-02), engine `NOWEB`. At deploy time the
  pulled RepoDigest must equal the pinned value or the deploy aborts.
