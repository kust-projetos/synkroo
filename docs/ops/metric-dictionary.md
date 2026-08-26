# Metric Dictionary — F10.02 (W10)

> Fórmula, fonte, janela, timezone, freshness e clínica para cada métrica do dashboard.

| Métrica | Fórmula / Query | Fonte (tabela/view) | Janela | Timezone | Freshness | Tenant |
|---------|-----------------|---------------------|--------|----------|-----------|--------|
| `appointments.count` | `count(*) WHERE clinicId=:clinicId AND scheduledAt BETWEEN :start AND :end` | `appointments` | 30d rolling (ou `period` param) | `clinics.timezone` → `America/Sao_Paulo` default (`lib/timezone.ts:resolveClinicTimezone`) | 5 min (cache TanStack Query) | `clinicId` required |
| `appointments.no_show_rate` | `count(status='no_show') / count(status in ('completed','no_show'))` | `appointments` | 30d | clínica | 5 min | `clinicId` |
| `patients.total` | `count(*) WHERE clinicId` | `patients` | snapshot | — | 5 min | `clinicId` |
| `patients.inactive_30/60/90/180` | `patients.lastVisitAt < now-30/60/90/180d OR NULL` (cumulative) | `patients` via `inactive-patient.service:getInactivityStats` | cutoff diário | clínica | daily cron `runInactivityDetection` | `clinicId` |
| `campaigns.sent_rate` | `sentCount / totalRecipients` | `campaigns` | por campanha | clínica | realtime (outbox) | `clinicId` |
| `finance.charges.pending` | `count(payment_charges.status='pending')` | `payment_charges` | snapshot | clínica | realtime | `clinicId` via `getBudget` tenant check |
| `finance.revenue_at_risk` | `inactive_30 * 2 * 250` | derivado `getInactivityStats.atRiskRevenue` | snapshot | clínica | daily | `clinicId` |
| `leads.conversion_rate` | `count(lead→patient) / count(leads)` | `leads`, `patients` | 30d | clínica | 5 min | `clinicId` |

**Heurística vs dado (F10.03):**
- `noshow_prediction` e `ROI` são **heurística** (label `Heurística` no UI), não dado — fórmula `noshow = 0.12 + 0.05*inactivity_90` documentada aqui, não apresentada como fato.
- `atRiskRevenue` é estimativa (`avgVisitValue=250`), não financeiro fechado.

**Redaction (F10.09):** nenhuma métrica expõe PII top-level/aninhada; `audit payload` allowlist; `logger` redact `password/secret/token`.

*Fonte: `src/services/reports/*`, `src/lib/timezone.ts`, `src/services/followup/inactive-patient.service.ts`, `docs/superpowers/audits/roadmap-143-ledger.json` F10.02/05/06/08.*
