# ADR-BASE-21: Conectividade privada do PostgreSQL no Contabo — no-go da exposição `0.0.0.0:15433`, destino Tunnel + Access

**Status:** 🟡 Proposta condicional — **NÃO implementada**; nenhuma mudança de produção autorizada
**Data:** 2026-10-10
**Revisão:** 2026-10-11 — caminho único e mandatório **D3 → D4**: removido o caminho
"D4 direto" sem contenção; a contenção D3 **verificada ativa** passa a ser
pré-requisito obrigatório antes de qualquer mudança em Hyperdrive/túnel — sem D3
ativo é **NO-GO e não há cutover**, de modo que o rollback nunca precise reabrir
porta pública irrestrita. G4 é dividido em **preflight de staging** e **corte final
de produção** (janelas separadas; a de produção é autorizada à parte); o negativo de
Access passa a exigir **token ausente e token inválido como casos separados**; após
remover a porta publicada, o gate comprova — com recreate/reboot — que **nenhuma
exposição de porta persiste** no estado tunnel-only (não a persistência do filtro D3,
que pode ser removido). G2/G3 e G5 voltam a valer para o caminho único.
**Escopo:** apenas documentação. Nenhum código, configuração de banco, firewall ou
infraestrutura foi alterado por este ADR.
**Relaciona:** [ADR-BASE-03](ADR-BASE-03-drizzle-pg-hyperdrive.md) (stack de banco),
`docs/ops/vps-access.md` §Firewall do Postgres (antecedente na source, 2026-09-25/26),
`docs/inventory/2026-10-05-contabo-target-findings.md` (deploy/cutover do target),
`docs/inventory/2026-10-07-p2-contabo-validation.md` (dívida de rede explícita),
`docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md` (§4 Rede),
`ops/vps/synkroo-prod-postgres/docker-compose.yml` (compose versionado).

## Contexto

O cutover P2 (2026-10-05) moveu o PostgreSQL de produção para a VPS Contabo
(`213.199.37.252`) e apontou as configurações Hyperdrive de staging e produção para
`213.199.37.252:15433` (`modified_on` 2026-10-05T21:04Z, ver inventário do target).
O design versionado é tunnel-only: o compose do repo não publica porta e inclui o
serviço `cloudflared` (`synkroo-prod-db-tunnel`), deliberadamente omitido no deploy
porque mover/criar rota na Cloudflare é decisão do owner.

Na sessão E2a de 2026-10-10 foram feitas medições **read-only e pontuais** no target.
**Não havia autorização para repetir testes externos**, e nenhum foi repetido.

### Evidência medida (2026-10-10, read-only, uma vez)

| # | Achado | Evidência |
|---|---|---|
| E1 | **Conexão externa direta ao PG fora dos CIDRs Cloudflare foi bem-sucedida** | uma conexão de origem **não-CF** completou handshake **TLS** e autenticação **SCRAM** no PostgreSQL do target — a porta aceita clientes de qualquer host da internet, não apenas de egresso Cloudflare |
| E2 | **Publicação Docker em todas as interfaces** | container `synkroo-prod-postgres` com `0.0.0.0:15433->5432/tcp` |
| E3 | **UFW com ranges Cloudflare apenas em IPv4** | regras `allow` para 15433 só dos 15 ranges públicos Cloudflare **IPv4**; `default deny incoming`; **nenhuma** regra IPv6 equivalente |
| E4 | **`DOCKER-USER` vazia nas duas famílias** | `iptables -L DOCKER-USER -n` e `ip6tables -L DOCKER-USER -n` retornaram chains vazias — não existe filtro de forward efetivo para containers |
| E5 | **Unidade de firewall esperada ausente** | a unidade oneshot de reaplicação do filtro (equivalente à `synkroo-docker-user-firewall.service` que existe na source) **não existe** no target; nada reaplica regra após recreate/reboot |
| E6 | **Deriva entre compose versionado e container vivo** | repo (`ops/vps/synkroo-prod-postgres/docker-compose.yml`): **sem `ports:`** + serviço **`cloudflared`**; container vivo: **porta `0.0.0.0:15433`** + **sem cloudflared** |

**Por que E3 não contém E1:** o tráfego publicado pelo Docker sofre DNAT e segue pela
chain `FORWARD`/`DOCKER`, fora do `INPUT` que o ufw protege. Com `DOCKER-USER` vazia
(E4), as regras ufw não são avaliadas para o caminho publicado — por isso uma origem
não-CF consegue completar TLS+SCRAM (E1).

### Pontos não resolvidos (registrados, não silenciados)

1. **Egresso real do Hyperdrive a partir do target não foi observado.** Na source, a
   amostra de 2026-09-26 (9/9 conexões) apontou `104.16.0.0/13` e `172.64.0.0/13`, mas
   amostra não é universo — e a primeira tentativa de allowlist por ranges (2026-09-25)
   quebrou staging antes de o match correto ser identificado. Nenhuma observação de
   egresso foi feita no target.
2. **A deriva E6 não está reproduzível pelo repo.** O inventário de 2026-10-05 registrou
   `127.0.0.1:15433` no deploy e `0.0.0.0:15433` no cutover; **qual edição/arquivo no
   host produziu o bind `0.0.0.0` não está documentado no repositório**. Consequências
   práticas: `docker compose up`/recreate a partir do compose do repo **removeria** a
   porta (quebrando o Hyperdrive); recreate a partir do compose local do host **reexpoe**
   `0.0.0.0` sem filtro (E4).
3. **Medições são one-shot.** Sem nova autorização, E1–E6 não podem ser reverificados;
   reexecução é gate com dono definido, não reteste ad-hoc.
4. **Conta/plano Cloudflare para Workers VPC desconhecidos** (inclusive a role
   *Connectivity Directory Admin* exigida pelos docs).
5. **TLS:** o certificado do cluster é autoassinado. O Workers VPC verifica em
   `verify_full` por padrão — incompatível com o atual sem `verify_ca`/`disabled`
   ou substituição do certificado.
6. `5433/tcp` (painel-postgres) segue fora do escopo; pendência já registrada em
   `docs/ops/vps-access.md`.

## Decisão (proposta condicional — nada foi aplicado)

**D1 — Postura atual é no-go.** `0.0.0.0:15433` + `DOCKER-USER` vazia + ufw CF-only
constitui exposição pública irrestrita do PostgreSQL (E1: TLS+SCRAM aceito de qualquer
host). Esse estado está **bloqueado** como aceitação permanente em qualquer frente que
dependa dele.

**D2 — Nenhuma allowlist cega de ranges Cloudflare.** Rejeitado usar os ranges IP
públicos Cloudflare como allowlist com pretensão de identidade de tenant (`claiming
tenant identity`): (a) ranges públicos não provam identidade — qualquer workload de
qualquer conta Cloudflare origina dos mesmos ranges; (b) a experiência da source mostra
que allowlist por ranges sem observação do egresso real quebrou staging
(2026-09-25); (c) sem evidência de egresso, o controle é fictício. Allowlist só é
admissível como **contenção medida** (D3), nunca como garantia de origem.

**D3 — Contenção obrigatória: filtro Docker forward efetivo e persistente (não aplicar
agora).** Regras na chain `DOCKER-USER` com match pós-DNAT canônico
(`-d <ip-container> --dport 5432`), `ACCEPT` somente para egressos **observados**,
`DROP` final, mais script idempotente de reaplicação com persistência após recreate
do container e após reboot. Base: solução validada na source (2026-09-26,
`docs/ops/vps-access.md`). **D3 deixa de ser opcional e passa a pré-requisito do
corte D4:** aplicar e verificar D3 **ativo** (G2 positivo+negativo e G3 verdes) antes
de mudar Hyperdrive/túnel. A transferência **não copia ranges** — depende de
observação de egresso no próprio target. Sem D3 verificado ativo, não há cutover:
estado NO-GO.

**D4 — Origem privada final: Cloudflare Tunnel + Access — só com D3 verificado
ativo.** Destino documentado e deployável: Hyperdrive
(`--access-client-id`/`--access-client-secret`) → Access com política *Service Auth*
→ `cloudflared` na VPS → PostgreSQL sem porta publicada. **Não existe caminho D4 sem
contenção D3:** ligar/reapontar Hyperdrive pelo túnel só é admissível **com D3
verificado ativo** (G2 e G3 verdes) já aplicado no target. Sem D3 ativo verificado, o
estado é **NO-GO e não há cutover** — o túnel não é ligado, o Hyperdrive não é
reapontado e a porta publicada permanece como está (NO-GO por D1). A razão é o
rollback: com D3 ativo, reverter o túnel devolve o Hyperdrive ao endpoint atual sob
**filtro efetivo**, sem reabrir acesso público irrestrito; sem D3, o único "rollback"
seria reabrir `0.0.0.0:15433` sem filtro — exatamente o que G5 proíbe. O estado de
exposição atual permanece **NO-GO** (D1) em todo o caminho; este ADR jamais o declara
GO.

**D5 — Workers VPC só após gates de conta/plano/TLS.** A documentação Cloudflare
rotula "Connect to a private database using Workers VPC **(Recommended)**", porém o
produto está em **beta**, exige role *Connectivity Directory Admin* na conta e, em
`verify_full` por padrão, é incompatível com o certificado autoassinado atual. O estado
da nossa conta/plano é **desconhecido** — **não selecionado agora**; reavaliar depois
dos gates de conta/plano/TLS.

**Estado selecionado:** D4 como destino; **D3 como contenção intermediária
obrigatória** (pré-requisito verificado do corte, não opcional); D1/D2 como travas
permanentes. A execução é um único caminho **D3 → D4**, na ordem: conectividade
(G1) → contenção D3 verificada (G2, G3) → corte Tunnel+Access em duas fases (G4) →
rollback contido (G5). **Nenhuma alternativa selecionada está implementada.**

## Gates (definidos; nenhum executado)

Execução de qualquer gate exige autorização do owner em janela própria. Nenhum teste
externo adicional foi autorizado nesta sessão.

**Sequência obrigatória e conjunto único de gates.** Há um único caminho de execução,
**D3 → D4**, e ele exige **todos os gates G1–G5 na ordem**: conectividade (G1) →
filtro de contenção (G2) → persistência do filtro (G3) → corte Tunnel+Access em duas
fases (G4) → rollback contido (G5). D3 verificado ativo (G2 e G3 verdes) é
**pré-requisito** de qualquer mudança em Hyperdrive/túnel; sem ele, G4 não inicia e o
estado segue NO-GO. A **Fase 2 do corte (produção)** usa janela de autorização
própria, separada da de staging.

| Gate | Positivo (aprova) | Negativo (reprova) | Escopo |
|---|---|---|---|
| G1 — Conectividade do app (comum) | staging `/api/health/db` 200 `complete:true`; prod: **readiness real autenticado** — `/api/internal/readiness` com sessão autenticada (ou `CRON_SECRET` via `crypto.timingSafeEqual`) retorna 200 `status:ready` com `checks.database=ok` e `checks.migrations=complete`, comprovando **query real de banco** pelo caminho app → Hyperdrive → PostgreSQL (`getDb()`) | qualquer não-200; `complete:false`; readiness 401/403 (probe sem credencial não prova nada); readiness 503 com `reason` `db-unreachable` ou `migrations-incomplete` (regressão do incidente 2026-09-25) | staging + prod (probe autenticado); o mesmo critério de query real é reaplicado pelo caminho do túnel em G4 (Fase 2, corte) e Fase 3 (pós-corte) |
| G2 — Filtro de contenção (fase D3) | positivo **e** negativo obrigatórios, em IPv4 **e** em IPv6: origem de egresso Hyperdrive **observada** conecta; origem **não** autorizada é bloqueada | inversão do resultado em qualquer família: origem permitida que **não** conecta, ou origem **não** autorizada que conecta; `DOCKER-USER` vazia ou porta sem filtro (E4) | **IPv4 e IPv6** (positivo + negativo em ambas); pré-requisito verificado de G4 |
| G3 — Persistência do filtro D3 (fase D3) | filtro de contenção efetivo após `docker compose recreate`/restart do container **e** após reboot do host, com a porta ainda publicada | `DOCKER-USER` vazia ou porta sem filtro após recrear/reboot | famílias v4+v6; verificado **antes** de iniciar G4 (com D3 ativo) |
| G4 — Corte Tunnel+Access em **duas fases** (preflight staging → corte produção; detalhe em **§G4** abaixo) | **Fase 1 — preflight staging (não toca em produção):** smoke Tunnel+Access verde; **negativo Access em dois casos separados** — token **ausente** negado e token **inválido** negado, cada um isoladamente (nenhum chega ao PostgreSQL). **Fase 2 — corte produção (janela de produção autorizada à parte):** readiness real autenticado 200 `status:ready`/`checks.database=ok`/`checks.migrations=complete` pelo túnel; porta publicada `0.0.0.0:15433` **removida** da publicação do host. **Fase 3 — pós-corte tunnel-only (staging + produção):** readiness com **query real** verde nos dois; probes inbound negativos em **IPv4 e IPv6**; container PostgreSQL **sem porta publicada no host/container**; **persistência do tunnel-only** — após `docker compose recreate`/restart **e** reboot, nenhuma exposição de porta persiste (não exige persistência do filtro D3) | passo fora de ordem — produção sem Fase 1 verde; corte fora da janela de produção autorizada; cada negativo Access reprova isoladamente (token ausente conecta; token inválido conecta; um único caso cobrindo os dois); readiness 401/403/503 pelo túnel; porta removida sem readiness pós-corte verde (quebra o app); exposição de porta que **persista** após recreate/reboot; D3 removido antes de G4 Fase 3 completo em produção | staging (F1) → produção (F2, janela à parte) → pós-corte staging+produção (F3) |
| G5 — Rollback contido (caminho único D3 → D4) | rollback para o estado anterior **sempre com a contenção D3 verificada ativa**: reverter o túnel antes da remoção da porta devolve o Hyperdrive ao endpoint atual sob **filtro efetivo** (nunca acesso público irrestrito) — é por isso que D3 ativo é pré-requisito de G4. Após a porta removida (G4 Fase 2), não há rollback para público: corrige-se pelo túnel. D3 só é removido **depois** de G4 Fase 3 provar o tunnel-only | rollback que **reabra ou restaure** `0.0.0.0:15433` sem filtro efetivo — **proibido em qualquer caminho**, inclusive recriar a publicação depois de removida em G4 Fase 2; remover D3 antes de G4 Fase 3 completo (perde o rollback contido) | staging + produção |

**G1 não é liveness.** `/api/health` 200 prova apenas que o processo responde —
`src/services/api-handlers/health.ts` não consulta banco algum, então manteria 200
mesmo com o Hyperdrive quebrado. Por isso o gate de produção exige o readiness real
autenticado (`src/app/api/internal/readiness/route.ts`: `SELECT 1` + ledger de
migrations dentro de transação com `statement_timeout` de 3s), cujo sucesso depende do
caminho completo app → Hyperdrive → PostgreSQL. O probe é o corrigido na PR44
(`fix(health): bind readiness timeout safely`, merge `a7478979`): sem esse fix,
`SET LOCAL statement_timeout = $1` — rejeitado pelo PostgreSQL como bind parameter —
faria um banco são responder `db-unreachable`, invertendo o gate.

**G2 e G3 são os gates da fase de contenção (D3): obrigatórios e verificados antes de
qualquer corte (G4).** Já a prova de origem que aprova G2 **não** é range público
Cloudflare genérico/compartilhado: qualquer workload de qualquer conta Cloudflare
origina dos mesmos ranges (`104.16.0.0/13`, `172.64.0.0/13` na amostra da source) —
isso é contenção, não identidade (ver D2). A prova de origem account-specific/privada
é o caminho Tunnel+Access (D4); range observado só conta como contenção medida (D3),
nunca como garantia de origem. G2 exige positivo e negativo nas duas famílias, e
resultado invertido em uma família reprova o gate inteiro. G3 fixa que essa contenção
sobrevive a recreate/reboot — **enquanto a porta pública existir** (até a remoção em
G4), é essa persistência que garante o rollback contido; depois do corte, a garantia
passa a ser a persistência do **não-exposição** (G4 Fase 3), não do filtro D3.

### G4 — Corte Tunnel+Access em duas fases

O corte é dividido em **preflight de staging** e **corte final de produção**, com
janelas separadas e autorização própria. A ordem é estrita e D3 permanece ativo
durante as Fases 1 e 2 (túnel staged e caminho de produção testados sob contenção).

**Fase 1 — Preflight de staging.** Não toca em produção; pode rodar **antes** de a
janela de produção ser aberta. Com D3 já verificado ativo (G2/G3 verdes):

1. Smoke Tunnel+Access em staging: Hyperdrive de staging aponta para o túnel; o mesmo
   critério de conectividade com query real de G1 fica verde (`/api/health/db` 200
   `complete:true`).
2. **Negativo de Access, dois casos separados e obrigatórios** (cada um reprova
   isoladamente): (2a) requisição com token de Access **ausente** é **negada** pela
   política *Service Auth* e não chega ao PostgreSQL; (2b) requisição com token de
   Access **inválido** — presente, mas com segredo/identificador errado ou expirado —
   também é **negada** e não chega ao PostgreSQL. Um único caso ("ausente ou
   inválido") não satisfaz o gate.

**Fase 2 — Corte final de produção.** Só inicia com a Fase 1 verde e exige **janela de
produção autorizada separadamente**. O estado de exposição segue NO-GO (D1) até o corte
completar; D3 permanece ativo.

3. Readiness real autenticado de produção pelo caminho app → Hyperdrive → túnel →
   PostgreSQL retorna 200 `status:ready` com `checks.database=ok` e
   `checks.migrations=complete` (critério G1 positivo — conectividade, não liveness).
4. Só com a etapa 3 verde: porta publicada `0.0.0.0:15433` **removida** da publicação
   do host e Hyperdrive apontando **só** pelo túnel. Este é o ponto sem retorno para o
   acesso público — daqui em diante não se reabre porta (G5).

**Fase 3 — Pós-corte (tunnel-only), em staging e produção.** Com a porta removida,
comprovar o estado final:

5. Readiness com **query real** verde em staging **e** produção (200 `complete:true`
   em staging; 200 `status:ready`/`checks.database=ok`/`checks.migrations=complete` em
   produção) — o caminho tunnel-only serve query real de banco.
6. **Probes negativos de rede inbound**, em **IPv4 e IPv6**: origem externa **não
   autorizada** não conecta ao PostgreSQL em nenhuma família; nenhuma interface escuta
   `15433` publicamente. É a prova de que a exposição acabou nas duas famílias (a
   ausência da regra IPv6, E3, fica coberta aqui).
7. **Sem porta PostgreSQL publicada no host/container:** inspeção (`docker compose ps`
   ou equivalente) confirma que o container PostgreSQL **não** publica `0.0.0.0:15433`
   em nenhuma interface; operação read-only passa a ser apenas `docker exec` via SSH.
8. **Persistência do tunnel-only** (a prova que substitui G3 após o corte): após
   `docker compose recreate`/restart **e** após reboot do host, o item 7 continua
   verdadeiro — **nenhuma exposição de porta persiste** — e o `cloudflared` volta
   sozinho mantendo o readiness verde. Aqui **não** se exige a persistência do filtro
   D3 (D3 pode ser removido); exige-se a persistência do **não-exposição**, ancorada no
   compose versionado sem `ports:` + serviço `cloudflared` (corrige a deriva E6).

Somente após a Fase 3 completa em produção a contenção D3 pode ser removida; até lá
permanece ativa (garantia de rollback contido). Qualquer porta publicada remanescente
— em qualquer família ou após recreate/reboot — reprova o gate.

**Ordem e critérios — caminho único D3 → D4.** A contenção (D3) é pré-requisito e o
túnel (D4) é o destino; há um único caminho, na ordem **G1 → G2 → G3 → G4 → G5**:

- **Contenção D3 primeiro (obrigatória):** G1 (conectividade) → G2 e G3 (filtro de
  contenção efetivo + persistência, positivo+negativo em IPv4 e IPv6, em staging e
  produção). D3 verificado ativo é condição para iniciar G4 — sem ele não há cutover
  e o estado segue NO-GO.
- **Corte Tunnel+Access em duas fases (G4):** Fase 1 preflight de staging (smoke +
  negativo de Access com token **ausente** e **inválido** como casos separados); Fase 2
  corte de produção em **janela autorizada à parte** (readiness real pelo túnel, depois
  remoção da porta publicada); Fase 3 pós-corte (readiness com query real em
  staging+produção, probes inbound negativos em IPv4/IPv6, ausência de porta publicada
  e persistência do tunnel-only via recreate/reboot). D3 permanece ativo durante as
  Fases 1 e 2.
- **Remoção da contenção só depois do corte completo:** G4 Fase 3 completo em produção
  é necessário **e** suficiente para remover D3; até lá permanece ativa. O rollback do
  túnel (G5) só é permitido com D3 ativo — a fase de rollback nunca é "liberar tudo" e
  nunca reabre `0.0.0.0:15433` sem filtro.

## Consequências

- **Nada foi aplicado:** a exposição E1–E6 permanece; o risco está **aberto e não
  mitigado** — **nenhuma aceitação formal do owner está registrada**. O registro
  existe para não silenciar o risco, não para tratá-lo como aceito.
- **Próxima ação é condicional à autorização do owner**, em janela autorizada, e sem
  caminho alternativo: execução no caminho único **D3 → D4** — primeiro a contenção D3
  verificada ativa (G1–G3), depois o corte Tunnel+Access em duas fases (G4) com a
  **janela de produção autorizada separadamente**, e rollback contido (G5). Sem D3
  verificado ativo é **NO-GO e não há cutover**. O estado de exposição atual permanece
  NO-GO até o corte privado completar em staging e produção.
- Custo do destino D4: `cloudflared` versionado + token/rota + remoção da porta
  publicada; acesso operacional read-only passa a ser `docker exec` via SSH.
- A deriva E6 precisa de correção documental/operacional separada: o compose do host
  e o do repo devem voltar a descrever o mesmo estado (ou a diferença ser registrada
  como exceção consciente).

## Alternativas rejeitadas

- **Allowlist CF cega com alegação de identidade:** rejeitada por D2 — ranges públicos
  não carregam identidade de tenant e a allowlist sem observação de egresso quebrou
  staging na source.
- **Manter a postura atual:** rejeitada por D1 — exposição pública irrestrita.
- **Aplicar Workers VPC agora:** rejeitado por D5 — gates de conta/plano/TLS ausentes,
  apesar do rótulo "Recommended" dos docs.
- **Remover a porta publicada sem túnel:** quebraria o Hyperdrive imediatamente
  (origem atual é TCP público).

## Fontes Cloudflare (verificadas em 2026-10-10)

- Connect to a private database using Workers VPC (Recommended):
  <https://developers.cloudflare.com/hyperdrive/configuration/connect-to-private-database-vpc/>
  (pré-requisitos: túnel, role *Connectivity Directory Admin*; TLS `verify_full` padrão,
  `--cert-verification-mode` para autoassinado)
- Connect to a private database using Cloudflare Tunnel:
  <https://developers.cloudflare.com/hyperdrive/configuration/connect-to-private-database/>
  (Access + Service Token; Hyperdrive exige TLS na origem)
- Workers VPC (beta, gratuita para todos os planos durante o beta):
  <https://developers.cloudflare.com/workers-vpc/>
- VPC Services / modos de verificação TLS:
  <https://developers.cloudflare.com/workers-vpc/configuration/vpc-services/>
- Cloudflare Tunnel — private networks:
  <https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/private-net/>
- Cloudflare Access — policies (Service Auth):
  <https://developers.cloudflare.com/cloudflare-one/access-controls/policies/>
- Cloudflare Tunnel — requisitos de firewall (egresso 7844 TCP/UDP):
  <https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/tunnel-with-firewall/>

## Status de implementação

**Nada implementado. Nenhuma mudança de produção autorizada. Nenhum teste externo
repetido.** Este ADR registra evidência medida, decisão proposta condicional e gates do
caminho único **D3 → D4**; a execução depende de autorização do owner e exige todos os
gates **G1–G5 na ordem**, com a contenção D3 verificada ativa como pré-requisito do
corte (sem D3 é NO-GO e não há cutover). A Fase 2 do corte em produção tem janela
autorizada à parte. O estado de exposição atual permanece NO-GO até o corte privado
completar em staging e produção.
