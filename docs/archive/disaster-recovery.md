# Disaster Recovery Plan

**Versão:** 1.0.0
**Data:** 2026-03-27
**Responsável:** Winston (Arquiteto)

---

## Visão Geral

Plano de recuperação de desastres para garantir continuidade do negócio e integridade dos dados do Synkroo.

---

## Objetivos

| Métrica | Target | Descrição |
|---------|--------|-----------|
| **RPO** (Recovery Point Objective) | 1 hora | Perda máxima de dados aceitável |
| **RTO** (Recovery Time Objective) | 4 horas | Tempo máximo para restaurar serviço |

---

## Classificação de Desastres

### Severidade

| Nível | Definição | Exemplo | RTO |
|-------|-----------|---------|-----|
| **P1 - Critical** | Serviço completamente indisponível | Database down, all regions offline | < 4h |
| **P2 - High** | Funcionalidade crítica indisponível | WhatsApp integration down, AI offline | < 8h |
| **P3 - Medium** | Degradation with workaround | Slow responses, partial features | < 24h |
| **P4 - Low** | Minor issues | Single feature broken, cosmetic | < 72h |

### Categorias

| Categoria | Causa | Impacto | Frequência |
|-----------|-------|---------|------------|
| **Infrastructure** | Cloud provider outage, hardware failure | High | Low |
| **Application** | Bug, deployment failure, config error | Medium | Medium |
| **Data** | Database corruption, data loss | Critical | Very Low |
| **Security** | Breach, ransomware, DDoS | Critical | Low |
| **External** | WhatsApp API down, Claude API outage | Medium | Medium |

---

## Backup Strategy

### Database Backups

| Tipo | Frequência | Retenção | Storage |
|------|------------|----------|---------|
| Full | Diário | 30 dias | S3 + Cross-region |
| Incremental | A cada 1h | 7 dias | S3 |
| WAL Archive | Contínuo | 7 dias | S3 |

### Backup Commands

```bash
# Manual backup (Supabase)
supabase db dump -f backup-$(date +%Y%m%d-%H%M%S).sql

# Automated via pg_dump
pg_dump -Fc -Z9 -f backup.dump $DATABASE_URL
```

### Backup Verification

```bash
# Weekly restore test (staging)
pg_restore -d test_restore backup.dump

# Verify data integrity
psql test_restore -c "SELECT COUNT(*) FROM patients;"
psql test_restore -c "SELECT COUNT(*) FROM appointments;"
```

### File Storage Backups

- **Provider:** Supabase Storage
- **Replication:** Cross-region (US-East + EU-West)
- **Retention:** 90 dias

---

## Recovery Procedures

### P1: Database Failure

**Sintomas:**
- Connection errors
- Query timeouts
- Data corruption

**Procedimento:**

```
1. [0-15 min] Assess situation
   - Check Supabase status page
   - Review logs for error patterns
   - Determine if regional or global

2. [15-30 min] Attempt automatic recovery
   - Supabase auto-failover (if enabled)
   - Restart from dashboard

3. [30-60 min] Manual intervention
   - Contact Supabase support
   - Prepare for point-in-time recovery

4. [1-2h] Point-in-time recovery
   - Restore from latest backup
   - Apply WAL logs up to failure point

5. [2-4h] Validation & restart
   - Run data integrity checks
   - Verify RLS policies
   - Restart application
   - Monitor for anomalies
```

**Comandos:**

```bash
# Point-in-time recovery
supabase db restore --timestamp "2026-03-27 10:30:00"

# Or via pg_restore
pg_restore -d synkroo_prod backup.dump

# Verify restoration
psql $DATABASE_URL -c "SELECT NOW(), COUNT(*) FROM appointments WHERE created_at > NOW() - INTERVAL '1 day';"
```

### P2: Application Deployment Failure

**Sintomas:**
- 500 errors after deploy
- Feature regression
- Performance degradation

**Procedimento:**

```
1. [0-5 min] Identify issue
   - Review deployment logs
   - Check Sentry for new errors
   - Identify faulty commit

2. [5-15 min] Immediate rollback
   - Trigger Vercel rollback
   - Verify previous version works

3. [15-60 min] Post-mortem
   - Analyze root cause
   - Create fix branch
   - Test thoroughly in staging

4. [1-2h] Redeploy
   - Deploy fix
   - Monitor closely
   - Update changelog
```

**Comandos:**

```bash
# Vercel rollback
vercel rollback --token $VERCEL_TOKEN

# Or specific deployment
vercel rollback [deployment-url] --token $VERCEL_TOKEN

# Verify
curl -s https://synkroo.com/health | jq .
```

### P3: External Service Outage

**Sintomas:**
- WhatsApp API errors
- Claude API timeouts
- Payment gateway failures

**Procedimento:**

```
1. [0-10 min] Identify service
   - Check status pages:
     * https://status.whatsapp.com
     * https://status.anthropic.com
   - Review error logs

2. [10-30 min] Implement fallback
   - WhatsApp: Queue messages for retry
   - Claude: Return cached responses (if available)
   - Payments: Manual processing mode

3. [30-60 min] Communication
   - Update status page
   - Notify affected clinics
   - Provide ETA if known

4. [Ongoing] Monitor & recover
   - Watch for service restoration
   - Process queued items
   - Verify normal operation
```

### P4: Security Incident

**Sintomas:**
- Unauthorized access detected
- Data breach suspicion
- Ransomware/malware

**Procedimento:**

```
1. [0-15 min] Containment
   - Isolate affected systems
   - Revoke compromised credentials
   - Block suspicious IPs

2. [15-60 min] Assessment
   - Determine scope of breach
   - Identify affected data
   - Preserve evidence

3. [1-4h] Notification
   - Notify security team
   - Inform affected clinics
   - Report to authorities (LGPD)

4. [4-24h] Recovery
   - Clean affected systems
   - Restore from known-good backup
   - Implement additional security measures

5. [Ongoing] Post-incident
   - Full security audit
   - Update procedures
   - Incident report
```

---

## Communication Plan

### Internal Notification

| Severidade | Canais | Responsáveis |
|------------|--------|--------------|
| P1 | PagerDuty + Slack + Phone | On-call + Lead + Manager |
| P2 | PagerDuty + Slack | On-call + Lead |
| P3 | Slack | On-call |
| P4 | Slack | On-call (next business day) |

### External Communication

#### Status Page

```
https://status.synkroo.com

Updates:
- Initial: "We're investigating an issue with [service]"
- Progress: "We've identified the cause and are implementing a fix"
- Resolution: "The issue has been resolved. [summary]"
```

#### Customer Notification Template

```
Subject: [Synkroo] Service Issue - [Date/Time]

Prezados,

Identificamos um problema que pode estar afetando [funcionalidade].

**Status atual:** [Investigando/Em correção/Resolvido]
**Impacto:** [Descrição do impacto]
**ETA:** [Tempo estimado, se conhecido]

Acompanhe atualizações em: https://status.synkroo.com

Pedimos desculpas pelo inconveniente.

Equipe Synkroo
```

---

## Testing & Drills

### Quarterly DR Drills

| Cenário | Frequência | Participantes |
|---------|------------|---------------|
| Database restore | Trimestral | DevOps + Backend |
| Application rollback | Mensal | DevOps + Frontend |
| External service failover | Trimestral | Full team |
| Security incident | Semestral | Security + DevOps |

### Drill Checklist

- [ ] Scenario documented
- [ ] Team notified
- [ ] Procedure executed
- [ ] Timing recorded
- [ ] Lessons learned documented
- [ ] Procedures updated

---

## Tools & Resources

### Monitoring

| Tool | Purpose | URL |
|------|---------|-----|
| Supabase Dashboard | Database metrics | dashboard.supabase.com |
| Vercel Dashboard | Deployment status | vercel.com/dashboard |
| Sentry | Error tracking | sentry.io |
| Grafana | Metrics | grafana.synkroo.internal |
| Status Page | Public status | status.synkroo.com |

### Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-call Engineer | PagerDuty | Immediate |
| Tech Lead | Direct | 15 min |
| CTO | Direct | 30 min |
| Supabase Support | support@supabase.io | Via ticket |
| Vercel Support | support@vercel.com | Via ticket |

---

## Post-Incident Review

### Template

```markdown
# Incident Report - [Date]

## Summary
- **Duration:** [Start] - [End] ([Total time])
- **Severity:** [P1-P4]
- **Impact:** [Users/services affected]

## Timeline
- [Time] - Issue detected
- [Time] - Team notified
- [Time] - Root cause identified
- [Time] - Fix implemented
- [Time] - Service restored

## Root Cause
[Detailed explanation]

## Resolution
[What was done to fix it]

## Action Items
- [ ] [Action 1] - Owner: [Name] - Due: [Date]
- [ ] [Action 2] - Owner: [Name] - Due: [Date]

## Lessons Learned
- What went well
- What could be improved
- What to change

## Appendix
- Logs
- Screenshots
- Communication records
```

---

## Referências

- [AWS Disaster Recovery](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options.html)
- [Google SRE - Managing Incidents](https://sre.google/sre-book/managing-incidents/)
- [PostgreSQL Backup and Recovery](https://www.postgresql.org/docs/current/backup.html)