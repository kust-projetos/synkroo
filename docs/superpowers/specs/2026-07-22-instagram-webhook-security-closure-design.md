# Instagram Webhook Security Closure Design

**Goal:** Close Eixo 2 Security Task 5 without weakening the fail-closed Instagram webhook contract.

## Scope

Only `POST /api/instagram/webhook` and its tests change. Follow-up and IA are excluded.

## Contract

1. The handler reads the request exactly once as raw bytes: `Buffer.from(await request.arrayBuffer())`.
2. It returns `500` when `INSTAGRAM_APP_SECRET` is absent, before rate limiting.
3. It returns `403` unless `x-hub-signature-256` exactly matches `/^sha256=[0-9a-fA-F]{64}$/`.
4. It calculates SHA-256 HMAC over the raw buffer, compares equal-length bytes with `timingSafeEqual`, and returns `403` on mismatch.
5. It decodes UTF-8 and calls `JSON.parse` only after HMAC verification succeeds.
6. A valid signed Instagram payload retains the current `200` behavior.

## Tests

- The legacy route test sends a configured secret and valid HMAC; it no longer depends on the insecure unsigned behavior.
- Contract tests reject non-hex, truncated, leading/trailing whitespace signatures, and a valid HMAC for bytes different from the submitted JSON.
- A binary payload signed over raw bytes reaches HMAC verification rather than being altered by text decoding.
- Existing missing-secret, missing-signature, invalid-signature, verification handshake and valid-signature behavior remain covered.

## Non-goals

- No webhook routing redesign.
- No change to module gate, rate-limit policy, AI response wiring, Follow-up, Agents SDK, Cloudflare bindings, or database behavior.

## Verification

1. Run both Instagram test files with `npx jest --runTestsByPath ... --runInBand`.
2. Run focused Atendimento tests and `npm run typecheck`.
3. Do not claim full integration/build verification while PostgreSQL is unavailable.
