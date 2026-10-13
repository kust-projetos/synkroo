# Contabo foundation — bootstrap do host (runbook §4)

Script: [`bootstrap.sh`](./bootstrap.sh) · Testes: `scripts/__tests__/vps-contabo-bootstrap.test.mjs`

Referência: `docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md` **§4 Contabo foundation**.

O script prepara um host **novo** (Ubuntu 24.04) para rodar o Synkroo em Docker: usuário
operacional, SSH por chave, hardening de senha/root, firewall default-deny, Docker + Compose,
NTP, timezone e os diretórios da aplicação e de backup.

Ele **não** move dados, **não** mexe em DNS e **não** instala PostgreSQL — isso é do §5
(migração PostgreSQL) e dos runbooks seguintes.

---

## Pré-requisitos

| Item | Observação |
|---|---|
| Host novo | Ubuntu 24.04 LTS, ainda sem serviço de produção. Não rode em host com dados. |
| Acesso root | SSH de root **com senha** ou console do painel Contabo — é o caminho de emergência. A sessão root inicial precisa **permanecer aberta** até o passo 6 (ver a sequência abaixo). |
| Arquivo de chave pública | Conteúdo em formato `authorized_keys` (uma linha por chave). A chave privada fica **sempre** na sua máquina. |
| Conexão de saída | `download.docker.com` (repo Docker) e o repositório Ubuntu precisam estar acessíveis. |

Antes de começar, tenha em mãos:

- o **IP do host**;
- o caminho do seu `*.pub` na máquina local (ex.: `~/.ssh/synkroo.pub`);
- o console do painel Contabo aberto numa aba separada (é o caminho de recuperação).

---

## Sequência de execução

O `--yes` é o gate que aplica mudanças. **Sem ele o script é dry-run**: imprime o plano inteiro
fase a fase e não altera nada. O `--apply-firewall` é um gate separado, porque habilitar o
firewall **antes** de validar o login por chave é o caminho clássico de lockout.

### 1. Copiar o script para o host

```bash
scp ops/vps/contabo/bootstrap.sh root@<IP_DO_HOST>:/root/bootstrap.sh
ssh root@<IP_DO_HOST> 'chmod 0755 /root/bootstrap.sh'
```

### 2. Dry-run (obrigatório primeiro)

```bash
ssh root@<IP_DO_HOST> \
  '/root/bootstrap.sh --ssh-key-file /root/synkroo.pub'
```

Leia o plano printed fase a fase. Saída esperada: exit code `0` e nenhuma mutação no host.

O script **valida a chave pública** (`ssh-keygen -l -f`) e aborta com exit `2` se o arquivo
não existir ou contiver linha inválida — antes de qualquer mudança.

### 3. Aplicar sem mexer no firewall — em UMA sessão root

Abra **uma** sessão root **interativa** e mantenha-a aberta até o passo 6:

```bash
ssh root@<IP_DO_HOST>
```

Dentro dela, rode o bootstrap:

```bash
/root/bootstrap.sh --ssh-key-file /root/synkroo.pub --yes
```

> **Não use a forma `ssh root@<host> 'comando'` aqui**: ela encerra a conexão
> assim que o comando termina, e a sessão root aberta é justamente o seu
> caminho de recuperação durante os passos 4–6 (root por senha já estará
> bloqueado e o script não instala chave de root).

Isso faz: atualização do sistema, timezone/NTP, usuário + chave, hardening do SSHD, Docker e os
diretórios. **O firewall continua intocado** nesta passada.

Dois gates que valem saber:

- com `--yes`, `--ssh-key-file` é **obrigatório** (e precisa conter ao menos uma chave pública
  *válida*). Sem isso o script sai com `2` **antes de qualquer mudança** — hardingar o SSHD sem
  chave é o caminho direto para o lockout;
- depois do reload o script confere a política **efetiva** (`sshd -T`) e sai com `3` se
  `passwordauthentication`/`kbdinteractiveauthentication`/`permitrootlogin` não baterem com
  `no`/`no`/`prohibit-password`. É a defesa contra um drop-in anterior (ex.:
  `50-cloud-init.conf`) que venceria o nosso por precedência.

### 4. ⚠️ Testar o login por chave — SEGUNDO terminal, sessão root ainda aberta

> Esta é a etapa que impede o lockout. Não pule.

**Não feche** a sessão root do passo 3. Abra **outro terminal** (ou uma janela separada do seu
cliente SSH/Windows Terminal) e rode:

```bash
ssh synkroo@<IP_DO_HOST> 'id && echo LOGIN_POR_CHAVE_OK'
```

Só siga para o passo 5 se imprimir `LOGIN_POR_CHAVE_OK`. Se falhar:

- **não** aplique o firewall;
- volte **à sessão root ainda aberta** e corrija o `authorized_keys`;
- o script nunca sobrescreve chaves existentes — ele só acrescenta as que faltam, então rodar
  de novo é seguro.

### 5. Decidir como o usuário operacional executa `sudo` (não é configurado pelo script)

`synkroo` entra no grupo `sudo`, mas **não tem senha** — o script não instala NOPASSWD de
propósito. Então `sudo -n true` (não interativo) **falha** até você decidir. Escolha uma:

| Opção | Como | Consequência |
|---|---|---|
| Senha para o usuário | `passwd synkroo` (na sessão root) | `sudo` passa a pedir a senha; mantenha-a fora do repositório |
| NOPASSWD deliberado | `/etc/sudoers.d/90-synkroo` com `synkroo ALL=(ALL:ALL) NOPASSWD: ALL` (modo `0440`, validar com `visudo -cf`) | `sudo` nunca pede senha — é o mesmo poder do root |

Faça essa escolha **antes** do passo 6; sem ela, os comandos com `sudo` do passo 6 não rodam.

### 6. Aplicar o firewall default-deny — **na mesma sessão root do passo 3**

⚠️ **Não reabra o root por senha depois do passo 3**: `PasswordAuthentication no` já está ativo e o
script não instala chave de root. Rode o passo seguinte **na sessão root que continua aberta**:

```bash
/root/bootstrap.sh --ssh-key-file /root/synkroo.pub --yes --apply-firewall
```

A ordem dentro do script é fixa e testada: `default deny incoming` → `default allow outgoing` →
`allow OpenSSH` → **só então** `ufw --force enable`. A regra do SSH vem antes da ativação.

### 7. Conferir o resultado

Pelo console do painel Contabo ou pelo usuário operacional (conforme a decisão do passo 5):

```bash
ssh synkroo@<IP_DO_HOST> \
  'sudo ufw status verbose; docker --version; docker compose version; timedatectl show -p NTP --value; ls -ld /opt/synkroo /var/backups/synkroo'
```

Log completo da execução aplicada: `/var/log/synkroo-bootstrap.log`.

---

## Recuperação de lockout

Se o login por chave falhar depois do hardening, **não tente adivinhar** — use o **console do
painel Contabo** (a aba que você deixou aberta):

1. painel Contabo → seu VPS → **Console** (acesso root direto, sem SSH);
2. corrija `/home/synkroo/.ssh/authorized_keys` (permissões `0600`, diretório `0700`, dono
   `synkroo:synkroo`);
3. se precisar reverter o hardening, remova o drop-in
   `/etc/ssh/sshd_config.d/00-synkroo-hardening.conf` e rode `systemctl reload ssh`;
4. confira a política efetiva com `/usr/sbin/sshd -T | grep -iE 'passwordauthentication|permitrootlogin'`
   (o valor efetivo é o **primeiro** obtido — um `50-cloud-init.conf` com
   `PasswordAuthentication yes` vence o nosso);
5. se precisar reverter o firewall: `ufw disable`.

Não desligue/recrie o VPS por causa de acesso — a sessão do console não depende do SSH.

---

## Idempotência

O script pode ser reexecutado quantas vezes for preciso. Cada fase verifica o estado antes de
agir:

| Fase | Verificação de idempotência |
|---|---|
| Pacotes base | `apt-get` é idempotente por natureza |
| Timezone / NTP | compara `timedatectl show -p Timezone` e `-p NTP` |
| Usuário | `id -u "$ADMIN_USER"`; grupo via `id -nG \| grep -qx sudo` |
| `authorized_keys` | `grep -qxF` por linha — **append-only**, nunca sobrescreve |
| Drop-in do SSHD | `grep -qxF` das diretivas esperadas no arquivo (nome `00-synkroo-hardening.conf`; um `60-synkroo-hardening.conf` de uma versão anterior é inerte e pode ser apagado) |
| Docker | `dpkg -s docker-ce` |
| Diretórios | `[ -d /opt/synkroo ]`, `[ -d /var/backups/synkroo ]` |

---

## O que **não** é feito (de propósito)

| Pendência | Motivo |
|---|---|
| **Logs / monitoramento** | Depende da stack e dos alertas que o operador escolher. Não há decisão registrada no runbook. Marcado como `[TODO]` na saída do script. |
| **Backup off-host** | Exige decidir destino, credencial e retenção (runbook §5.2 lembra que não se pode depender do único backup no mesmo host). Deixado como `[TODO]`. |
| **Espaço / inode** | Requer limiar e plano de ação do operador; o script imprime o comando de verificação (`df -h / && df -i /`) como `[TODO]`. |
| **Regra de firewall para PostgreSQL / 5432** | Runbook §4 Rede: *"PostgreSQL não deve ficar globalmente exposto só para facilitar Hyperdrive. Preferir túnel/rota compatível validada. Não repetir a regra de firewall que anteriormente quebrou Hyperdrive sem identificar a origem real do tráfego."* O script **não** cria nenhuma regra para o 5432, e o teste automatizado falha se alguém acrescentar uma. |
| **`fail2ban`** | Não está no runbook §4. Instalado nada além de `ca-certificates curl gnupg ufw`. |

---

## Mapa: item do §4 → fase do script

| Item §4 (Host) | Fase | O que acontece |
|---|---|---|
| atualizar sistema | 1 | `apt-get update` + `apt-get -y upgrade` + base (`ca-certificates curl gnupg ufw`) |
| criar usuário operacional | 3 | `useradd --create-home` + `usermod -aG sudo` (só se ausente) |
| SSH por chave | 3 | `~/.ssh` `0700`, `authorized_keys` `0600` append-only, dono `synkroo`; com `--yes` o `--ssh-key-file` é obrigatório |
| desabilitar login por senha/root | 4 | drop-in `00-synkroo-hardening.conf` (ordena antes de qualquer `50-cloud-init.conf`): `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `PermitRootLogin prohibit-password`, `X11Forwarding no` — e conferência da política **efetiva** com `sshd -T` (fail-closed, exit `3`) |
| firewall default-deny | 5 (gate `--apply-firewall`) | `default deny incoming`, `default allow outgoing`, `allow OpenSSH`, então `ufw --force enable` |
| instalar Docker + Compose | 6 | repo oficial apt (keyring GPG), `docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`, `usermod -aG docker` |
| configurar NTP | 2 | `timedatectl set-timezone` + `timedatectl set-ntp true` |
| criar `/opt/synkroo` | 7 | `install -d -o synkroo -g synkroo -m 0750` |
| criar `/var/backups/synkroo` | 7 | `install -d -o synkroo -g synkroo -m 0750` |
| garantir espaço e inode | 8 (`[TODO]`) | **não implementado** — comando de verificação impresso |
| configurar logs/monitoramento | 8 (`[TODO]`) | **não implementado** |
| configurar backup off-host | 8 (`[TODO]`) | **não implementado** |
| §4 Rede — portas públicas mínimas | 5 | só `OpenSSH` é liberado; nada de 5432 |
| §4 Rede — Hyperdrive por túnel/rota validada | 5 / 8 (`[TODO]`) | **não implementado** — exige identificar a origem real do tráfego antes |

---

## Riscos assumidos

- **Grupo `docker` equivale a root.** Depois da fase 6, `synkroo` tem poder total no host. É o
  mesmo modelo do Docker upstream; o alerta está na saída do script.
- **`ufw` e Docker.** Containers publicam portas direto no iptables e podem ignorar o `ufw`. Como
  este script **não** abre portas de container, o problema não surge aqui — mas ao adicionar
  serviços na fase §5/§6, reavalie a interação `ufw` × Docker.
- **`prohibit-password` no root.** O root ainda entra por chave. Se a política exigir root
  completamente bloqueado, mude para `PermitRootLogin no` **e** valide o sudo do usuário
  operacional antes — a mudança não está no runbook atual.
- **Sem senha para `synkroo`.** O script cria o usuário no grupo `sudo` mas não define senha nem
  NOPASSWD (decisão do operador, passo 5 da sequência). Até essa decisão, `sudo` interativo não
  funciona — e o root por senha já está bloqueado, então essa decisão precisa ser tomada na
  sessão root ainda aberta.
- **`sshd -T` pode não rodar.** Se falhar (sem contexto de host, host key ausente, sem root), o
  script aborta com `3` em vez de assumir o hardening: preferimos um abort explícito a um host que
  parece endurecido e não está.

---

## Testes

```bash
node --test scripts/__tests__/vps-contabo-bootstrap.test.mjs
```

Cobre, por asserção estática sobre o fonte do `.sh`: presença do hardening de senha/root, drop-in
com prefixo `00-` (precedência do sshd), `sshd -t` **antes** do reload e `sshd -T` **depois** dele
(com caminho de falha), `ufw allow OpenSSH` **antes** de `ufw --force enable` (por `indexOf`),
`--yes` sem `--ssh-key-file` saindo com `2` antes de qualquer fase, presença de `/opt/synkroo` e
`/var/backups/synkroo`, gate `--yes` com saída `0` no dry-run, validação de chave com
`ssh-keygen -l -f`, ausência de `curl … | bash` e ausência de qualquer `ufw allow` para
5432/PostgreSQL. Quando `bash` está disponível, o teste também roda `bash -n` e executa o script
em dry-run (exit `0`), com `--ssh-key-file` inexistente, com `--yes` sem chave (exit `2`) e com um
arquivo de chave só com comentários (exit `2`).
