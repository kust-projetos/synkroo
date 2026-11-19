# A-REDE — evidência dos gates (2026-11-19)

Tarefa V12-A-REDE-GATES. Somente leitura + dump não-destrutivo. **Nenhuma mudança de firewall, role, credencial ou deploy foi feita.**

## Gate 1 — consumidores da 15434 (`db-central-hml`)

Amostras de `pg_stat_activity` (client backend) às 15:19:34, 15:19:54 e 15:20:14 UTC:

| Banco | Usuário / app | Origem | SSL | Via porta publicada? |
|---|---|---|---|---|
| `synkroo` | `synkroo` / Cloudflare Hyperdrive | 172.70.245.{14,37,38,119,178} | sim | sim (IPs Cloudflare reais) |
| `synkroo_staging` | `synkroo_staging` / Cloudflare Hyperdrive | 104.22.123.{136,137,140,243}, 162.158.85.166 | sim | sim |
| `iptv` | `iptv_app`, `outbox_worker` | 172.31.0.4 / 172.31.0.6 (rede docker `dbcentral_net`) | não | não — rede interna |
| `pi_financeiro_canonical` | `pi_financeiro` | 172.31.0.8 (rede docker) | não | não — rede interna |
| `postgres` | `postgres` / psql | socket local (minha sonda) | não | não |

- `infisical` existe como banco (64 MB), mas não teve conexão nas 3 amostras.
- `pg_hba`: `host all all all scram-sha-256` (exposição externa depende só do firewall e da senha).
- `ss -tnp ... sport=:15434`: sem conexões estabelecidas visíveis para a porta (tráfego v4 passa por DNAT; conntrack não legível: `sudo -n` sem retorno útil).

### Conclusão de impacto

Nas amostras, **todo o tráfego externo vindo da porta 15434 é do Synkroo** (Hyperdrive prod/staging). Os demais projetos (iptv, pi_financeiro) usam a rede docker interna (172.31.0.0/24, direto no 5432 do container) e não dependem da porta publicada. A contenção v6 em INPUT (DROP-only, só porta 15434, cenário S1) **não deveria afetar outros projetos nem o Hyperdrive**, que conecta por IPv4 (nenhuma origem v6 observada; sob S1 clientes v6 apareceriam com IP do gateway docker, e nenhum foi visto).

### Incertezas

- Janela curta (≈40 s): um consumidor esporádico (ex.: `infisical`, jobs agendados, manutenção manual) pode não ter aparecido. Recomenda-se ao menos mais uma amostra mais longa (ou log de conexões) antes da mudança.
- O `.env` do VPS e consumidores externos de operadores (acesso manual via 15434 a partir de IPs fixos) não são visíveis por este método.
- Conntrack/`ss` não mostraram sessões, então a atribuição vem exclusivamente de `pg_stat_activity`.
- A decisão de aceitar o impacto continua sendo do owner (§7 do plano).

## Gate 2 — backup verificado

Forma canônica: `scripts/backup-vps-db.ts` → `scripts/db-backup.mjs --url`. **Não utilizada**: exige `pg_dump` no PATH local (ausente nesta estação) e conectaria via porta pública. Equivalente adotado (mesmo formato do modo `--local` do engine: `pg_dump -Fc`, executado dentro do container): `docker exec db-central-hml pg_dump -U postgres -d <db> -Fc`, com saída redirecionada para arquivo no host (`umask 077`). Nenhuma senha foi usada nem exposta (socket local do container).

Diretório privado no host (modo 0700, novo, vazio antes): `/home/deploy/backups-a-rede-gates/`. Timestamp: 2026-11-19T15:20:58Z. Postgres 17.11.

| Arquivo (0600) | Bytes | SHA-256 | TOC |
|---|---|---|---|
| `synkroo-20261119T152058Z.dump` | 247692 | `111bc67e40f86bf84b5c02fb471f6c29783c6501b475177bff50c6fe56528b3d` | 528 entradas, CUSTOM, gzip |
| `synkroo_staging-20261119T152058Z.dump` | 247860 | `39c3dcf4ed2c11bfbb112469518efe237d1ef0ee8f3bf4601723e2b11cf8f2e3` | 528 entradas, CUSTOM, gzip |

Verificação: `pg_restore --list` leu os dois arquivos integralmente (listas em `*.dump.list.txt`; sidecars `*.dump.sha256`). **Não** foi feito restore de ensaio.

Limitações (na data do dump): cópia somente no mesmo host; nada foi apagado nem sobrescrito; o banco não foi modificado. A cópia off-host foi feita depois — ver a atualização abaixo.

## Atualização — cópia off-host e amostragem estendida (2026-11-19)

### Cópia off-host

`scp` (via alias `contabo-prod`, chave do ambiente do operador) de `/home/deploy/backups-a-rede-gates/*20261119T152058Z.dump*` para `C:\Users\walis\AppData\Local\Temp\opencode\a-rede-backups-20261119\` (fora do repositório). Nada foi apagado no host.

| Arquivo local | Bytes | SHA-256 local | Sidecar |
|---|---|---|---|
| `synkroo-20261119T152058Z.dump` | 247692 | `111bc67e40f86bf84b5c02fb471f6c29783c6501b475177bff50c6fe56528b3d` | igual (match) |
| `synkroo_staging-20261119T152058Z.dump` | 247860 | `39c3dcf4ed2c11bfbb112469518efe237d1ef0ee8f3bf4601723e2b11cf8f2e3` | igual (match) |

Os `.sha256` e `.list.txt` foram copiados juntos. Continua sem restore de ensaio.

### Amostragem estendida de `pg_stat_activity` (somente SELECT)

Janela real: 15:21:59Z → 15:31:36Z (**9 min 37 s**, 20 coletas a cada ~30 s; 208 linhas de client backend, excluída a própria sonda). Dados brutos locais: `C:\Users\walis\AppData\Local\Temp\opencode\samples-20261119.txt`.

| Banco / usuário / app | Origem (`client_addr`) | SSL | Coletas em que apareceu (de 20) |
|---|---|---|---|
| `synkroo` / Hyperdrive | 172.70.245.14, .37, .38, .119, .178 | sim | 20 cada |
| `synkroo_staging` / Hyperdrive | 104.22.123.136, .243, 162.158.85.166 | sim | 20 cada |
| `synkroo_staging` / Hyperdrive | 104.22.123.137 | sim | 17 |
| `synkroo_staging` / Hyperdrive | 104.22.123.140 | sim | 10 |
| `iptv` / `outbox_worker` (`outbox-worker`) | 172.31.0.4 (rede docker interna) | não | 20 |
| `iptv` / `iptv_app` | 172.31.0.6 (rede docker interna) | não | 1 |

Nenhuma conexão de `infisical`, `pi_financeiro_canonical` ou `postgres` apareceu nesta janela (a `pi_financeiro` aparecera na amostragem anterior, também pela rede interna 172.31.0.x). Nenhuma origem IPv6 nem do gateway do docker-proxy. Nenhuma conexão externa fora do Hyperdrive do Synkroo.

### Veredito

- **Backup: gate fechado** (dump verificado por `pg_restore --list`, cópia off-host com SHA-256 conferido).
- **Impacto: gate de impacto fechado**, com ressalva de evidência: em ~10 min de amostragem estendida mais a janela inicial de ~40 s, os únicos clientes externos da 15434 são o Hyperdrive do Synkroo (prod e staging); os demais projetos usam a rede docker interna. Risco residual: consumidor muito esporádico (ex.: `infisical`, acesso manual de operador) fora das janelas. A confirmação de aceite pelos owners (§7 do plano) segue necessária.

Nenhuma regra de firewall, role, credencial, banco ou deploy foi alterada.
