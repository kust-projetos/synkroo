import test from "node:test";
import assert from "node:assert/strict";
import { redactSmokeOutput, runSmoke } from "../smoke-staging.mjs";

test("redacts credentials and patient identifiers", () => {
  assert.deepEqual(
    redactSmokeOutput({
      token: "secret",
      email: "patient@example.com",
      ok: true,
    }),
    {
      token: "[REDACTED]",
      email: "[REDACTED]",
      ok: true,
    },
  );
});

test("runs the complete privacy-safe staging contract with authenticated checks", async () => {
  const requests = [];
  const fetchImpl = async (url, init = {}) => {
    requests.push({ url, init });
    const parsed = new URL(url);
    const authenticated = init.headers?.cookie === "session=synthetic";
    const status =
      parsed.pathname === "/api/health" || parsed.pathname === "/widget.js"
        ? 200
        : parsed.pathname === "/api/messages/inbound"
          ? 403
          : parsed.pathname === "/api/auth/session"
            ? authenticated
              ? 200
              : 200
            : parsed.pathname === "/api/auth/switch-clinic"
              ? authenticated
                ? 200
                : 401
              : parsed.pathname === "/api/appointments"
                ? authenticated
                  ? 200
                  : 401
                : parsed.pathname === "/dashboard" ||
                    parsed.pathname === "/api/internal/readiness"
                  ? authenticated
                    ? 200
                    : 401
                  : 404;
    const body =
      parsed.pathname === "/api/appointments"
        ? JSON.stringify({
            appointments: [
              { clinicId: "00000000-0000-0000-0000-000000000001" },
            ],
            pagination: { page: 1, limit: 50, total: 1, totalPages: 1 },
          })
        : "{}";
    return new Response(body, { status });
  };

  const results = await runSmoke("https://staging.example.test", {
    authCookie: "session=synthetic",
    clinicId: "00000000-0000-0000-0000-000000000001",
    fetchImpl,
  });

  assert.deepEqual(
    results.map(({ name, status }) => ({ name, status })),
    [
      { name: "liveness", status: "pass" },
      { name: "invalid-auth", status: "pass" },
      { name: "valid-auth", status: "pass" },
      { name: "session", status: "pass" },
      { name: "switch-clinic", status: "pass" },
      { name: "route-protection", status: "pass" },
      { name: "agenda-tenant-scope", status: "pass" },
      { name: "invalid-webhook", status: "pass" },
      { name: "protected-readiness", status: "pass" },
      { name: "assets", status: "pass" },
    ],
  );
  assert.equal(
    requests.filter(({ init }) => init.headers?.cookie === "session=synthetic")
      .length,
    4,
  );
  const protectedPaths = new Set([
    "/api/appointments",
    "/dashboard",
    "/api/internal/readiness",
  ]);
  for (const request of requests.filter(({ url }) =>
    protectedPaths.has(new URL(url).pathname),
  )) {
    assert.equal(request.init.redirect, "manual");
  }
});

test("serializes staging checks to avoid cold-start database races", async () => {
  let active = 0;
  let maxActive = 0;
  const fetchImpl = async (url) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active -= 1;
    const path = new URL(url).pathname;
    const status =
      path === "/api/health" || path === "/widget.js"
        ? 200
        : path === "/api/messages/inbound"
          ? 403
          : path === "/api/appointments" ||
              path === "/api/internal/readiness" ||
              path === "/dashboard"
            ? 307
            : 200;
    return new Response("{}", { status });
  };

  await runSmoke("https://staging.example.test", { fetchImpl });
  assert.equal(maxActive, 1);
});

test("blocks authenticated staging checks when synthetic credentials are absent", async () => {
  const results = await runSmoke("https://staging.example.test", {
    fetchImpl: async () => new Response("{}", { status: 200 }),
  });

  assert.deepEqual(
    results
      .filter(({ status }) => status === "blocked")
      .map(({ name }) => name),
    ["valid-auth", "session", "switch-clinic", "agenda-tenant-scope"],
  );
  assert.equal(
    results.some(
      ({ name, status }) =>
        [
          "valid-auth",
          "session",
          "switch-clinic",
          "agenda-tenant-scope",
        ].includes(name) && status === "pass",
    ),
    false,
  );
});
