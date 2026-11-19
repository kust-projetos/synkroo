# Inventário PostgreSQL Contabo — 2026-11-19

> **Data e escopo:** coleta read-only em 2026-11-18, 21:35–21:37 -03
> (2026-11-19, 01:35–01:37 CET). Este documento registra o inventário medido;
> nenhuma mutação operacional foi executada.
>
> **Autoridade:** fotografia pontual do estado observado, não configuração
> desejada nem autorização para alterar VPS, firewall, banco ou aplicação.
> O inventário de 2026-11-12 é mantido apenas como histórico e está obsoleto
> para descrever o estado atual.

## Estado medido

### Host, containers e portas

- Host `vmi3630510`, uptime de 2d6h46 no momento da coleta.
- O container `synkroo-prod-postgres` não existe. A rede
  `synkroo-prod-postgres_default` ainda existe.
- Não há `cloudflared` de banco. O único tunnel observado foi
  `iptv-staging-tunnel`, pertencente a outro projeto.
- O banco Synkroo está no container `db-central-hml` (pgvector/PostgreSQL 17),
  em estado `healthy`, publicado em `0.0.0.0:15434` e `[::]:15434`.
- `db-central-prod` não publica porta e não contém bancos Synkroo.
- A porta 15433 não está publicada e não há listener nela. A porta 5433/tcp
  também não apareceu em `ss` nem em `docker ps`; sua inexistência é provável,
  mas não foi confirmada por inspeção de configuração.
- `db-central-hml` também hospeda os bancos `freelingo`, `kaneo`, `infisical` e
  `pi_financeiro_canonical`, além de `synkroo`, `synkroo_staging` e `iptv`.

### Firewall e serviços

- Em IPv4, `DOCKER-USER` contém a chain `SYNKROO-D3`, direcionada a
  `172.20.0.2:5432`, órfã após o desaparecimento do container; seus contadores
  estão zerados.
- A chain `DBCENTRAL-HML` direciona para `172.31.0.3`, com 15 regras ACCEPT
  para ranges Cloudflare e DROP final. Há tráfego observado em
  `162.158.0.0/15`, `104.16.0.0/13` e `172.64.0.0/13`; o DROP acumulava
  12 pacotes.
- Em IPv6, `DOCKER-USER` contém somente `SYNKROO-D3-V6`, com DROP para porta
  5432 a qualquer destino. Não há chain IPv6 correspondente a
  `db-central-hml`/15434.
- `synkroo-d3-firewall.service` e `dbcentral-hml-firewall.service` estavam
  enabled e active (exited), desde 2026-11-16 18:48 CET.
- UFW estava ativo, com 15 allows obsoletos para 15433 e sem regra para 15434.

### PostgreSQL, bancos e papéis

- PostgreSQL 17.11; extensões observadas: `plpgsql` 1.0, `btree_gist` 1.7 e
  `vector` 0.8.7.
- O schema `public` contém 75 tabelas. O ledger
  `drizzle.__drizzle_migrations` contém 40 linhas em `synkroo` e
  `synkroo_staging`.
- `/api/health/db` em produção retornou HTTP 200, `complete`, 40/40 e
  `maintenanceControl` presente; `/api/health` retornou HTTP 200 `ok`.
- TLS está habilitado (`ssl=on`) com mínimo TLS 1.2; autenticação
  `scram-sha-256`; `log_connections=off`; `max_connections=100`.
- `pg_hba.conf` permite `trust` somente localmente (`local`, `127.0.0.1`,
  `::1`) e tem regra remota `host all all all scram-sha-256`, que não exige
  SSL no servidor.
- Os papéis `synkroo` e `synkroo_staging` não são superusers
  (atributos f/f/f/f); são donos dos respectivos bancos e das 75 tabelas.
- Existem `synkroo_app` e `synkroo_staging_app`; o primeiro tem
  SELECT/INSERT/UPDATE/DELETE nas 75 tabelas e USAGE em `public`. Também foram
  observados `outbox_worker` (LOGIN) e `outbox_executor` (sem LOGIN).
- A inspeção de papéis foi feita com `docker exec` e `psql -U postgres`,
  superuser local, usando somente SELECT e sem senha em argumentos.

### Hyperdrive

- Produção: `be5a789a003e4f08a94a82dffbb091be`.
- Staging: `e0033a75f4e2449084b00b41e22e49a6`.
- Foram observadas cinco conexões de cada Hyperdrive como `synkroo` /
  `synkroo_staging`, todas com `ssl=t`; `synkroo_app` não tinha conexões.
- A origem parece ter sido alterada para 15434, inferido pelo tráfego na chain
  `DBCENTRAL-HML` e pela ausência de listener em 15433. Host e porta exatos não
  foram lidos pela API Cloudflare; portanto, a origem não foi confirmada
  diretamente.

## Divergências vs 2026-11-12

O documento de 2026-11-12 é histórico e não representa o estado atual. Entre
as diferenças observadas estão o desaparecimento do container dedicado
`synkroo-prod-postgres`, a publicação do banco compartilhado em 15434, o
crescimento de 68 para 75 tabelas, os papéis Synkroo deixando de ser
superusers e a chain `SYNKROO-D3` tornando-se órfã. Consulte o documento
histórico para os detalhes daquele snapshot; prevalecem aqui os fatos medidos
nesta coleta para o estado de 2026-11-18/19.

## Gates D3/D4 e #94 — pendências

Conforme os gates registrados no ADR-BASE-21:

- **G1:** falta readiness interno autenticado.
- **G2:** falta teste negativo externo IPv4/IPv6; não há chain IPv6 para
  15434.
- **G3:** falta drill de recreate/reboot.
- **G4/G5:** não iniciados; não há túnel/Cloudflare Access.
- O ADR precisa ser reescrito para refletir 15434 e `db-central-hml`.
- **#94:** parcialmente atendido — os papéis de runtime não são superusers e
  existe role app, mas o runtime ainda conecta como owner.

## Riscos

- **Alto:** porta 15434 publicada em IPv4 e IPv6 numa instância compartilhada;
  não foram executados testes externos de alcance.
- O runtime conecta como owner, mantendo privilégios acima do papel app.
- A regra remota de `pg_hba.conf` usa `host`, não `hostssl`; SSL não é
  obrigatório pelo servidor.
- A chain IPv6 observada não protege especificamente o endpoint
  `db-central-hml`/15434.
- A regra IPv4 `SYNKROO-D3` refere-se a endereço/container ausente e não
  comprova filtragem do serviço atual.

## Limitações

- Nenhum teste externo de conectividade/alcançabilidade foi feito.
- A configuração de origem Hyperdrive não foi consultada via API Cloudflare.
- O compose do host `db-central` não foi lido.
- `log_connections=off` limita a evidência disponível em logs de conexão.
- A ausência de 5433/tcp foi observada em sockets e containers, não validada
  contra a configuração de publicação.

## Próximos passos (NÃO executados)

1. Atualizar o ADR-BASE-21 para o endpoint efetivamente observado e decidir
   formalmente o modelo de conectividade antes de qualquer mudança.
2. Fechar G1/G2/G3 com evidência apropriada, incluindo avaliação IPv4 e IPv6.
3. Iniciar G4/G5 somente conforme decisão e gates do ADR.
4. Avaliar a migração do runtime para os papéis app e a exigência de TLS,
   preservando validação e plano de recuperação.

Nenhum dos passos acima foi executado durante a coleta ou a elaboração deste
inventário.
