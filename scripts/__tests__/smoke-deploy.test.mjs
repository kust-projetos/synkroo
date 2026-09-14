import test from "node:test";
import assert from "node:assert/strict";
import {
  isCliInvocation,
  printHelp,
  redactSmokeOutput,
  resolveBaseUrl,
  runSmokeDeploy,
  smokeFailed,
} from "../smoke-deploy.mjs";

function mockFetch(handler) {
  return async (url, init = {}) => handler(new URL(url), init);
}

function okJson(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

function allGreenFetch() {
  return mockFetch((url) => {
    switch (url.pathname) {
      case "/api/health":
        return okJson({ status: "healthy", checks: {} });
      case "/api/auth/session":
        return okJson({ authenticated: false, user: null, profile: null });
      case "/api/health/db":
        return okJson({ status: "complete" });
      case "/api/patients":
        return new Response("{}", { status: 401 });
      default:
        return new Response("{}", { status: 404 });
    }
  });
}

test("todos os checks verdes resultam em ok (exit 0)", async () => {
  const results = await runSmokeDeploy("https://deploy.example.test", {
    fetchImpl: allGreenFetch(),
  });
  assert.deepEqual(
    results.map(({ check, ok }) => ({ check, ok })),
    [
      { check: "liveness", ok: true },
      { check: "auth-pipeline", ok: true },
      { check: "db", ok: true },
      { check: "middleware", ok: true },
      { check: "workers", ok: true },
    ],
  );
  assert.equal(smokeFailed(results), false);
  for (const entry of results) {
    assert.equal(typeof entry.ms, "number");
  }
});

test("um check falho marca falha (exit 1)", async () => {
  const results = await runSmokeDeploy("https://deploy.example.test", {
    fetchImpl: mockFetch((url) => {
      if (url.pathname === "/api/health/db")
        return okJson({ status: "incomplete" });
      if (url.pathname === "/api/health")
        return okJson({ status: "healthy" });
      if (url.pathname === "/api/auth/session")
        return okJson({ authenticated: false });
      if (url.pathname === "/api/patients")
        return new Response("{}", { status: 401 });
      return new Response("{}", { status: 404 });
    }),
  });
  const db = results.find(({ check }) => check === "db");
  assert.equal(db.ok, false);
  assert.equal(db.status, 200);
  assert.equal(smokeFailed(results), true);
});

test("timeout de request vira falha registrada", async () => {
  const timeoutError = new DOMException(
    "The operation was aborted",
    "TimeoutError",
  );
  const results = await runSmokeDeploy("https://deploy.example.test", {
    fetchImpl: mockFetch((url) => {
      if (url.pathname === "/api/health") throw timeoutError;
      if (url.pathname === "/api/auth/session")
        return okJson({ authenticated: false });
      if (url.pathname === "/api/health/db")
        return okJson({ status: "complete" });
      return new Response("{}", { status: 401 });
    }),
  });
  const liveness = results.find(({ check }) => check === "liveness");
  assert.equal(liveness.ok, false);
  assert.equal(liveness.error, "TimeoutError");
  assert.equal(smokeFailed(results), true);
});

test("workers sem endpoint publico e skipped sem falhar", async () => {
  const results = await runSmokeDeploy("https://deploy.example.test", {
    fetchImpl: allGreenFetch(),
  });
  const workers = results.find(({ check }) => check === "workers");
  assert.equal(workers.ok, true);
  assert.equal(workers.skipped, true);
  assert.match(workers.reason, /service bindings/i);
});

test("middleware aceita 401 e 403, rejeita 200", async () => {
  for (const status of [401, 403]) {
    const results = await runSmokeDeploy("https://deploy.example.test", {
      fetchImpl: mockFetch((url) => {
        if (url.pathname === "/api/patients")
          return new Response("{}", { status });
        if (url.pathname === "/api/health/db")
          return okJson({ status: "complete" });
        if (url.pathname === "/api/health")
          return okJson({ status: "healthy" });
        return okJson({ authenticated: false });
      }),
    });
    assert.equal(
      results.find(({ check }) => check === "middleware").ok,
      true,
    );
  }
  const leaked = await runSmokeDeploy("https://deploy.example.test", {
    fetchImpl: mockFetch((url) => {
      if (url.pathname === "/api/patients")
        return okJson([{ id: "1" }], 200);
      if (url.pathname === "/api/health/db")
        return okJson({ status: "complete" });
      if (url.pathname === "/api/health") return okJson({ status: "healthy" });
      return okJson({ authenticated: false });
    }),
  });
  assert.equal(
    leaked.find(({ check }) => check === "middleware").ok,
    false,
  );
});

test("saida nunca expoe segredos", () => {
  assert.deepEqual(
    redactSmokeOutput({
      check: "db",
      ok: true,
      cookie: "session=abc",
      nested: { token: "x", status: 200 },
    }),
    {
      check: "db",
      ok: true,
      cookie: "[REDACTED]",
      nested: { token: "[REDACTED]", status: 200 },
    },
  );
});

test("resolveBaseUrl aceita env, posicional e flag; --help imprime uso", () => {
  assert.equal(
    resolveBaseUrl([], { SMOKE_BASE_URL: "https://a.test" }).baseUrl,
    "https://a.test",
  );
  assert.equal(resolveBaseUrl(["https://b.test"], {}).baseUrl, "https://b.test");
  assert.equal(
    resolveBaseUrl(["--base-url=https://c.test"], {}).baseUrl,
    "https://c.test",
  );
  assert.equal(resolveBaseUrl(["--help"], {}).help, true);
  assert.throws(() => resolveBaseUrl([], {}), /SMOKE_BASE_URL/);
  assert.match(printHelp(), /SMOKE_BASE_URL/);
});

test("cli entrypoint reconhece paths Windows e POSIX", () => {
  assert.equal(
    isCliInvocation(
      "file:///D:/projetos/synkroo/scripts/smoke-deploy.mjs",
      "D:\\projetos\\synkroo\\scripts\\smoke-deploy.mjs",
    ),
    true,
  );
  assert.equal(
    isCliInvocation(
      "file:///workspace/scripts/smoke-deploy.mjs",
      "/workspace/scripts/smoke-deploy.mjs",
    ),
    true,
  );
  assert.equal(
    isCliInvocation(
      "file:///workspace/scripts/smoke-deploy.mjs",
      "/workspace/scripts/other.mjs",
    ),
    false,
  );
});
