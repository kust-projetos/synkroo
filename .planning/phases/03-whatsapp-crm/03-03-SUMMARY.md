---
phase: 3
plan: 03
subsystem: campaigns
tags: [campaigns, wizard, audience-segmentation, metrics]
dependency_graph:
  requires: [03-01]
  provides: [WHATS-05, WHATS-07]
  affects: [src/app/dashboard/campanhas/, src/components/campaigns/]
tech_stack:
  added: [CampaignWizard, AudiencePreview, CampaignMetricsCard]
  patterns: [multi-step dialog, smart filters, async processing]
key_files:
  created:
    - src/components/campaigns/campaign-wizard.tsx
    - src/components/campaigns/audience-preview.tsx
    - src/components/campaigns/campaign-metrics-card.tsx
    - src/app/api/campaigns/segments/preview/route.ts
    - src/app/api/campaigns/process/route.ts
  modified:
    - src/app/dashboard/campanhas/page.tsx
decisions:
  - Used Dialog-based multi-step wizard over page navigation for smoother UX
  - Campaign types: reactivation, follow_up, birthday, promotional
  - Smart filter mapping per D-10 specifications
  - CRON_SECRET auth for async campaign processing endpoint
metrics:
  duration_minutes: ~
  completed_date: 2026-04-25
---

# Phase 3 Plan 03: Campaign Wizard with Smart Filters Summary

## One-liner

Campaign wizard with 5-step flow (type selection, audience preview, template, schedule, confirm) with smart filter audience segmentation and async campaign processing.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | CampaignWizard multi-step component | 3f92806 | campaign-wizard.tsx |
| 2 | AudiencePreview component | 3f92806 | audience-preview.tsx |
| 3 | CampaignMetricsCard component | 3f92806 | campaign-metrics-card.tsx |
| 4 | Audience preview API endpoint | 3f92806 | segments/preview/route.ts |
| 5 | campanhas page wizard integration | b13e25d | campanhas/page.tsx |
| 6 | Async campaign processing endpoint | 3f92806 | process/route.ts |

## Key Components

### CampaignWizard
- 5-step Dialog: Type Selection -> Audience Preview -> Template -> Schedule -> Confirm
- Props: `open`, `onOpenChange`, `onComplete`
- Campaign types: reactivation (30+ days inactive), follow_up (recent procedure), birthday (this week), promotional
- Step indicator with navigation (Back/Next)

### AudiencePreview
- Fetches preview via GET `/api/campaigns/segments/preview?type={type}`
- Displays patient count matching smart filter
- Loading skeleton and empty state handling

### CampaignMetricsCard
- Shows sent/delivered/read/failed counts
- Progress bars for delivery rate and response rate
- Color coding per spec (primary for delivered, green for read, red for failed)

### API Routes
- `GET /api/campaigns/segments/preview`: Returns count + 10 sample patients per campaign type
- `POST /api/campaigns/process`: Cron endpoint (CRON_SECRET auth) for processing scheduled campaigns

## Deviations from Plan

None - plan executed exactly as written.

## Threat Flags

None identified.

## Verification

- `grep -l "CampaignWizard" src/components/campaigns/campaign-wizard.tsx` - Component created
- `grep -l "AudiencePreview" src/components/campaigns/audience-preview.tsx` - Component created
- `grep -l "CampaignMetricsCard" src/components/campaigns/campaign-metrics-card.tsx` - Component created
- `grep -l "segments/preview" src/app/api/campaigns/segments/preview/route.ts` - Route created
- `grep -l "campaigns/process" src/app/api/campaigns/process/route.ts` - Route created
- `grep -n "CampaignWizard\|Criar Campanha" src/app/dashboard/campanhas/page.tsx` - Integration verified
