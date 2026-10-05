# ADR-BASE-08: WhatsApp Provider — Evolution baseline → WAHA vNext

**Status:** 🔄 Superseded para direção futura; Evolution continua operacional até cutover validado  
**Decisão original:** 2026-07-28  
**Mudança de direção:** 2026-10-05  
**Spec vNext:** `docs/superpowers/specs/2026-10-05-synkroo-vnext-ai-native-business-os-design.md`

## Contexto

A baseline v1 implementou Evolution API como provider principal de WhatsApp, com sidecar Playwright como fallback. A implementação existente é funcional e não deve ser removida antes da migração.

No vNext, o owner decidiu substituir Evolution API por **WAHA**, self-hosted na VPS Contabo.

## Nova decisão

1. WAHA será o provider principal após canary e cutover aprovados.
2. O domínio não dependerá diretamente de WAHA.
3. `channel-service` usará um `WhatsAppProviderAdapter` neutro.
4. Evolution permanece como adapter temporário durante a transição.
5. A idempotência outbound continua pertencendo à facade Synkroo.
6. Inbound WAHA será autenticado, normalizado e deduplicado antes de entrar na Action Layer.
7. O engine WAHA será escolhido por contract/compatibility tests; a regra de negócio não conhece WEBJS/GOWS/NOWEB.
8. O sidecar Playwright será reavaliado após WAHA estabilizar; não será mantido por inércia.

## Estado atual

- `src/modules/atendimento/services/evolution-service.ts`: implementação atual.
- `src/app/api/whatsapp/evolution/route.ts`: inbound atual.
- `src/modules/atendimento/services/channel-service.ts`: facade atual com acoplamento direto à Evolution.
- Env atual: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`.

## Estado alvo

- `WhatsAppProviderAdapter`;
- `EvolutionAdapter` temporário;
- `WahaAdapter` principal;
- `POST /api/whatsapp/waha`;
- `WHATSAPP_PROVIDER=waha|evolution` durante migração;
- secrets WAHA fora do repo;
- HMAC nos webhooks;
- session/installation → clinic mapping confiável.

## Migração

Seguir:
`docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md`.

A remoção do código Evolution é um tranche posterior ao cutover, nunca parte do primeiro deploy WAHA.

## Rollback

Rollback lógico para Evolution só é válido enquanto a sessão/provider anterior continuar funcional. A troca de linked device pode exigir nova autenticação; o runbook deve tratar essa limitação como parte do GO/NO-GO.

## Consequência

O WhatsApp passa a ser uma integração substituível. CRM, follow-up, agenda, campanhas e financeiro dependem da facade de canal, não do provider.
