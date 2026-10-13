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
  CF_ACCESS_MISSING_CODE,
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
  resolveAccessCredentials,
  resolveCloudflareAuth,
  resolveHyperdriveOrigin,
  resolveHyperdriveTargetKeys,
  rollbackHyperdriveTarget,
  safeOriginText,
  toSafeOrigin,
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

  test('account-id explícito resolve com token do env; token nunca via opção/argv', () => {
    assert.deepEqual(
      resolveCloudflareAuth({ env: { CLOUDFLARE_API_TOKEN: TOKEN }, accountId: ACCOUNT }),
      { accountId: ACCOUNT, apiToken: TOKEN },
    );
    // Uma opção apiToken (ex-caminho do argv) não autoriza nada sozinha: o
    // token é exigido do env mesmo quando a opção é passada.
    assert.throws(
      () =>
        resolveCloudflareAuth({
          env: { CLOUDFLARE_ACCOUNT_ID: ACCOUNT },
          apiToken: 'tok-via-opcao',
        }),
      (err) => {
        assert.equal(err.code, 'SYNKROO_CF_TOKEN_MISSING');
        assert.match(err.message, /CLOUDFLARE_API_TOKEN is missing/);
        assert.match(err.message, /never accepted via argv/);
        return true;
      },
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

  test('body pendente (json() nunca resolve) estoura o timeout', async () => {
    const { impl } = mockFetch(() => ({ ok: true, status: 200, json: () => new Promise(() => {}) }));
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
    assert.deepEqual(applied.snapshot, { hyperdriveId: STAGING_ID, origin: { ...old, access: false } });
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

  test('divergência de reconcile reprova o agregador: status failed + allOk false', async () => {
    const { impl } = statefulCloudflare({
      [STAGING_ID]: { host: '10.0.0.9', port: 5432, database: 'synkroo_staging', user: 'synkroo_staging', scheme: 'postgres' },
    });
    // Mesmo drift do teste unitário de reconcile, mas observado pelo
    // agregador: o GET final diverge do PATCH aplicado.
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
    const outcome = await applyHyperdriveTargets({
      fetchImpl: drifting,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      targets: [{ ...STAGING_TARGET, password: 'nova-senha' }],
      host: '10.0.0.1',
      port: 5432,
    });
    assert.equal(outcome.allOk, false, 'divergência nunca é sucesso');
    assert.equal(outcome.partial, false);
    assert.equal(outcome.results.length, 1);
    const [only] = outcome.results;
    assert.equal(only.status, 'failed', 'divergência tem status não-ok');
    assert.equal(only.code, CF_RESPONSE_ERROR_CODE);
    assert.match(only.error, /Reconciliation failed/);
    assert.match(only.error, /roll back/);
    assert.deepEqual(only.diffs, ['host']);
    assert.ok(!only.error.includes('nova-senha'), 'erro de reconcile não vaza senha');
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

  test('redactApiSecrets cobre JSON access_client_secret e valores exatos do par Access', () => {
    const cid = 'cid-hostil-123';
    const csec = 'csec-hostil-456';
    assert.equal(
      redactApiSecrets(`{"access_client_secret": "${csec}"}`, []),
      '{"access_client_secret":"[REDACTED]"}',
    );
    assert.equal(redactApiSecrets(`id=${cid} sec=${csec}`, [cid, csec]), 'id=[REDACTED] sec=[REDACTED]');
  });
});

describe('origem Access-protegida (túnel D4)', () => {
  const ACCESS_ID = 'access-client-id-teste';
  const ACCESS_SECRET = 'access-client-secret-teste';

  test('PATCH sem access é idêntico ao legado (sem chaves access_*)', () => {
    const body = buildHyperdrivePatchBody({ host: 'h', port: 5432, database: 'd', user: 'u', password: 'x' });
    assert.deepEqual(Object.keys(body.origin).sort(), ['database', 'host', 'password', 'port', 'scheme', 'user']);
  });

  test('PATCH com access inclui o par dentro de {origin} e OMITE port (cf_code 2007)', async () => {
    const { impl, calls } = mockFetch(() =>
      jsonResponse({ body: { success: true, result: { id: STAGING_ID } } }),
    );
    await patchHyperdriveOrigin({
      fetchImpl: impl,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      hyperdriveId: STAGING_ID,
      origin: {
        host: 'stg-pg.synkroo.com.br',
        port: 5432,
        database: 'd',
        user: 'u',
        password: 'x',
        access_client_id: ACCESS_ID,
        access_client_secret: ACCESS_SECRET,
      },
    });
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.origin.access_client_id, ACCESS_ID);
    assert.equal(body.origin.access_client_secret, ACCESS_SECRET);
    assert.deepEqual(Object.keys(body), ['origin']);
    assert.ok(!('port' in body.origin), 'access + port explícita = 400 cf_code 2007: chave port omitida');
    assert.deepEqual(Object.keys(body.origin).sort(), ['access_client_id', 'access_client_secret', 'database', 'host', 'password', 'scheme', 'user']);
  });

  test('buildHyperdrivePatchBody com access omite port mesmo quando port é passada (side PG_PORT ignorada)', () => {
    const body = buildHyperdrivePatchBody({
      host: 'stg-pg.synkroo.com.br',
      port: 5432,
      database: 'd',
      user: 'u',
      password: 'x',
      access_client_id: ACCESS_ID,
      access_client_secret: ACCESS_SECRET,
    });
    assert.ok(!('port' in body.origin), 'port nunca viaja com access');
    // Sem port alguma: access também constrói sem exigir port.
    const noPort = buildHyperdrivePatchBody({
      host: 'stg-pg.synkroo.com.br',
      database: 'd',
      user: 'u',
      password: 'x',
      access_client_id: ACCESS_ID,
      access_client_secret: ACCESS_SECRET,
    });
    assert.ok(!('port' in noPort.origin));
  });

  test('buildHyperdrivePatchBody legado exige port (ausente ou inválida falha fechado)', () => {
    assert.throws(
      () => buildHyperdrivePatchBody({ host: 'h', database: 'd', user: 'u', password: 'x' }),
      (err) => err.code === CF_CONFIG_INVALID_CODE && /port is invalid/.test(err.message),
    );
    assert.throws(
      () => buildHyperdrivePatchBody({ host: 'h', port: 0, database: 'd', user: 'u', password: 'x' }),
      /port is invalid/,
    );
  });

  test('par Access pela metade falha fechado sem ecoar valores', () => {
    assert.throws(
      () =>
        buildHyperdrivePatchBody({
          host: 'h',
          port: 5432,
          database: 'd',
          user: 'u',
          password: 'x',
          access_client_id: ACCESS_ID,
        }),
      (err) => err.code === CF_CONFIG_INVALID_CODE && !err.message.includes(ACCESS_ID),
    );
    assert.throws(
      () =>
        buildHyperdrivePatchBody({
          host: 'h',
          port: 5432,
          database: 'd',
          user: 'u',
          password: 'x',
          access_client_secret: ACCESS_SECRET,
        }),
      (err) => err.code === CF_CONFIG_INVALID_CODE && !err.message.includes(ACCESS_SECRET),
    );
  });

  test('resolveAccessCredentials: ok via env; fail-closed nomeando vars sem valores', () => {
    assert.deepEqual(
      resolveAccessCredentials({
        env: { CLOUDFLARE_ACCESS_CLIENT_ID: ACCESS_ID, CLOUDFLARE_ACCESS_CLIENT_SECRET: ACCESS_SECRET },
      }),
      { clientId: ACCESS_ID, clientSecret: ACCESS_SECRET },
    );
    for (const env of [
      {},
      { CLOUDFLARE_ACCESS_CLIENT_ID: ACCESS_ID },
      { CLOUDFLARE_ACCESS_CLIENT_SECRET: ACCESS_SECRET },
    ]) {
      assert.throws(
        () => resolveAccessCredentials({ env }),
        (err) => {
          assert.equal(err.code, CF_ACCESS_MISSING_CODE);
          assert.match(err.message, /CLOUDFLARE_ACCESS_CLIENT_ID/);
          assert.match(err.message, /CLOUDFLARE_ACCESS_CLIENT_SECRET/);
          assert.ok(!err.message.includes(ACCESS_ID));
          assert.ok(!err.message.includes(ACCESS_SECRET));
          return true;
        },
      );
    }
  });

  test('resolveAccessCredentials: chaves VPS_* não autorizam nada', () => {
    assert.throws(
      () =>
        resolveAccessCredentials({
          env: { VPS_TARGET_IP: '10.0.0.1', CLOUDFLARE_ACCESS_CLIENT_ID: ACCESS_ID },
        }),
      (err) => err.code === CF_ACCESS_MISSING_CODE,
    );
  });

  test('resolveHyperdriveOrigin: --access exige --origin-host; sem --access é o IP do side', () => {
    assert.deepEqual(
      resolveHyperdriveOrigin({ access: true, originHost: 'stg-pg.synkroo.com.br', sideHost: '10.0.0.1' }),
      { host: 'stg-pg.synkroo.com.br', access: true },
    );
    assert.throws(
      () => resolveHyperdriveOrigin({ access: true, originHost: '', sideHost: '10.0.0.1' }),
      (err) => err.code === CF_CONFIG_INVALID_CODE && /--origin-host is required together with --access/.test(err.message),
    );
    assert.throws(
      () => resolveHyperdriveOrigin({ access: false, originHost: 'stg-pg.synkroo.com.br', sideHost: '10.0.0.1' }),
      (err) => err.code === CF_CONFIG_INVALID_CODE && /--origin-host requires --access/.test(err.message),
    );
    assert.deepEqual(
      resolveHyperdriveOrigin({ access: false, sideHost: '10.0.0.1' }),
      { host: '10.0.0.1', access: false },
    );
  });

  test('toSafeOrigin/safeOriginText indicam access=true/false sem valores', () => {
    assert.equal(toSafeOrigin({ host: 'h', port: 5432, database: 'd', user: 'u' }).access, false);
    const withAccess = toSafeOrigin({
      host: 'h',
      port: 5432,
      database: 'd',
      user: 'u',
      access_client_id: ACCESS_ID,
    });
    assert.equal(withAccess.access, true);
    assert.ok(!('access_client_id' in withAccess), 'id nunca no snapshot seguro');
    assert.ok(!('access_client_secret' in withAccess));
    const text = safeOriginText({ host: 'h', port: 5432, database: 'd', user: 'u', access_client_id: ACCESS_ID, access_client_secret: ACCESS_SECRET });
    assert.match(text, /access=true/);
    assert.ok(!text.includes(ACCESS_ID));
    assert.ok(!text.includes(ACCESS_SECRET));
    assert.match(safeOriginText({ host: 'h', port: 5432, database: 'd', user: 'u' }), /access=false/);
  });

  test('safeOriginText com access omite :port e nunca inclui segredo', () => {
    const text = safeOriginText({ host: 'stg-pg.synkroo.com.br', database: 'd', user: 'u', access_client_id: ACCESS_ID, access_client_secret: ACCESS_SECRET });
    assert.match(text, /access=true/);
    assert.ok(!text.includes(':5432'), 'porta omitida no texto com access');
    assert.ok(!text.includes(ACCESS_ID));
    assert.ok(!text.includes(ACCESS_SECRET));
    assert.match(text, /host=stg-pg\.synkroo\.com\.br db=/);
  });

  test('compareOrigins com access ignora port (API omite/default)', () => {
    // want leva a PG_PORT do side; a API omite a porta no GET observado.
    assert.deepEqual(
      compareOrigins(
        { host: 'stg-pg.synkroo.com.br', port: 5432, database: 'd', user: 'u', scheme: 'postgres', access_client_id: 'a', access_client_secret: 's' },
        { host: 'stg-pg.synkroo.com.br', database: 'd', user: 'u', scheme: 'postgres', access: true },
      ),
      { equal: true, diffs: [] },
    );
    // Portas divergentes também reconciliam com access.
    assert.deepEqual(
      compareOrigins(
        { host: 'h', port: 5432, database: 'd', user: 'u', scheme: 'postgres', access_client_id: 'a', access_client_secret: 's' },
        { host: 'h', port: 5433, database: 'd', user: 'u', scheme: 'postgres', access: true },
      ),
      { equal: true, diffs: [] },
    );
    // Sem access a porta continua comparada como antes.
    const legacy = compareOrigins(
      { host: 'h', port: 5432, database: 'd', user: 'u', scheme: 'postgres', password: 'x' },
      { host: 'h', port: 5433, database: 'd', user: 'u', scheme: 'postgres' },
    );
    assert.equal(legacy.equal, false);
    assert.deepEqual(legacy.diffs, ['port']);
  });

  test('compareOrigins compara o flag access; secret nunca entra no diff', () => {
    assert.deepEqual(
      compareOrigins(
        { host: 'h', port: 5432, database: 'd', user: 'u', scheme: 'postgres', access_client_id: 'a' },
        { host: 'h', port: 5432, database: 'd', user: 'u', scheme: 'postgres', access: true },
      ),
      { equal: true, diffs: [] },
    );
    const diverged = compareOrigins(
      { host: 'h', port: 5432, database: 'd', user: 'u', scheme: 'postgres', access_client_id: 'a' },
      { host: 'h', port: 5432, database: 'd', user: 'u', scheme: 'postgres' },
    );
    assert.equal(diverged.equal, false);
    assert.deepEqual(diverged.diffs, ['access']);
  });

  test('dry-run com access mostra o flag sem segredos e sem fetch', () => {
    const { calls } = mockFetch(() => jsonResponse({}));
    const lines = planHyperdriveUpdates({
      targets: [
        {
          key: 'staging',
          label: 'Staging Hyperdrive',
          hyperdriveId: STAGING_ID,
          database: 'synkroo_staging',
          user: 'synkroo_staging',
          accessClientId: ACCESS_ID,
          accessClientSecret: ACCESS_SECRET,
        },
      ],
      side: 'source',
      host: 'stg-pg.synkroo.com.br',
      port: 5432,
      accountId: ACCOUNT,
      access: true,
    });
    assert.equal(lines.length, 1);
    assert.match(lines[0], /access=true/);
    assert.ok(!lines[0].includes(ACCESS_ID));
    assert.ok(!lines[0].includes(ACCESS_SECRET));
    assert.ok(!lines[0].includes(':5432'), 'dry-run access omite a porta (regra cf_code 2007)');
    assert.match(lines[0], /host=stg-pg\.synkroo\.com\.br db=/);
    assert.equal(calls.length, 0);
    const legacy = planHyperdriveUpdates({
      targets: [{ key: 'staging', label: 'Staging Hyperdrive', hyperdriveId: STAGING_ID, database: 'synkroo_staging', user: 'synkroo_staging' }],
      side: 'source',
      host: '10.0.0.1',
      port: 5432,
      accountId: ACCOUNT,
    });
    assert.match(legacy[0], /access=false/);
    assert.match(legacy[0], /host=10\.0\.0\.1:5432/, 'dry-run legado mantém :port');
  });

  test('apply com access: PATCH leva o par; reconcile casa o flag', async () => {
    const old = { host: 'old', port: 5432, database: 'synkroo_staging', user: 'synkroo_staging', scheme: 'postgres' };
    const { impl, calls } = statefulCloudflare({ [STAGING_ID]: old });
    const applied = await applyHyperdriveTarget({
      fetchImpl: impl,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      target: { ...STAGING_TARGET, accessClientId: ACCESS_ID, accessClientSecret: ACCESS_SECRET },
      host: 'stg-pg.synkroo.com.br',
      port: 5432,
    });
    const patchBody = JSON.parse(calls.find((call) => call.init.method === 'PATCH').init.body);
    assert.equal(patchBody.origin.access_client_id, ACCESS_ID);
    assert.equal(patchBody.origin.access_client_secret, ACCESS_SECRET);
    assert.ok(!('port' in patchBody.origin), 'PATCH access omite port (cf_code 2007)');
    assert.equal(applied.match, true);
    assert.deepEqual(applied.diffs, []);
    assert.equal(applied.snapshot.origin.access, false);
  });

  test('reconcile access: flag divergente reprova sem vazar segredo', async () => {
    const { impl } = statefulCloudflare({
      [STAGING_ID]: { host: 'old', port: 5432, database: 'synkroo_staging', user: 'synkroo_staging', scheme: 'postgres' },
    });
    let phase = 0;
    const drifting = async (url, init) => {
      phase += 1;
      if (phase === 3) {
        return jsonResponse({
          body: {
            success: true,
            result: {
              id: STAGING_ID,
              origin: { host: 'stg-pg.synkroo.com.br', port: 5432, database: 'synkroo_staging', user: 'synkroo_staging', scheme: 'postgres' },
            },
          },
        });
      }
      return impl(url, init);
    };
    const outcome = await applyHyperdriveTargets({
      fetchImpl: drifting,
      accountId: ACCOUNT,
      apiToken: TOKEN,
      targets: [{ ...STAGING_TARGET, accessClientId: ACCESS_ID, accessClientSecret: ACCESS_SECRET }],
      host: 'stg-pg.synkroo.com.br',
      port: 5432,
    });
    assert.equal(outcome.allOk, false);
    assert.deepEqual(outcome.results[0].diffs, ['access']);
    assert.ok(!outcome.results[0].error.includes(ACCESS_SECRET));
  });

  test('rollback access=true sem o par falha fechado antes de qualquer PATCH', async () => {
    const accessSnapshot = {
      hyperdriveId: STAGING_ID,
      origin: { host: 'stg-pg.synkroo.com.br', database: 'd', user: 'u', scheme: 'postgres', access: true },
    };
    const { impl, calls } = mockFetch(() => jsonResponse({ body: { success: true, result: {} } }));
    await assert.rejects(
      () => rollbackHyperdriveTarget({ fetchImpl: impl, accountId: ACCOUNT, apiToken: TOKEN, snapshot: accessSnapshot, password: 'x' }),
      (err) => {
        assert.equal(err.code, CF_ACCESS_MISSING_CODE);
        assert.match(err.message, /CLOUDFLARE_ACCESS_CLIENT_ID/);
        assert.match(err.message, /CLOUDFLARE_ACCESS_CLIENT_SECRET/);
        assert.ok(!err.message.includes(ACCESS_ID));
        assert.ok(!err.message.includes(ACCESS_SECRET));
        return true;
      },
    );
    assert.equal(calls.length, 0, 'fail-closed não emite PATCH');
  });

  test('rollback access=true com par incompleto falha fechado sem ecoar valores', async () => {
    const accessSnapshot = {
      hyperdriveId: STAGING_ID,
      origin: { host: 'stg-pg.synkroo.com.br', database: 'd', user: 'u', scheme: 'postgres', access: true },
    };
    for (const access of [{ clientId: ACCESS_ID }, { clientSecret: ACCESS_SECRET }]) {
      const { impl, calls } = mockFetch(() => jsonResponse({ body: { success: true, result: {} } }));
      await assert.rejects(
        () => rollbackHyperdriveTarget({ fetchImpl: impl, accountId: ACCOUNT, apiToken: TOKEN, snapshot: accessSnapshot, password: 'x', access }),
        (err) => {
          assert.equal(err.code, CF_ACCESS_MISSING_CODE);
          assert.match(err.message, /CLOUDFLARE_ACCESS_CLIENT/);
          assert.ok(!err.message.includes(ACCESS_ID));
          assert.ok(!err.message.includes(ACCESS_SECRET));
          return true;
        },
      );
      assert.equal(calls.length, 0, 'fail-closed não emite PATCH');
    }
  });

  test('rollback access=true com par completo: PATCH leva o par e omite port (ausente ou default)', async () => {
    for (const snapshotOrigin of [
      { host: 'stg-pg.synkroo.com.br', database: 'd', user: 'u', scheme: 'postgres', access: true },
      { host: 'stg-pg.synkroo.com.br', port: 5432, database: 'd', user: 'u', scheme: 'postgres', access: true },
    ]) {
      const { impl, calls } = statefulCloudflare({
        [STAGING_ID]: { host: '10.0.0.1', port: 5432, database: 'd', user: 'u', scheme: 'postgres' },
      });
      const rolled = await rollbackHyperdriveTarget({
        fetchImpl: impl,
        accountId: ACCOUNT,
        apiToken: TOKEN,
        snapshot: { hyperdriveId: STAGING_ID, origin: snapshotOrigin },
        password: 'senha-anterior',
        access: { clientId: ACCESS_ID, clientSecret: ACCESS_SECRET },
      });
      const patchBody = JSON.parse(calls.find((call) => call.init.method === 'PATCH').init.body);
      assert.equal(patchBody.origin.access_client_id, ACCESS_ID);
      assert.equal(patchBody.origin.access_client_secret, ACCESS_SECRET);
      assert.ok(!('port' in patchBody.origin), 'rollback access ignora port (cf_code 2007)');
      assert.equal(rolled.match, true);
      assert.deepEqual(rolled.diffs, []);
    }
  });

  test('rollback legado (access falsy) com par Access é rejeitado fail-closed', async () => {
    const legacySnapshot = {
      hyperdriveId: STAGING_ID,
      origin: { host: '10.0.0.9', port: 5432, database: 'd', user: 'u', scheme: 'postgres', access: false },
    };
    const { impl, calls } = mockFetch(() => jsonResponse({ body: { success: true, result: {} } }));
    await assert.rejects(
      () => rollbackHyperdriveTarget({
        fetchImpl: impl,
        accountId: ACCOUNT,
        apiToken: TOKEN,
        snapshot: legacySnapshot,
        password: 'x',
        access: { clientId: ACCESS_ID, clientSecret: ACCESS_SECRET },
      }),
      (err) => {
        assert.equal(err.code, CF_CONFIG_INVALID_CODE);
        assert.ok(!err.message.includes(ACCESS_ID));
        assert.ok(!err.message.includes(ACCESS_SECRET));
        return true;
      },
    );
    assert.equal(calls.length, 0, 'fail-closed não emite PATCH');
  });
});
