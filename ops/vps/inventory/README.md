# Inventário de VPS (fase P2 — migração de infraestrutura)

Coleta **somente metadados redatados** de uma VPS Synkroo, antes de qualquer
dump, cópia de volume ou mudança de workload. É o passo **§3 do runbook**
`docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md`
("Inventário obrigatório"), executado nas duas pontas da migração.

O script é `collect-inventory.sh`. Ele **não copia nada**: apenas executa uma
lista fixa de comandos de leitura e grava o resultado em UM arquivo de texto.

## Como rodar sem antes copiar o script para a VPS

Pipe por SSH: o conteúdo do script vai pela stdin e a saída do inventário fica
no diretório de trabalho remoto (`$HOME` do usuário conectado).

```bash
# source: a VPS de onde os dados serão copiados
ssh user@host 'bash -s -- --side=source' < ops/vps/inventory/collect-inventory.sh

# target: a VPS para onde os dados chegarão
ssh user@host 'bash -s -- --side=target' < ops/vps/inventory/collect-inventory.sh

# escolhendo outro diretório de saída no host
ssh user@host 'bash -s -- --side=source --out /root/inventario' < ops/vps/inventory/collect-inventory.sh
```

Variante com `scp` (útil quando o servidor aceita apenas SFTP e o pipe cai):

```bash
scp ops/vps/inventory/collect-inventory.sh user@host:/tmp/collect-inventory.sh
ssh user@host 'bash /tmp/collect-inventory.sh --side=source --out /root/inventario'
# limpeza opcional do script no host
ssh user@host 'rm -f /tmp/collect-inventory.sh'
```

Depois, baixe o inventário para revisão **local** (não para commit direto):

```bash
scp user@host:/root/inventario/inventory-source-<timestamp>.txt ./revisao-local/
```

## Onde o arquivo cai

- Nome: `inventory-<side>-<timestamp UTC>.txt` (`YYYYMMDDTHHMMSSZ`).
- Diretório: o que vier em `--out <dir>`; sem a flag, o diretório atual.
- Exemplo: `/root/inventario/inventory-source-20261005T120000Z.txt`.
- Permissão `0600` (o script usa `umask 077`): o inventário carrega topologia,
  portas, nomes de container e paths que não devem ficar legíveis por outros.
  Se for versionar, copie com `chmod 644` explicitamente.
- Um temporário "crudo" (ainda **não** redigido) é criado dentro de `--out` e
  removido no `exit` (inclusive em falha ou `Ctrl-C`). Ele não deve sobreviver
  ao script: se sobrou arquivo começando com `.inventory-`, apague na mão.

## Regra de revisão antes de compartilhar

> **REVISAR ANTES DE COMPARTILHAR — `crontab`/configs podem conter segredos.**

A redação embutida é *best-effort*, **não é garantia de ausência de segredo**:

- o que é mascarado: pares `chave=valor`/`chave: valor` cujo nome case
  (sem diferenciar maiúsculas/minúsculas) com `password`, `passwd`, `pwd`,
  `token`, `secret`, `api_key`, `api-key`, `apikey`, `authorization`; flags no
  estilo `--chave valor`; userinfo de URL (`protocolo://usuario:senha@host` →
  `protocolo://usuario:<redacted>@host`); blocos de chave privada PEM;
- o que **não** é mascarado: segredo sem nome de chave reconhecível (um token
  solto, um `--flag` desconhecido, um payload JWT colado direto numa linha de
  cron), valor embutido em path, e qualquer formato que nenhum padrão antecipe.

Portanto:

1. **Leia o arquivo inteiro** antes de mandar para qualquer lugar;
2. Releia com atenção a seção `crontab -l`, `systemctl list-timers --all` e
   qualquer linha com `[indisponivel: ...]` (esses marcadores podem esconder
   um comando que nem chegou a rodar aqui);
3. O arquivo **só pode ser commitado** sob `docs/inventory/`, e **somente
   depois** dessa revisão — nunca em issue, PR ou commit intermediário;
4. Na dúvida, regere o arquivo com a linha problemática removida: perder um
   trecho do inventário é barato; vazar uma credencial não.

## Por que o `--side` é obrigatório

`--side=source|target` nunca é inferido. Ausente ou inválido, o script imprime
o uso em `stderr` e sai com código **1** sem coletar nada — mesmo contrato
fail-closed de `scripts/lib/vps-env.mjs`, para que um arquivo de evidência não
seja rotulado com o lado errado por esquecimento de flag.

## O que é coletado

Exatamente a lista do runbook §3, nessa ordem:

| Comando | Para quê |
|---|---|
| `hostname` | identificar a ponta |
| `uname -a` | kernel/arquitetura (compatibilidade de imagem/binário) |
| `df -h` | espaço em disco/inodes (dimensionar backup e dump) |
| `free -h` | memória (dimensionar o workload no target) |
| `docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"` | containers, imagens, portas publicadas |
| `docker compose ls` | projetos compose (localizar os arquivos de compose) |
| `docker network ls` | redes Docker (dependências entre containers) |
| `docker volume ls` | volumes a recriar/vincolar no target |
| `systemctl --failed` | unidades quebradas (evitar surpresa no cutover) |
| `systemctl list-timers --all` | timers/cron systemd |
| `crontab -l` | jobs do usuário operacional |
| `sudo -n ss -lntup` | portas em escuta (firewall/regra de origem) |

Cada coleta é *best-effort*: binário ausente, docker parado ou permissão negada
viram a linha `[indisponivel: <comando>]`, e a coleta continua. `ss` usa
`sudo -n` (não interativo, **nunca** pede senha) com fallback para o comando sem
privilégio. Ausência de `awk` faz o script **falhar fechado**, sem gravar nada:
inventário sem redação é pior do que inventário ausente.

## Como isso alimenta o checklist "Descobrir" da P2

O plano `docs/superpowers/plans/2026-10-05-synkroo-vnext-ai-native-business-os-implementation.md`
§4 (P2) só confirma pelo repositório PostgreSQL 17 + pgvector, cloudflared e o
sidecar Playwright. Tudo abaixo precisa **sair do inventário**, e o arquivo é a
fonte primária dessa descoberta:

- **Evolution** (API) — container/imagem, porta e volume de sessão;
- **Traefik/Nginx** — proxy, certificados, renovação e regras de rota;
- **rede Docker** — redes, aliases e o que enxerga o quê (dependência de DNS interno);
- **outros bancos** — qualquer container/porta de banco além do PostgreSQL principal;
- **cron/systemd/PM2** — timers, crontab do usuário e dos outros, PM2 (`pm2 list`);
- **certificados** — Let's Encrypt/Cloudflare, paths, expiração;
- **firewall** — `ss -lntup` + `ufw`/`nftables`/`iptables` (regra efetiva, não a do repo);
- **volumes e bind mounts** — `docker volume ls` + `docker inspect` para achar os mounts;
- **observabilidade** — logs, agregação de logs, healthcheck, uptime/monitoring;
- **backups** — jobs de backup, destino, retenção e o que existe **fora** do host.

Cada item achado aqui vira tarefa de "Contabo foundation"/"Banco" ou uma decisão
explícita de "não migrar". Itens não encontrados no inventário também contam:
ausência é informação.

## Testes

O contrato do script é verificado por `node:test`, sem tocar em nenhuma VPS:

```bash
node --test scripts/__tests__/vps-inventory-script.test.mjs
```

Os blocos que executam o script de fato são pulados quando não há `bash`
disponível na máquina; o resto (asserções estáticas sobre a lista do §3, a
redação e o contrato do `--side`) roda sempre.
