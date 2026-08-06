# Acesso VPS — Synkroo

## Fonte de configuração

Execute comandos a partir da raiz deste projeto. Configuração privada fica em `../vps-hostinger/.env`.

Nunca copie senha, token, chave privada ou valor de `.env` para este repositório.

### Bash/Git Bash

```bash
VPS_ENV=../vps-hostinger/.env
set -a
. "$VPS_ENV"
set +a
: "${VPS_IP:?VPS_IP ausente}"
: "${VPS_SSH_USER:?VPS_SSH_USER ausente}"
: "${VPS_SSH_KEY_PATH:?VPS_SSH_KEY_PATH ausente}"
```

### PowerShell

```powershell
$envFile = Resolve-Path ..\vps-hostinger\.env
$values = Get-Content $envFile |
  Where-Object { $_ -match '^\s*[^#\s][^=]*=' } |
  ConvertFrom-StringData
$VPS_IP = $values.VPS_IP
$VPS_SSH_USER = $values.VPS_SSH_USER
$VPS_SSH_KEY_PATH = $values.VPS_SSH_KEY_PATH
```

## Conexão

```bash
ssh -i "$VPS_SSH_KEY_PATH" "$VPS_SSH_USER@$VPS_IP"
```

Valide identidade antes de alterar qualquer coisa:

```bash
ssh -i "$VPS_SSH_KEY_PATH" "$VPS_SSH_USER@$VPS_IP" \
  'hostname; uptime; docker ps; docker compose ls; systemctl --failed'
```

## Administração

Acesso administrativo amplo está disponível via usuário SSH e `sudo`, conforme permissões da VPS. Não presuma diretório, container ou unit: descubra o serviço antes de agir.

```bash
ssh -i "$VPS_SSH_KEY_PATH" "$VPS_SSH_USER@$VPS_IP" 'pwd; docker ps --format "table {{.Names}}\t{{.Status}}"; systemctl list-units --type=service --state=running --no-pager'
```

- Docker: inspecione compose, volumes e saúde antes de `up`, restart ou migração.
- systemd: confira `systemctl status <unit>` e `journalctl -u <unit> -n 100 --no-pager`.
- PM2: confira `pm2 list` e `pm2 logs --lines 100`.
- Logs: nunca reproduza tokens, cookies, senhas, URLs de banco ou chaves.
- Deploy/rollback: identifique release, faça backup, execute uma mudança e valide healthcheck.

## Topologia conhecida

O runtime de produção documentado do Synkroo é Cloudflare Workers/OpenNext. Não há diretório de serviço VPS confirmado nos documentos do projeto; faça descoberta remota antes de deploy ou restart.

## Operações destrutivas

Exigem confirmação explícita e backup verificado: `rm -rf`, drop/reset de banco, remoção de volume, rotação de credencial, alteração de firewall e encerramento amplo de processos.

SSH por chave é obrigatório; senha não é necessária.
