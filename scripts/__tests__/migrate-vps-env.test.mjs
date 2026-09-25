import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';

const root = resolve(import.meta.dirname, '..', '..');
const scriptSrc = readFileSync(resolve(root, 'scripts', 'migrate-vps.ts'), 'utf8');

// Extrai a função REAL do script (falha alto se ausente) e avalia sem efeitos
// colaterais: parseVpsEnvContent é pura e main() nunca é executada aqui.
// (A extração conta chaves; a função não usa chaves dentro de strings/regex.)
function loadParserFromSource() {
  const marker = 'export function parseVpsEnvContent';
  const start = scriptSrc.indexOf(marker);
  assert.ok(start >= 0, 'migrate-vps.ts deve exportar parseVpsEnvContent');
  const bodyStart = scriptSrc.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let i = bodyStart; i < scriptSrc.length; i += 1) {
    if (scriptSrc[i] === '{') depth += 1;
    else if (scriptSrc[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }
  assert.ok(end > bodyStart, 'corpo de parseVpsEnvContent não localizado');
  const fnSrc = scriptSrc
    .slice(start, end)
    .replace('export function', 'function')
    .replace('(content: string): Record<string, string>', '(content)')
    .replaceAll(': Record<string, string>', '')
    .replaceAll(': string', '');
  // eslint-disable-next-line no-new-func
  return new Function(`return (${fnSrc});`)();
}

const parse = loadParserFromSource();

const LF_LINES = [
  '# comentario de cabecalho',
  '',
  'VPS_IP=10.0.0.1',
  'VPS_PG_PORT=5432',
  'VPS_POSTGRES_PASSWORD="segredo-producao"',
  "VPS_STAGING_PASSWORD='segredo-staging'",
  '  SPACED_KEY  =  com espacos  ',
  '',
];
const EXPECTED = {
  VPS_IP: '10.0.0.1',
  VPS_PG_PORT: '5432',
  VPS_POSTGRES_PASSWORD: 'segredo-producao',
  VPS_STAGING_PASSWORD: 'segredo-staging',
  SPACED_KEY: 'com espacos',
};

test('parseia conteudo LF (baseline)', () => {
  assert.deepEqual(parse(LF_LINES.join('\n')), EXPECTED);
});

test('parseia conteudo CRLF identico ao LF (regressao: VPS_IP is missing)', () => {
  const crlf = LF_LINES.join('\r\n');
  assert.deepEqual(parse(crlf), EXPECTED);
  assert.deepEqual(parse(crlf), parse(LF_LINES.join('\n')));
});

test('nenhuma chave/valor carrega \\r', () => {
  for (const content of [LF_LINES.join('\n'), LF_LINES.join('\r\n')]) {
    for (const [k, v] of Object.entries(parse(content))) {
      assert.ok(!k.includes('\r'), `chave com \\r: ${JSON.stringify(k)}`);
      assert.ok(!v.includes('\r'), `valor com \\r em ${k}: ${JSON.stringify(v)}`);
    }
  }
});

test('fonte tolera CRLF no split (sem depender de trim incidental)', () => {
  assert.ok(
    scriptSrc.includes('split(/\\r?\\n/)'),
    'migrate-vps.ts deve dividir as linhas com split(/\\r?\\n/)',
  );
});
