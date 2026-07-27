# E2E Testing Design — Synkroo

**Date:** 2026-04-21
**Status:** Approved
**Scope:** Comprehensive E2E tests covering all pages, features, and API endpoints

---

## Overview

Full E2E test suite using Playwright, organized by feature modules with shared helpers. Tests run against the remote Supabase instance using real authentication with demo credentials.

## Architecture

### Approach: Feature Modules + Helpers

- Test files grouped by domain (`auth/`, `calendar/`, `patients/`, `api/`, etc.)
- Shared helpers for navigation, form interaction, calendar manipulation, API calls
- Auth fixture with Playwright `storageState` for session reuse across authenticated tests
- No Page Object classes — lightweight helper functions instead

### Auth Strategy

- **Credentials:** `admin@clinicademo.com` / `demo123`
- **Global setup** performs login once, saves session to `.auth/admin.json`
- Authenticated test files reference this stored state via `test.use({ storageState })`
- Auth-specific tests (`e2e/auth/`) perform manual login/logout to test those flows

### Test Data

- Global setup creates test records via API before suite runs
- Global teardown removes test records after suite completes
- Tests do not depend on production data state

---

## File Structure

```
e2e/
├── fixtures/
│   ├── auth.fixture.ts          # storageState setup, login/logout helpers
│   └── test-data.ts             # generators for names, emails, phones, etc.
│
├── helpers/
│   ├── navigation.ts            # sidebar clicks, page.goto wrappers
│   ├── calendar.ts              # view switching, date nav, event interaction
│   ├── forms.ts                 # fillForm, submitForm, assertValidation
│   └── api.ts                   # typed API calls for setup/teardown
│
├── auth/
│   ├── login.spec.ts            # 8 tests
│   ├── signup.spec.ts           # 5 tests
│   ├── logout.spec.ts           # 3 tests
│   └── route-protection.spec.ts # 4 tests
│
├── calendar/
│   ├── views.spec.ts            # 6 tests (Day/Week/Month/Professionals)
│   ├── date-navigation.spec.ts  # 5 tests
│   ├── drag-drop.spec.ts        # 4 tests
│   └── appointment-dialog.spec.ts # 6 tests
│
├── dashboard/
│   ├── overview.spec.ts         # 5 tests
│   └── sidebar-navigation.spec.ts # 3 tests
│
├── patients/
│   ├── list.spec.ts             # 4 tests
│   └── crud.spec.ts             # 5 tests
│
├── leads/
│   ├── list.spec.ts             # 3 tests
│   └── crud.spec.ts             # 5 tests
│
├── dentists/
│   ├── list.spec.ts             # 3 tests
│   └── crud.spec.ts             # 5 tests
│
├── procedures/
│   ├── list.spec.ts             # 3 tests
│   └── crud.spec.ts             # 5 tests
│
├── campaigns/
│   ├── list.spec.ts             # 3 tests
│   └── crud.spec.ts             # 4 tests
│
├── conversations/
│   └── list.spec.ts             # 2 tests
│
├── analytics/
│   └── charts.spec.ts           # 3 tests
│
├── api/
│   ├── health.spec.ts           # 2 tests
│   ├── appointments-api.spec.ts # 5 tests
│   ├── patients-api.spec.ts     # 5 tests
│   ├── leads-api.spec.ts        # 4 tests
│   ├── dentists-api.spec.ts     # 4 tests
│   ├── procedures-api.spec.ts   # 4 tests
│   ├── campaigns-api.spec.ts    # 4 tests
│   ├── conversations-api.spec.ts # 3 tests
│   ├── waitlist-api.spec.ts     # 3 tests
│   ├── budgets-api.spec.ts      # 3 tests
│   └── knowledge-api.spec.ts    # 3 tests
│
├── global-setup.ts
└── global-teardown.ts
```

**Total: ~60+ test files, ~130+ individual tests**

---

## Test Specifications

### Auth Tests

#### login.spec.ts
1. Page renders with email/password inputs and submit button
2. Successful login redirects to /dashboard
3. Wrong password shows error message
4. Empty email shows validation error
5. Empty password shows validation error
6. Loading state shows spinner during submission
7. "Criar conta" link navigates to /signup
8. Demo credentials hint is visible

#### signup.spec.ts
1. Page renders signup form
2. Successful signup creates account and redirects
3. Invalid email shows validation error
4. Weak password shows validation error
5. Duplicate email shows error

#### logout.spec.ts
1. Logout button exists in sidebar/header
2. Clicking logout clears session
3. After logout, accessing /dashboard redirects to /login

#### route-protection.spec.ts
1. Unauthenticated GET /dashboard redirects to /login
2. Unauthenticated GET /dashboard/pacientes redirects to /login with redirectTo
3. After login with redirectTo, redirects back to original page
4. /api/health is accessible without auth

### Calendar Tests

#### views.spec.ts
1. Day view renders with time grid and hour labels
2. Week view renders 7-day columns
3. Month view renders calendar grid
4. Professionals view renders dentist columns
5. Switching views preserves current date
6. Active view button is highlighted in toolbar

#### date-navigation.spec.ts
1. Clicking "prev" navigates to previous period
2. Clicking "next" navigates to next period
3. Clicking "today" navigates to current date
4. Date label updates correctly after navigation
5. Date picker allows selecting specific date

#### drag-drop.spec.ts
1. Can drag an existing appointment to a new time slot
2. Appointment time updates after drop
3. Drag preview appears during drag
4. Invalid drop zone does not move appointment

#### appointment-dialog.spec.ts
1. Clicking empty slot opens appointment dialog
2. Can create new appointment with valid data
3. Can edit existing appointment
4. Can delete appointment with confirmation
5. Canceling dialog does not create appointment
6. Required field validation in dialog

### Dashboard Tests

#### overview.spec.ts
1. Welcome card shows user name
2. Primary stats grid renders 3 cards
3. Secondary stats grid renders 3 cards
4. Quick actions render 4 link cards
5. Stats values update from API

#### sidebar-navigation.spec.ts
1. All sidebar links are visible and clickable
2. Clicking each link navigates to correct page
3. Active page is highlighted in sidebar

### CRUD Entity Tests (Patients, Leads, Dentists, Procedures)

For each entity, the pattern is:

#### list.spec.ts
1. Page renders data table with headers
2. Search input filters results
3. Empty state shows when no results
4. Table rows contain expected data

#### crud.spec.ts
1. "Create" button opens creation form/dialog
2. Submitting valid data creates record and shows in list
3. Editing existing record updates data
4. Deleting record removes from list (with confirmation)
5. Validation errors shown for required fields

### Campaign Tests

#### list.spec.ts
1. Campaign cards or table renders
2. Active/inactive status badges display
3. Search filters campaigns

#### crud.spec.ts
1. Creating new campaign works
2. Editing campaign works
3. Campaign status can be toggled
4. Validation prevents empty campaign name

### Conversations Tests

#### list.spec.ts
1. Conversation list renders
2. Clicking conversation shows detail/messages

### Analytics Tests

#### charts.spec.ts
1. Page renders chart components
2. Date range filter updates charts
3. Charts display data from API

### API Tests

For each API endpoint:

#### Pattern
1. GET returns 200 with array of records
2. POST with valid data returns 201 with created record
3. POST with invalid data returns 400 with error message
4. PUT updates record and returns 200
5. DELETE removes record and returns 204/200

#### Specific endpoints
- **health.spec.ts:** GET returns `{ status: "ok" }`
- **Each entity:** Follows CRUD pattern above
- **Auth-protected endpoints:** Return 401 without session cookie

---

## Playwright Configuration Changes

### playwright.config.ts updates
- Add `globalSetup` and `globalTeardown` paths
- Add project with `storageState` for authenticated tests
- Add `test:e2e` script to package.json

### package.json additions
```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed"
  }
}
```

---

## Implementation Order

1. **Infrastructure:** fixtures, helpers, global-setup/teardown, config updates
2. **Auth tests:** login, signup, logout, route-protection
3. **Dashboard tests:** overview, sidebar navigation
4. **Calendar tests:** views, navigation, dialog, drag-drop
5. **CRUD tests:** patients, leads, dentists, procedures
6. **Feature tests:** campaigns, conversations, analytics
7. **API tests:** all 12 endpoints

---

## Success Criteria

- All ~130+ tests pass consistently
- No flaky tests (retries ≤ 1)
- Tests run in under 5 minutes total
- Screenshots captured on failure for debugging
- CI-ready with `npm run test:e2e`
