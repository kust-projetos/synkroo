# O1-G01 — Local incident controls and owner gate O1-X01

Date: 2026-08-20
Roadmap IDs: F0.01–F0.10
Status: local controls VERIFIED; owner actions F0.04–F0.07/F0.10 remain `EVIDENCE_PENDING`

## Local decision record — F0.01

No automatic freeze is applied to release, merge, push or new clones. Safe local work and authorized staging preparation may continue. Production, credential rotation, history rewrite, clone invalidation, provider calls and irreversible actions remain blocked by R4/R5 gates. This replaces an implicit freeze decision with an explicit keep-safe-work-open decision; it does not authorize external action.

## RED/GREEN policy proof

- `node --test scripts/__tests__/gitleaks-policy.test.mjs` — PASS, 5/5 tests, 0 skips.
- Assertions cover both CI workflows' full-history checkout, `--all`, `--redact` and blocking behavior; 83 fingerprint entries without broad wildcard allowlists; six `confirmed-owner-action` inventory classification; and named TOML artifact paths.
- The policy test uses `fileURLToPath` for Windows-safe repository resolution.

## Local controls

- `.gitleaksignore` retains 83 fingerprint-like entries and does not receive broad path suppressions.
- `.gitleaks.toml` extends default rules and limits path allowlisting to named local/build artifacts; stopwords remain explicit development placeholders only.
- `.github/workflows/ci.yml` runs the blocking full-history tree scan with `fetch-depth: 0`, `--log-opts="--all"` and `--redact`.
- `.github/workflows/gitleaks-scheduled.yml` repeats the full-history redacted scan on schedule.
- `docs/security/credential-inventory.md` remains sanitized: fingerprints/classes/owners only, no secret values.

## O1-X01 — owner gate packet

| Field | Receipt |
|---|---|
| Class | R4 human gate |
| IDs/goals | F0.04–F0.07/F0.10; O1-G01 |
| Preparation | Inventory, fingerprint classification, blocking/scheduled scan policy, staged redaction test, rollback and communication checklist are ready. |
| Minimal owner action | Rotate/revoke affected GitHub, Cloudflare, DB, LLM, Evolution, Asaas and Auth credentials; audit forks/logs/artifacts/caches; coordinate history/clone sanitation; restore access only with new credentials. |
| Preconditions | Named owners, approved maintenance window, backups, provider access and out-of-band delivery of replacement credentials. |
| Risk | Existing credentials/build artifacts may remain usable until provider-side revocation and clone/cache invalidation complete. |
| Rollback | Provider-specific recovery using the new credential and owner-approved restore; never restore an exposed value into source, logs or artifacts. |
| Expected sanitized receipt | Secret class/fingerprint, owner/provider, before/after timestamps, revocation/rotation result, history/cache/clone audit result and access recovery status; no values. |
| Resume | Attach receipt to F0.04–F0.07/F0.10, rerun redacted scans and update the ledger; do not mark external items from local policy tests alone. |
| Independent READY work | O1-G02 local git baseline, O1-G03 tenant actions after dependency, and other non-secret local goals. |

## Scan receipt

- Staged scan: `gitleaks protect --staged --redact` — PASS, no leaks found; no values were printed or recorded.
- Full-history scan: `gitleaks detect --source . --log-opts="--all" --redact --verbose` — exit 2 after a bounded scan attempt; the process ended with fatal runtime `cannot allocate memory`. Output was redacted and no secret value was recorded.
- R2 fallback: keep CI/scheduled full-history scans blocking, use a memory-bounded history partition or approved runner for the next attempt, and do not call the O1-X01 history track green from this local OOM.
- No rotation, provider login, production command, history rewrite or clone invalidation was performed by the agent.

## Residual classification

- F0.01: explicit local decision recorded; reconcile roadmap status only with item-level ledger evidence.
- F0.02/F0.08/F0.09: local policy/inventory work is prepared; remaining scan/suppression review stays attached to the O1 gate.
- F0.04–F0.07/F0.10: `EVIDENCE_PENDING` until O1-X01 owner receipt.
