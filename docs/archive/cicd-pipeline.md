# CI/CD Pipeline

**Versão:** 1.0.0
**Data:** 2026-03-27
**Responsável:** Winston (Arquiteto)

---

## Visão Geral

Pipeline de CI/CD usando GitHub Actions com deploys contínuos para staging e produção.

---

## Branch Strategy

```
main (production)
  │
  ├── develop (staging)
  │     │
  │     ├── feature/E-01-message-flow
  │     ├── feature/E-02-appointments
  │     └── bugfix/fix-reminder-timing
  │
  └── hotfix/critical-security-patch
```

### Branch Types

| Branch | Purpose | Merge To | Protection |
|--------|---------|----------|------------|
| `main` | Production | - | Required: 2 approvals, tests pass |
| `develop` | Staging | `main` | Required: tests pass |
| `feature/*` | Features | `develop` | None |
| `bugfix/*` | Bug fixes | `develop` | None |
| `hotfix/*` | Critical fixes | `main` + `develop` | Required: 1 approval |

---

## Pipeline Stages

### 1. Pull Request Checks

```yaml
# .github/workflows/pr.yml
name: PR Checks

on:
  pull_request:
    branches: [main, develop]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Type check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Unit tests
        run: npm run test:unit -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3

  integration:
    runs-on: ubuntu-latest
    needs: quality

    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: synkroo_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      - name: Run integration tests
        run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/synkroo_test

  e2e:
    runs-on: ubuntu-latest
    needs: quality

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Run E2E tests
        run: npm run test:e2e

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  security:
    runs-on: ubuntu-latest
    needs: quality

    steps:
      - uses: actions/checkout@v4

      - name: Run security audit
        run: npm audit --audit-level=high

      - name: Run Snyk
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### 2. Build & Deploy

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, develop]
  workflow_dispatch:

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      - name: Build
        run: npm run build

      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: .next/

  deploy-staging:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/develop'

    environment:
      name: staging
      url: https://staging.synkroo.com

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel (Staging)
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          scope: ${{ secrets.VERCEL_TEAM_ID }}
          alias-domains: staging.synkroo.com

      - name: Run smoke tests
        run: npm run test:smoke
        env:
          BASE_URL: https://staging.synkroo.com

      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Staging deploy completed'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}

  deploy-production:
    runs-on: ubuntu-latest
    needs: build
    if: github.ref == 'refs/heads/main'

    environment:
      name: production
      url: https://synkroo.com

    steps:
      - uses: actions/checkout@v4

      - name: Deploy to Vercel (Production)
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          scope: ${{ secrets.VERCEL_TEAM_ID }}

      - name: Create Sentry release
        uses: getsentry/action-release@v1
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: synkroo
          SENTRY_PROJECT: synkroo-app
        with:
          environment: production
          version: ${{ github.sha }}

      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deploy completed'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

### 3. Database Migrations

```yaml
# .github/workflows/migrate.yml
name: Database Migration

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

jobs:
  migrate:
    runs-on: ubuntu-latest

    environment:
      name: ${{ github.event.inputs.environment }}

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

      - name: Verify migration
        run: npx prisma migrate status

      - name: Notify Slack
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Migration completed for ${{ github.event.inputs.environment }}'
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Environments

### Staging

```yaml
Environment: staging
URL: https://staging.synkroo.com

Supabase Project: synkroo-staging
Database: staging-db
Redis: staging-redis

Variables:
  - NEXT_PUBLIC_API_URL=https://staging-api.synkroo.com
  - NEXT_PUBLIC_SUPABASE_URL=${{ secrets.STAGING_SUPABASE_URL }}
  - DATABASE_URL=${{ secrets.STAGING_DATABASE_URL }}
```

### Production

```yaml
Environment: production
URL: https://synkroo.com

Supabase Project: synkroo-production
Database: prod-db
Redis: prod-redis

Variables:
  - NEXT_PUBLIC_API_URL=https://api.synkroo.com
  - NEXT_PUBLIC_SUPABASE_URL=${{ secrets.PROD_SUPABASE_URL }}
  - DATABASE_URL=${{ secrets.PROD_DATABASE_URL }}

Protection Rules:
  - Required reviewers: 1
  - Wait timer: 5 minutes
```

---

## Secrets Management

| Secret | Scope | Usage |
|--------|-------|-------|
| `VERCEL_TOKEN` | Organization | Vercel deployments |
| `VERCEL_ORG_ID` | Repository | Vercel project config |
| `VERCEL_PROJECT_ID` | Repository | Vercel project config |
| `DATABASE_URL` | Environment | Database connection |
| `SUPABASE_SERVICE_KEY` | Environment | Supabase admin access |
| `ANTHROPIC_API_KEY` | Environment | Claude API |
| `SENTRY_AUTH_TOKEN` | Repository | Sentry releases |
| `SLACK_WEBHOOK` | Repository | Notifications |

---

## Rollback Strategy

### Automatic Rollback

```yaml
# Part of deploy-production job
- name: Health check
  run: |
    response=$(curl -s -o /dev/null -w "%{http_code}" https://synkroo.com/health)
    if [ $response -ne 200 ]; then
      echo "Health check failed, rolling back..."
      vercel rollback --token ${{ secrets.VERCEL_TOKEN }}
      exit 1
    fi
```

### Manual Rollback

```bash
# Via Vercel CLI
vercel rollback --token $VERCEL_TOKEN

# Or via GitHub Actions
# Trigger workflow with "rollback" input
```

---

## Deployment Checklist

### Pre-Deploy

- [ ] All PR checks passed
- [ ] Code reviewed and approved
- [ ] Changelog updated
- [ ] Database migration tested in staging
- [ ] Breaking changes documented

### Post-Deploy

- [ ] Health check passing
- [ ] Smoke tests passing
- [ ] Sentry errors monitored
- [ ] Performance metrics normal
- [ ] Slack notification sent

---

## Monitoring & Alerts

### Deployment Monitoring

- **Vercel Analytics:** Deploy duration, function execution
- **Sentry:** Error rate, performance
- **Grafana:** Response time, throughput

### Alert Channels

- **Slack:** `#synkroo-deploys`
- **PagerDuty:** Production failures

---

## Referências

- [GitHub Actions Best Practices](https://docs.github.com/en/actions/guides)
- [Vercel CI/CD](https://vercel.com/docs/concepts/deployments/overview)
- [Prisma Migrations in CI/CD](https://www.prisma.io/docs/guides/database/production-troubleshooting)