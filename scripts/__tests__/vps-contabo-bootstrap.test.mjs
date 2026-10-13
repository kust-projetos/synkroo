/**
 * Contrato do bootstrap do host Contabo (runbook §4 "Contabo foundation",
 * docs/runbooks/2026-10-05-hostinger-to-contabo-and-waha-migration.md).
 *
 * Local-only: asserções estáticas sobre o fonte do .sh. O script NUNCA é
 * executado contra um host real; quando `bash` está disponível o teste apenas
 * o executa em dry-run (sem --yes) e com argumento inválido, o que não toca
 * em nenhum sistema (dry-run não muta, exit≠0 aborta na validação de entrada).
 *
 * O critério de aceite da fase é não travar o operador para fora do host,
 * então a ordem dos comandos é asserida, não apenas a presença deles.
 */

import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, describe, test } from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const scriptPath = resolve(root, 'ops', 'vps', 'contabo', 'bootstrap.sh');
const src = readFileSync(scriptPath, 'utf8');

/**
 * Caminho consumível pelo `bash` do host de teste. Em Windows o bash pode ser o
 * do Git Bash ou o Linux via WSL, e nenhum dos dois entende um caminho absoluto
 * no estilo `D:\...` como argv. Um caminho relativo ao cwd funciona nos dois.
 */
const bashScriptArg = (() => {
  const rel = relative(process.cwd(), scriptPath);
  if (!rel || rel.startsWith('..')) return scriptPath;
  return rel.split(sep).join('/');
})();

/** Remove linhas de comentário para que os greps de segurança não casem com prosa. */
const code = src
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('#'))
  .join('\n');

const bashProbe = spawnSync('bash', ['-n', bashScriptArg], {
  encoding: 'utf8',
  cwd: root,
  timeout: 30_000,
});
const bashAvailable = !bashProbe.error && bashProbe.status === 0;

const runScript = (args) =>
  spawnSync('bash', [bashScriptArg, ...args], {
    encoding: 'utf8',
    cwd: root,
    timeout: 60_000,
  });

/**
 * Arquivo de chave temporário, escrito NO REPO para que o caminho relativo
 * funcione tanto no Git Bash/MSYS quanto no launcher do WSL (que não enxerga
 * um `C:\...` nem um tmpdir em outro drive). Removido no `after`.
 */
const tempKeyFile = resolve(root, '.bootstrap-test-only.pub');
after(() => rmSync(tempKeyFile, { force: true }));

describe('bootstrap.sh — hardening de SSH (§4)', () => {
  test('drop-in de hardening existe com as diretivas aprovadas', () => {
    assert.match(src, /\/etc\/ssh\/sshd_config\.d\/00-synkroo-hardening\.conf/);
    // Prefixo 00- é o que garante precedência: o sshd usa o PRIMEIRO valor
    // obtido e a imagem Ubuntu pode trazer 50-cloud-init.conf com senha.
    assert.ok(
      !/sshd_config\.d\/60-synkroo-hardening\.conf/.test(src),
      'drop-in 60- seria ignorado se 50-cloud-init.conf definir PasswordAuthentication',
    );
    // O conteúdo do drop-in vive numa string multi-linha: precisa vir de `src`.
    assert.match(src, /^PasswordAuthentication no$/m);
    assert.match(src, /^KbdInteractiveAuthentication no$/m);
    assert.match(src, /^PermitRootLogin prohibit-password$/m);
    // Última linha da string do drop-in: pode não ter \n final.
    assert.match(src, /\nX11Forwarding no(?:'|\n|$)/);
  });

  test('sshd -t valida a configuração ANTES do reload', () => {
    const validateIdx = code.indexOf('sshd -t');
    const reloadIdx = code.indexOf('systemctl reload ssh');
    assert.ok(validateIdx > 0, 'sshd -t ausente');
    assert.ok(reloadIdx > 0, 'systemctl reload ssh ausente');
    assert.ok(
      validateIdx < reloadIdx,
      `reload em ${reloadIdx} antes da validação em ${validateIdx}: drop-in inválido derrubaria o sshd`,
    );
  });

  test('a política EFETIVA é conferida com sshd -T DEPOIS do reload', () => {
    // `sshd -T` (não `sshd -t`): só o efetivo revela qual drop-in venceu.
    const reloadIdx = code.indexOf('systemctl reload ssh');
    const effectiveIdx = code.indexOf('sshd -T');
    assert.ok(reloadIdx > 0, 'systemctl reload ssh ausente');
    assert.ok(effectiveIdx > 0, 'sshd -T ausente');
    assert.ok(
      reloadIdx < effectiveIdx,
      `sshd -T em ${effectiveIdx} antes do reload em ${reloadIdx}: o efetivo precisa ser pós-reload`,
    );
    // As três diretivas da política são conferidas.
    for (const key of ['passwordauthentication', 'kbdinteractiveauthentication', 'permitrootlogin']) {
      assert.match(
        code,
        new RegExp(`${key} (no|no|prohibit-password)`),
        `sshd -T não confere ${key}`,
      );
    }
  });

  test('sshd -T falha fechado (exit != 0) quando não bate ou nem roda', () => {
    // Caminho 1: `sshd -T` sem saída (sem root, sem host key) → aborta.
    assert.match(code, /if \[ -z "\$SSHD_EFFECTIVE" \]/);
    // Caminho 2: valor efetivo diferente do pretendido → aborta.
    assert.match(code, /if \[ -z "\$sshd_ok" \]/);
    assert.match(code, /exit 3/);
    // `prohibit-password` e `without-password` são o mesmo valor para o sshd
    // (PERMIT_NO_PASSWD); versões do OpenSSH formatam `sshd -T` com um ou
    // outro alias. O gate precisa aceitar os dois — um gate só do literal
    // `prohibit-password` abortaria uma config CORRETA.
    assert.match(code, /permitrootlogin prohibit-password\|without-password/);
    assert.match(code, /sshd_v in "\$\{sshd_variants\[@\]\}"/);
    // Mensagem com os valores efetivos + a causa provável (precedência).
    assert.match(code, /Valores efetivos agora/);
    assert.match(code, /primeiro valor obtido/i);
  });

  test('não há reload de ssh sem validação prévia (fail-closed)', () => {
    // O reload precisa estar guardado por APPLY/condicional, nunca incondicional.
    const reloadLine = code.split('\n').find((line) => line.includes('systemctl reload ssh'));
    assert.ok(reloadLine, 'reload de ssh não encontrado');
    assert.match(reloadLine, /run systemctl reload ssh/);
  });

  test('não faz sed/permissão destrutiva em sshd_config principal', () => {
    // O hardening deve ser aditivo (drop-in), não um sed no arquivo global.
    assert.ok(!/sed\s+-i[^\n]*\/etc\/ssh\/sshd_config$/.test(code), 'não deve reescrever sshd_config global');
  });
});

describe('bootstrap.sh — firewall default-deny (§4 Host + Rede)', () => {
  test('política default-deny aplicada', () => {
    assert.match(code, /ufw default deny incoming/);
    assert.match(code, /ufw default allow outgoing/);
  });

  test('ufw allow OpenSSH vem ANTES de ufw --force enable', () => {
    const allowIdx = code.indexOf('ufw allow OpenSSH');
    const enableIdx = code.indexOf('ufw --force enable');
    assert.ok(allowIdx > 0, 'ufw allow OpenSSH ausente');
    assert.ok(enableIdx > 0, 'ufw --force enable ausente');
    assert.ok(
      allowIdx < enableIdx,
      `ufw habilitado em ${enableIdx} antes da regra OpenSSH em ${allowIdx}: lockout imediato`,
    );
  });

  test('PostgreSQL/5432 NUNCA recebe regra pública', () => {
    // Runbook §4 Rede: Hyperdrive não justifica expor o banco globalmente.
    assert.ok(
      !/ufw\s+allow[^\n]*(5432|postgres)/i.test(code),
      'existe ufw allow para PostgreSQL/5432 — viola runbook §4 Rede',
    );
  });

  test('fase ufw é gateada por --apply-firewall', () => {
    assert.match(code, /APPLY_FIREWALL/);
    assert.match(code, /--apply-firewall exige --yes/);
    assert.match(code, /PULADA: --apply-firewall não informado/);
  });
});

describe('bootstrap.sh — chaves e segredos', () => {
  test('valida cada linha do --ssh-key-file com ssh-keygen -l -f', () => {
    assert.match(code, /ssh-keygen -l -f "\$KEY_TMP"/);
    assert.match(code, /linha inválida em --ssh-key-file/);
  });

  test('--yes sem --ssh-key-file aborta antes de qualquer mutação', () => {
    assert.match(
      code,
      /if \[ "\$APPLY" -eq 1 \] && \[ -z "\$SSH_KEY_FILE" \]; then\n\s+die 'modo --yes exige --ssh-key-file/,
      'chave ausente em modo aplicar deveria abortar',
    );
    // A guarda precisa vir ANTES da checagem de root: senão um teste (ou um
    // operador sem privilégio) veria "exige root" no lugar da causa real.
    const keyGate = code.indexOf('[ -z "$SSH_KEY_FILE" ]');
    const rootGate = code.indexOf('[ "$(id -u)" -ne 0 ]');
    assert.ok(keyGate > 0 && rootGate > 0);
    assert.ok(keyGate < rootGate, 'a exigência da chave precisa preceder a checagem de root');
    // E antes de toda fase (fase 1 é a primeira que muta).
    assert.ok(keyGate < code.indexOf('FASE 1'), 'a exigência da chave precisa vir antes das fases');
  });

  test('--yes com arquivo de chave só com comentários aborta (zero chaves utilizáveis)', () => {
    assert.match(
      code,
      /if \[ "\$APPLY" -eq 1 \] && \[ "\$KEY_COUNT" -eq 0 \]; then\n\s+die 'modo --yes exige ao menos uma chave pública VÁLIDA/,
      'arquivo sem chave válida deveria abortar em modo aplicar',
    );
    // KEY_COUNT precisa contar só linhas aceitas por ssh-keygen (comentários
    // são pulados com `case ... \#*`), e ficar inicializado mesmo sem arquivo.
    assert.match(code, /case "\$key_line" in \\#\*\) continue ;; esac/);
    assert.match(code, /KEY_COUNT=0/);
    // Dry-run continua tolerante: o aviso é o comportamento documentado.
    assert.match(code, /ATENÇÃO: --ssh-key-file ausente/);
  });

  test('authorized_keys é append-only (nunca sobrescrito)', () => {
    assert.match(code, /grep -qxF "\$key_line" "\$AUTH_KEYS"/);
    // A escrita tem de ser append (>>), nunca truncante/redirecionante.
    const writes = code.split('\n').filter((line) => /authorized_keys|AUTH_KEYS/.test(line) && />"?\$?\{?AUTH_KEYS/.test(line));
    assert.ok(writes.length > 0, 'escrita em authorized_keys não encontrada');
    for (const line of writes) {
      if (!line.includes('>>')) {
        assert.ok(
          /install\s+-m\s+0600[^\n]*\/dev\/null[^\n]*AUTH_KEYS/.test(line),
          `escrita possivelmente destrutiva em authorized_keys: ${line.trim()}`,
        );
      }
    }
  });

  test('nenhuma chave privada é lida nem impressa', () => {
    assert.ok(!/BEGIN [A-Z ]*PRIVATE KEY/.test(src), 'referência a chave privada no script');
    // O log de chave mostra fingerprint (saída do ssh-keygen), não a linha crua.
    assert.match(code, /KEY_FP:-desconhecida/);
  });

  test('sem pipe de curl para shell (curl | bash)', () => {
    assert.ok(
      !/curl[^\n|]*\|\s*(?:sudo\s+)?(?:ba|z|k)?sh\b/.test(code),
      'encontrado curl piped para shell — usar download para arquivo + verificação',
    );
    // A chave GPG do Docker deve ser baixada para arquivo, não executada.
    assert.match(code, /curl -fsSL https:\/\/download\.docker\.com\/linux\/ubuntu\/gpg -o \/etc\/apt\/keyrings\/docker\.asc/);
  });
});

describe('bootstrap.sh — fases e diretórios (§4 Host)', () => {
  test('set -euo pipefail habilitado', () => {
    assert.match(src, /^set -euo pipefail$/m);
  });

  test('dry-run é o default e sai 0 sem --yes', () => {
    assert.match(code, /if \[ "\$APPLY" -eq 1 \] && \[ "\$\(id -u\)" -ne 0 \]/);
    assert.match(code, /NENHUMA mudança será feita/);
    // Toda mutação passa por run/run_sh, que só executam com APPLY=1.
    assert.match(code, /if \[ "\$APPLY" -eq 1 \]; then\n\s+"\$@"/);
    assert.match(code, /if \[ "\$APPLY" -eq 1 \]; then\n\s+sh -c "\$1"/);
  });

  test('cria /opt/synkroo e /var/backups/synkroo com dono e modo restrito', () => {
    assert.match(code, /APP_DIR='\/opt\/synkroo'/);
    assert.match(code, /BACKUP_DIR='\/var\/backups\/synkroo'/);
    assert.match(code, /install -d -o "\$ADMIN_USER" -g "\$ADMIN_USER" -m 0750 "\$target_dir"/);
  });

  test('timezone e NTP configurados', () => {
    assert.match(code, /timedatectl set-timezone "\$TIMEZONE"/);
    assert.match(code, /timedatectl set-ntp true/);
  });

  test('Docker via repositório oficial com keyring GPG', () => {
    assert.match(code, /install -m 0755 -d \/etc\/apt\/keyrings/);
    assert.match(code, /signed-by=\/etc\/apt\/keyrings\/docker\.asc/);
    assert.match(code, /https:\/\/download\.docker\.com\/linux\/ubuntu/);
    assert.match(code, /docker-ce docker-ce-cli containerd\.io docker-buildx-plugin docker-compose-plugin/);
    assert.match(code, /CODENAME="\$\{VERSION_CODENAME:-bookworm\}"/);
  });

  test('fail2ban NÃO é instalado (fora do runbook §4)', () => {
    assert.ok(!/fail2ban/.test(code), 'fail2ban não está no runbook §4');
  });

  test('pacotes base limitados ao conjunto do runbook', () => {
    assert.match(code, /apt-get -y install ca-certificates curl gnupg ufw/);
  });

  test('usuário operacional recebe sudo e grupo docker com aviso de risco', () => {
    assert.match(code, /usermod -aG sudo "\$ADMIN_USER"/);
    assert.match(code, /usermod -aG docker "\$ADMIN_USER"/);
    assert.match(code, /grupo docker equivale a root/);
  });

  test('fases printadas com prefixo [bootstrap] e log em arquivo no modo aplicar', () => {
    assert.match(code, /printf '\[bootstrap\] %s\\n' "\$\*"/);
    assert.match(code, /LOG_FILE='\/var\/log\/synkroo-bootstrap\.log'/);
    assert.match(code, />>"\$LOG_FILE"/);
  });

  test('pendências de §4 ficam como TODO explícito no resumo', () => {
    assert.match(src, /\[TODO\] logs\/monitoramento/);
    assert.match(src, /\[TODO\] backup off-host/);
    assert.match(src, /\[TODO\] espaço e inode/);
    assert.match(src, /df -i/);
    assert.match(src, /runbook §5/);
  });

  test('aviso de lockout: validação de login por chave em segundo terminal', () => {
    assert.match(src, /SEGUNDO TERMINAL/);
    assert.match(src, /Conselho do painel Contabo|console do painel Contabo/i);
  });
});

describe('bootstrap.sh — execução (somente quando bash existe)', () => {
  test('bash -n: sintaxe válida', { skip: bashAvailable ? false : 'bash indisponível' }, () => {
    assert.equal(bashProbe.status, 0, bashProbe.stderr);
  });

  test('sem --yes: dry-run imprime o plano e sai 0', { skip: bashAvailable ? false : 'bash indisponível' }, () => {
    const r = runScript([]);
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    assert.equal(r.status, 0, out);
    assert.match(out, /NENHUMA mudança será feita/);
    // Plano completo: todas as fases de §4 aparecem.
    for (const phase of [
      'FASE 1',
      'FASE 2',
      'FASE 3',
      'FASE 4',
      'FASE 5',
      'FASE 6',
      'FASE 7',
    ]) {
      assert.ok(out.includes(phase), `plano sem ${phase}: ${out}`);
    }
    // Dry-run imprime o plano, não executa. O que precisa ser provado é a
    // ORDEM no plano: validar antes de recarregar, e liberar SSH antes do ufw.
    const planValidate = out.indexOf('sshd -t');
    const planReload = out.indexOf('systemctl reload ssh');
    assert.ok(planValidate > 0 && planReload > 0, `plano sem hardening de ssh: ${out}`);
    assert.ok(planValidate < planReload, 'reload aparece antes da validação no plano');
    // Sem o gate, a fase ufw é declarada PULADA e seus comandos não aparecem.
    assert.ok(
      out.includes('PULADA: --apply-firewall não informado'),
      'fase ufw deveria estar pulada sem --apply-firewall',
    );
    assert.ok(!out.includes('ufw --force enable'), 'plano não deve conter ufw enable sem o gate');
    assert.ok(!out.includes('ufw default deny incoming'), 'plano não deve conter política ufw sem o gate');
  });

  test('--ssh-key-file inexistente aborta com exit != 0', { skip: bashAvailable ? false : 'bash indisponível' }, () => {
    const r = runScript(['--ssh-key-file', '/tmp/nao-existe-synkroo-bootstrap.pub']);
    assert.notEqual(r.status, 0, 'deveria abortar');
    assert.match(`${r.stderr ?? ''}`, /--ssh-key-file não encontrado/);
  });

  test('--apply-firewall sem --yes é rejeitado', { skip: bashAvailable ? false : 'bash indisponível' }, () => {
    const r = runScript(['--apply-firewall']);
    assert.notEqual(r.status, 0, 'gate deveria rejeitar dry-run + firewall');
    assert.match(`${r.stderr ?? ''}`, /--apply-firewall exige --yes/);
  });

  test('--yes sem --ssh-key-file sai 2 sem tocar em nenhuma fase', { skip: bashAvailable ? false : 'bash indisponível' }, () => {
    const r = runScript(['--yes']);
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    assert.equal(r.status, 2, out);
    assert.match(`${r.stderr ?? ''}`, /--yes exige --ssh-key-file/);
    // Nenhum marcador de mutação pode aparecer: o abort precede a fase 1.
    for (const marker of ['FASE 1', 'exec:', 'sh:', 'apt-get', '=== início (modo aplicar) ===']) {
      assert.ok(!out.includes(marker), `abort imprimiu marcador de mutação "${marker}": ${out}`);
    }
  });

  test('--yes com chave só comentada sai 2 (nenhuma chave utilizável)', { skip: bashAvailable ? false : 'bash indisponível' }, () => {
    writeFileSync(
      tempKeyFile,
      ['# isto e um comentario, nao uma chave', '', '# ssh-ed25519 AAAA nao-e-chave-comentada', ''].join('\n'),
    );
    const r = runScript(['--yes', '--ssh-key-file', relative(root, tempKeyFile).split(sep).join('/')]);
    const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    assert.equal(r.status, 2, out);
    assert.match(`${r.stderr ?? ''}`, /--yes exige ao menos uma chave pública VÁLIDA/);
    assert.ok(!out.includes('FASE 1'), `abort imprimiu marcador de mutação: ${out}`);
  });

  test('--help sai 0 sem exigir root', { skip: bashAvailable ? false : 'bash indisponível' }, () => {
    const r = runScript(['--help']);
    assert.equal(r.status, 0, `${r.stdout ?? ''}${r.stderr ?? ''}`);
    assert.match(`${r.stdout ?? ''}`, /--admin-user/);
  });
});
