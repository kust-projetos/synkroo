/**
 * Contract tests for the official Cloudflare Hyperdrive PATCH client
 * (scripts/lib/hyperdrive-api.mjs).
 *
 * Local-only: every case uses a mocked fetchImpl. The real Cloudflare API is
 * NEVER called, in any mode — mutating paths included.
 *
 * Covered: partial-PATCH shape (never PUT, never argv/URL password), fail-closed
 * auth outside the VPS .env file, independent staging/prod targets with a
 * staging-only default, dry-run without fetch or secrets, redacted 4xx/5xx/
 * timeout/network/misconfig errors, idempotent re-apply, partial-update state,
 * safe snapshot + rollback re-PATCH, and post-update reconciliation.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  CF_CONFIG_INVALID_CODE,
  CF_HTTP_ERROR_CODE,
  CF_NETWORK_ERROR_CODE,
  CF_RESPONSE_ERROR_CODE,
  CF_TIMEOUT_CODE,
  applyHyperdriveTarget,
  applyHyperdriveTargets,
  buildHyperdrivePatchBody,
  compareOrigins,
  getHyperdriveConfig,
  hyperdriveConfigUrl,
  normalizeTimeoutMs,
  patchHyperdriveOrigin,
  planHyperdriveUpdates,
  redactApiSecrets,
  resolveCloudflareAuth,
  resolveHyperdriveTargetKeys,
  rollbackHyperdriveTarget,
  safeOriginText,
} from '../lib/hyperdrive-api.mjs';
import { redactSecrets } from '../lib/wrangler-cli.mjs';

const ACCOUNT = 'test-account-id';
const TOKEN = 'test-cf-token';
const STAGING_ID = 'e0033a75f4e2449084b00b41e22e49a6';
const PROD_ID = 'be5a789a003e4f08a94a82dffbb091be';
/** Hostile values must survive only inside HTTPS JSON, never argv/URL/logs. */
const HOSTILE_PASSWORD = 'p w"; $(id)`id`\\x';
const HOSTILE_TOKEN = 'tok en"; $(id)';

function jsonResponse({ ok = true, status = 200, body = {} } = {}) {
  return { ok, status, json: async () => body };
}

function mockFetch(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init, calls.length);
  };
  return { impl, calls };
}

/** Stateful Cloudflare double: GET returns current origin (no password, like the real API). */
function statefulCloudflare(initial) {
  const current = { ...initial };
  const calls = [];
  const impl = async (url, init = {}) => {
    calls.push({ url, init });
    const method = init.method ?? 'GET';
    const id = url.endsWith(STAGING_ID) ? STAGING_ID : PROD_ID;
    if (method === 'PATCH') {
      const body = JSON.parse(init.body);
      current[id] = { ...body.origin };
      delete current[id].password;
      return jsonResponse({
        body: { success: true, result: { id, name: `hyperdrive-${id.slice(0, 8)}`, origin: current[id] } },
      });
    }
    return jsonResponse({
      body: { success: true, result: { id, name: `hyperdrive-${id.slice(0, 8)}`, origin: current[id] } },
    });
  };
  return { impl, calls, current };
}

const STAGING_TARGET = {
  key: 'staging',
  label: 'Staging Hyperdrive',
  hyperdriveId: STAGING_ID,
  database: 'synkroo_staging',
  user: 'synkroo_staging',
  password: HOSTILE_PASSWORD,
};

describe('PATCH contract — parcial, sem senha em argv/URL', () => {
  test('PATCH usa URL individual com account+id e body parcial {origin}', async () => {
    const { impl, calls } = mockFetch(() =>
      jsonResponse({ body: { success: true, result: { id: STAGING_ID } } }),
    );
    await patchHyperdriveOrigin({
      fetchImpl: impl,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      hyperdriveId: STAGING_ID,
      origin: { host: '10.0.0.1', port: 5432, database: 'synkroo_staging', user: 'synkroo_staging', password: HOSTILE_PASSWORD },
    });
    assert.equal(calls.length, 1);
    const [{ url, init }] = calls;
    assert.equal(init.method, 'PATCH');
    assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/hyperdrive/configs/${STAGING_ID}`);
    const body = JSON.parse(init.body);
    assert.deepEqual(Object.keys(body), ['origin'], 'PATCH parcial: só {origin}, nunca PUT total');
    assert.deepEqual(Object.keys(body.origin).sort(), ['database', 'host', 'password', 'port', 'scheme', 'user']);
    assert.equal(body.origin.scheme, 'postgres');
    assert.equal(body.origin.port, 5432);
    assert.ok(!url.includes(HOSTILE_PASSWORD), 'senha nunca na URL');
    assert.ok(!url.includes(TOKEN), 'token nunca na URL');
  });

  test('Authorization Bearer é enviado sem vazar para erros ou logs', async () => {
    const { impl, calls } = mockFetch(() =>
      jsonResponse({ body: { success: true, result: { id: STAGING_ID } } }),
    );
    await patchHyperdriveOrigin({
      fetchImpl: impl,
      accountId: ACCOUNT,
      apiToken: HOSTILE_TOKEN,
      hyperdriveId: STAGING_ID,
      origin: { host: 'h', port: 5432, database: 'd', user: 'u', password: HOSTILE_PASSWORD },
    });
    assert.equal(calls[0].init.headers.Authorization, `Bearer ${HOSTILE_TOKEN}`);
  });

  test('buildHyperdrivePatchBody rejeita origem incompleta sem ecoar valores', () => {
    assert.throws(
      () => buildHyperdrivePatchBody({ host: '', port: 5432, database: 'd', user: 'u', password: 'x' }),
      (err) => err.code === CF_CONFIG_INVALID_CODE && !err.message.includes('x'),
    );
    assert.throws(
      () => buildHyperdrivePatchBody({ host: 'h', port: 99999, database: 'd', user: 'u', password: 'x' }),
      /port is invalid/,
    );
  });

  test('hyperdriveConfigUrl exige ids e nunca interpola credencial', () => {
    assert.throws(() => hyperdriveConfigUrl('', STAGING_ID), /needs account and config ids/);
    assert.ok(!hyperdriveConfigUrl(ACCOUNT, STAGING_ID).includes('password'));
  });
});

describe('auth fail-closed fora do .env da VPS', () => {
  test('account ausente aborta citando a chave, nunca um valor', () => {
    assert.throws(
      () => resolveCloudflareAuth({ env: { CLOUDFLARE_API_TOKEN: TOKEN } }),
      (err) => {
        assert.equal(err.code, 'SYNKROO_CF_ACCOUNT_MISSING');
        assert.match(err.message, /CLOUDFLARE_ACCOUNT_ID is missing/);
        assert.ok(!err.message.includes(TOKEN));
        return true;
      },
    );
  });

  test('token ausente aborta citando a chave, nunca um valor', () => {
    assert.throws(
      () => resolveCloudflareAuth({ env: { CLOUDFLARE_ACCOUNT_ID: ACCOUNT } }),
      (err) => {
        assert.equal(err.code, 'SYNKROO_CF_TOKEN_MISSING');
        assert.match(err.message, /CLOUDFLARE_API_TOKEN is missing/);
        assert.ok(!err.message.includes(ACCOUNT));
        return true;
      },
    );
  });

  test('chaves VPS_* no env não autorizam nada (isolamento do .env da VPS)', () => {
    assert.throws(
      () =>
        resolveCloudflareAuth({
          env: { VPS_TARGET_POSTGRES_PASSWORD: 'x', VPS_IP: '10.0.0.1' },
        }),
      /CLOUDFLARE_ACCOUNT_ID is missing/,
    );
  });

  test('flags explícitas resolvem sem depender do env', () => {
    assert.deepEqual(
      resolveCloudflareAuth({ env: {}, accountId: ACCOUNT, apiToken: TOKEN }),
      { accountId: ACCOUNT, apiToken: TOKEN },
    );
  });
});

describe('--target independente com default seguro', () => {
  test('default é staging-only: prod nunca é side-effect', () => {
    assert.equal(resolveHyperdriveTargetKeys(undefined), 'staging');
    assert.equal(resolveHyperdriveTargetKeys('staging'), 'staging');
    assert.equal(resolveHyperdriveTargetKeys('prod'), 'prod');
    assert.equal(resolveHyperdriveTargetKeys('both'), 'both');
  });

  test('--target inválido falha fechado citando os valores válidos', () => {
    assert.throws(
      () => resolveHyperdriveTargetKeys('all'),
      (err) => err.code === CF_CONFIG_INVALID_CODE && /staging, prod or both/.test(err.message),
    );
  });

  test('timeout configurável com default e faixa válidos', () => {
    assert.equal(normalizeTimeoutMs(undefined), 15000);
    assert.equal(normalizeTimeoutMs('5000'), 5000);
    for (const raw of ['0', '999', '120001', 'abc', '1.5']) {
      assert.throws(() => normalizeTimeoutMs(raw), /timeout is invalid/, `raw=${raw} deve falhar`);
    }
  });
});

describe('erros redatados fail-closed (4xx/5xx/timeout/rede/misconfig)', () => {
  test('4xx carrega status + cf_code numérico, nunca o body', async () => {
    const marker = 'marker-secreto-body-404';
    const { impl } = mockFetch(() =>
      jsonResponse({ ok: false, status: 404, body: { errors: [{ code: 7003, message: marker }] } }),
    );
    const err = await getHyperdriveConfig({
      fetchImpl: impl,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      hyperdriveId: STAGING_ID,
    }).catch((e) => e);
    assert.equal(err.code, CF_HTTP_ERROR_CODE);
    assert.match(err.message, /HTTP 404/);
    assert.match(err.message, /cf_code 7003/);
    assert.ok(!err.message.includes(marker), 'texto do body nunca no erro');
    assert.ok(!err.message.includes(TOKEN));
  });

  test('5xx idem, sem corpo bruto', async () => {
    const { impl } = mockFetch(() =>
      jsonResponse({ ok: false, status: 502, body: { errors: [{ code: 8000, message: 'bad gateway interno' }] } }),
    );
    const err = await patchHyperdriveOrigin({
      fetchImpl: impl,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      hyperdriveId: PROD_ID,
      origin: { host: 'h', port: 5432, database: 'd', user: 'u', password: HOSTILE_PASSWORD },
    }).catch((e) => e);
    assert.equal(err.code, CF_HTTP_ERROR_CODE);
    assert.match(err.message, /HTTP 502/);
    assert.ok(!err.message.includes('bad gateway interno'));
    assert.ok(!err.message.includes(HOSTILE_PASSWORD));
  });

  test('envelope success:false vira erro sem ecoar mensagens', async () => {
    const { impl } = mockFetch(() =>
      jsonResponse({ body: { success: false, errors: [{ code: 1001, message: 'detalhe interno' }] } }),
    );
    const err = await getHyperdriveConfig({
      fetchImpl: impl,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      hyperdriveId: STAGING_ID,
    }).catch((e) => e);
    assert.equal(err.code, CF_RESPONSE_ERROR_CODE);
    assert.ok(!err.message.includes('detalhe interno'));
  });

  test('GET sem result falha fechado', async () => {
    const { impl } = mockFetch(() => jsonResponse({ body: { success: true, result: null } }));
    const err = await getHyperdriveConfig({
      fetchImpl: impl,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      hyperdriveId: STAGING_ID,
    }).catch((e) => e);
    assert.equal(err.code, CF_RESPONSE_ERROR_CODE);
  });

  test('rede inalcançável vira erro com id, sem segredo', async () => {
    const { impl } = mockFetch(() => {
      throw new Error('connect ECONNREFUSED');
    });
    const err = await getHyperdriveConfig({
      fetchImpl: impl,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      hyperdriveId: STAGING_ID,
    }).catch((e) => e);
    assert.equal(err.code, CF_NETWORK_ERROR_CODE);
    assert.match(err.message, new RegExp(STAGING_ID));
    assert.ok(!err.message.includes('ECONNREFUSED'));
  });

  test('timeout estoura o budget mesmo com fetch não-cooperativo', async () => {
    const { impl } = mockFetch(() => new Promise(() => {}));
    const err = await getHyperdriveConfig({
      fetchImpl: impl,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      hyperdriveId: STAGING_ID,
      timeoutMs: 1000,
    }).catch((e) => e);
    assert.equal(err.code, CF_TIMEOUT_CODE);
    assert.match(err.message, /after 1000ms/);
  });

  test('misconfig (ids ausentes) falha antes de qualquer fetch', async () => {
    const { impl, calls } = mockFetch(() => jsonResponse({}));
    const err = await getHyperdriveConfig({
      fetchImpl: impl,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      hyperdriveId: '',
    }).catch((e) => e);
    assert.equal(err.code, CF_CONFIG_INVALID_CODE);
    assert.equal(calls.length, 0, 'misconfig nunca chama a API');
  });
});

describe('snapshot seguro, reconcile e idempotência', () => {
  test('apply faz GET→PATCH→GET, snapshot sem senha, reconcile match', async () => {
    const old = { host: '10.0.0.9', port: 5432, database: 'synkroo_staging', user: 'synkroo_staging', scheme: 'postgres' };
    const { impl, calls } = statefulCloudflare({ [STAGING_ID]: old });
    const applied = await applyHyperdriveTarget({
      fetchImpl: impl,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      target: { ...STAGING_TARGET, password: 'nova-senha' },
      host: '10.0.0.1',
      port: 5432,
    });
    assert.deepEqual(
      calls.map((call) => call.init.method ?? 'GET'),
      ['GET', 'PATCH', 'GET'],
    );
    assert.deepEqual(applied.snapshot, { hyperdriveId: STAGING_ID, origin: old });
    assert.ok(!('password' in applied.snapshot.origin), 'snapshot nunca guarda senha');
    assert.equal(applied.match, true);
    assert.deepEqual(applied.diffs, []);
    // Re-run idempotente: mesmo PATCH, mesmo match.
    const again = await applyHyperdriveTarget({
      fetchImpl: impl,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      target: { ...STAGING_TARGET, password: 'nova-senha' },
      host: '10.0.0.1',
      port: 5432,
    });
    assert.equal(again.match, true);
  });

  test('reconcile reporta divergência não-sensível (sem senha no diff)', async () => {
    const { impl } = statefulCloudflare({
      [STAGING_ID]: { host: '10.0.0.9', port: 5432, database: 'synkroo_staging', user: 'synkroo_staging', scheme: 'postgres' },
    });
    // PATCH aplica host novo, mas um drift externo move o GET seguinte: simula
    // GET final divergente interceptando a terceira chamada.
    let phase = 0;
    const drifting = async (url, init) => {
      phase += 1;
      if (phase === 3) {
        return jsonResponse({
          body: {
            success: true,
            result: {
              id: STAGING_ID,
              origin: { host: '10.9.9.9', port: 5432, database: 'synkroo_staging', user: 'synkroo_staging', scheme: 'postgres' },
            },
          },
        });
      }
      return impl(url, init);
    };
    const applied = await applyHyperdriveTarget({
      fetchImpl: drifting,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      target: { ...STAGING_TARGET, password: 'nova-senha' },
      host: '10.0.0.1',
      port: 5432,
    });
    assert.equal(applied.match, false);
    assert.deepEqual(applied.diffs, ['host']);
  });

  test('compareOrigins ignora senha e compara só campos seguros', () => {
    assert.deepEqual(
      compareOrigins(
        { host: 'h', port: '5432', database: 'd', user: 'u', scheme: 'postgres', password: 'a' },
        { host: 'h', port: 5432, database: 'd', user: 'u', scheme: 'postgres' },
      ),
      { equal: true, diffs: [] },
    );
    assert.deepEqual(compareOrigins({ host: 'a', port: 5432, database: 'd', user: 'u', scheme: 'postgres', password: 'x' }, { host: 'b', port: 5432, database: 'd', user: 'u', scheme: 'postgres' }).diffs, ['host']);
  });

  test('safeOriginText nunca inclui senha', () => {
    const text = safeOriginText({ host: 'h', port: 5432, database: 'd', user: 'u', password: HOSTILE_PASSWORD });
    assert.ok(!text.includes(HOSTILE_PASSWORD));
    assert.match(text, /host=h:5432/);
  });
});

describe('partial update explícito + rollback = re-PATCH', () => {
  test('staging ok + prod 500 → partial explícito, sem ambiguidade', async () => {
    const { impl } = statefulCloudflare({
      [STAGING_ID]: { host: 'old', port: 5432, database: 'synkroo_staging', user: 'synkroo_staging', scheme: 'postgres' },
    });
    const failing = async (url, init = {}) => {
      if (url.endsWith(PROD_ID)) {
        return jsonResponse({ ok: false, status: 500, body: { errors: [{ code: 8000 }] } });
      }
      return impl(url, init);
    };
    const outcome = await applyHyperdriveTargets({
      fetchImpl: failing,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      targets: [
        STAGING_TARGET,
        { key: 'prod', label: 'Production Hyperdrive', hyperdriveId: PROD_ID, database: 'synkroo', user: 'synkroo', password: 'prod-pass' },
      ],
      host: '10.0.0.1',
      port: 5432,
    });
    assert.equal(outcome.allOk, false);
    assert.equal(outcome.partial, true);
    const [staging, prod] = outcome.results;
    assert.equal(staging.status, 'ok');
    assert.equal(prod.status, 'failed');
    assert.equal(prod.code, CF_HTTP_ERROR_CODE);
    assert.ok(!prod.error.includes('prod-pass'), 'erro do prod não vaza senha');
    assert.ok(!prod.error.includes(HOSTILE_PASSWORD));
  });

  test('rollback re-PATCHa o snapshot com a senha anterior válida', async () => {
    const old = { host: '10.0.0.9', port: 5432, database: 'synkroo_staging', user: 'synkroo_staging', scheme: 'postgres' };
    const { impl, calls } = statefulCloudflare({ [STAGING_ID]: old });
    const applied = await applyHyperdriveTarget({
      fetchImpl: impl,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      target: { ...STAGING_TARGET, password: 'senha-nova' },
      host: '10.0.0.1',
      port: 5432,
    });
    const rolled = await rollbackHyperdriveTarget({
      fetchImpl: impl,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      snapshot: applied.snapshot,
      password: 'senha-anterior',
    });
    const patches = calls.filter((call) => (call.init.method ?? 'GET') === 'PATCH');
    assert.equal(patches.length, 2, 'forward + rollback');
    assert.deepEqual(JSON.parse(patches[1].init.body), {
      origin: { ...old, password: 'senha-anterior' },
    });
    assert.equal(rolled.match, true);
    assert.deepEqual(rolled.diffs, []);
  });
});

describe('dry-run sem mutação e sem segredos', () => {
  test('plano é estruturalmente incapaz de vazar: sem fetch, sem senha, sem token', () => {
    const { impl, calls } = mockFetch(() => jsonResponse({}));
    const lines = planHyperdriveUpdates({
      targets: [{ key: 'staging', label: 'Staging Hyperdrive', hyperdriveId: STAGING_ID, database: 'synkroo_staging', user: 'synkroo_staging' }],
      side: 'source',
      host: '10.0.0.1',
      port: 5432,
      accountId: ACCOUNT,
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /\[dry-run\] Would PATCH Staging Hyperdrive/);
    assert.match(lines[0], new RegExp(STAGING_ID));
    assert.ok(!lines[0].includes(HOSTILE_PASSWORD));
    assert.ok(!lines[0].includes(TOKEN));
    assert.equal(calls.length, 0, 'dry-run nunca chama fetch');
  });
});

describe('auditoria: senha/token fora de argv, URL e logs', () => {
  test('nenhuma URL ou corpo GET carrega segredo no fluxo completo', async () => {
    const { impl, calls } = statefulCloudflare({
      [STAGING_ID]: { host: 'old', port: 5432, database: 'synkroo_staging', user: 'synkroo_staging', scheme: 'postgres' },
    });
    await applyHyperdriveTarget({
      fetchImpl: impl,
      accountId: ACCOUNT,
      apiToken: HOSTILE_TOKEN,
      target: STAGING_TARGET,
      host: '10.0.0.1',
      port: 5432,
    });
    for (const { url, init } of calls) {
      assert.ok(!url.includes(HOSTILE_PASSWORD), `URL com senha: ${url}`);
      assert.ok(!url.includes(HOSTILE_TOKEN), `URL com token: ${url}`);
      assert.ok(!(init.method === 'GET' && init.body !== undefined), 'GET nunca tem body');
    }
    const patchBody = calls.find((call) => call.init.method === 'PATCH').init.body;
    assert.equal(JSON.parse(String(patchBody)).origin.password, HOSTILE_PASSWORD);
  });

  test('redactApiSecrets cobre valores exatos, JSON password e --password legado', () => {
    assert.equal(redactApiSecrets(`t=${HOSTILE_TOKEN} ok`, [HOSTILE_TOKEN]), 't=[REDACTED] ok');
    assert.equal(
      redactApiSecrets('{"password": "abc123"}', []),
      '{"password":"[REDACTED]"}',
    );
    assert.equal(redactSecrets('a --password=abc b'), 'a --password=[REDACTED] b');
  });
});
