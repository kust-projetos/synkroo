import assert from "node:assert/strict";
import test from "node:test";
import {
  dispatchScheduledJobs,
  runDueJobs,
  selectDueJobs,
} from "../lib/cron-schedule.mjs";

const at0900 = new Date(Date.UTC(2026, 8, 26, 9, 0, 0));
const at0930 = new Date(Date.UTC(2026, 8, 26, 9, 30, 0));
const at0907 = new Date(Date.UTC(2026, 8, 26, 9, 7, 0));
const at1000 = new Date(Date.UTC(2026, 8, 26, 10, 0, 0));

function names(jobs) {
  return jobs.map((job) => job.name).sort();
}

test("default vazio seleciona nenhum job além do outbox", () => {
  assert.deepEqual(selectDueJobs("", at0900), []);
  assert.deepEqual(selectDueJobs(undefined, at0900), []);
  assert.deepEqual(selectDueJobs("  , ", at0900), []);
});

test("CSV com 2 nomes seleciona os 2 quando devidos no horário", () => {
  assert.deepEqual(
    names(selectDueJobs("reminders,cleanup", at1000)),
    ["cleanup", "reminders"],
  );
});

test("cadência filtra jobs não devidos no minuto", () => {
  assert.deepEqual(
    names(selectDueJobs("reminders,cleanup", at0907)),
    [],
  );
  assert.deepEqual(
    names(selectDueJobs("reminders,cleanup", at0930)),
    ["reminders"],
  );
  assert.deepEqual(
    names(selectDueJobs("reminders,cleanup,hot-leads", at1000)),
    ["cleanup", "hot-leads", "reminders"],
  );
});

test("jobs diários disparam só no horário UTC exato", () => {
  assert.deepEqual(
    names(selectDueJobs("followups,financeiro-collections,crm-duplicates", at0900)),
    ["followups"],
  );
  assert.deepEqual(
    names(
      selectDueJobs(
        "followups,financeiro-collections,crm-duplicates",
        new Date(Date.UTC(2026, 8, 26, 3, 0, 0)),
      ),
    ),
    ["financeiro-collections"],
  );
});

test("nomes desconhecidos são ignorados", () => {
  assert.deepEqual(
    names(selectDueJobs("reminders,outbox-inexistente", at0930)),
    ["reminders"],
  );
});

test("smart-triggers aposentado não é selecionável", () => {
  assert.deepEqual(selectDueJobs("smart-triggers", at0930), []);
  assert.deepEqual(
    names(selectDueJobs("reminders,smart-triggers", at0930)),
    ["reminders"],
  );
});

test("erro em um job não aborta o outro", async () => {
  const attempted = [];
  const fetchImpl = async (request) => {
    attempted.push(request.url);
    if (request.url.endsWith("/api/cron/reminders")) {
      return { ok: false, status: 500 };
    }
    return { ok: true, status: 200 };
  };
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => {
    errors.push(args);
  };
  try {
    const settled = await runDueJobs(fetchImpl, "test-secret", [
      { name: "reminders", path: "/api/cron/reminders" },
      { name: "cleanup", path: "/api/cron/cleanup" },
    ]);
    assert.equal(settled.length, 2);
    assert.equal(settled[0].status, "rejected");
    assert.equal(settled[1].status, "fulfilled");
    assert.deepEqual(attempted.sort(), [
      "https://synkroo.internal/api/cron/cleanup",
      "https://synkroo.internal/api/cron/reminders",
    ]);
    assert.equal(errors.length, 1);
    assert.match(String(errors[0][0]), /CRON_JOB_FAILED:reminders/);
  } finally {
    console.error = originalError;
  }
});

test("sem CRON_SECRET todos os jobs falham sem abortar o lote", async () => {
  const fetchImpl = async () => ({ ok: true, status: 200 });
  const originalError = console.error;
  console.error = () => {};
  try {
    const settled = await runDueJobs(fetchImpl, undefined, [
      { name: "reminders", path: "/api/cron/reminders" },
    ]);
    assert.equal(settled[0].status, "rejected");
  } finally {
    console.error = originalError;
  }
});

function silentErrors() {
  const originalError = console.error;
  console.error = () => {};
  return () => {
    console.error = originalError;
  };
}

test("dispatch: default vazio dispara só o outbox", async () => {
  const restore = silentErrors();
  try {
    const attempted = [];
    const fetcher = async (request) => {
      attempted.push(request.url);
      assert.match(
        String(request.headers.get("authorization") ?? ""),
        /^Bearer secret-1$/,
      );
      return { ok: true, status: 200 };
    };
    const settled = await dispatchScheduledJobs(
      { CRON_SECRET: "secret-1" },
      at0930,
      fetcher,
    );
    assert.equal(settled.length, 1);
    assert.equal(settled[0].status, "fulfilled");
    assert.deepEqual(attempted, [
      "https://synkroo.internal/api/cron/outbox?limit=25",
    ]);
  } finally {
    restore();
  }
});

test("dispatch: CSV com 2 nomes dispara outbox + 2 jobs nos paths certos", async () => {
  const restore = silentErrors();
  try {
    const attempted = [];
    const fetcher = async (request) => {
      attempted.push(request.url);
      return { ok: true, status: 200 };
    };
    const settled = await dispatchScheduledJobs(
      { CRON_SECRET: "secret-1", CRON_JOBS_ENABLED: "reminders,cleanup" },
      at1000,
      fetcher,
    );
    assert.equal(settled.length, 3);
    assert.deepEqual(attempted.sort(), [
      "https://synkroo.internal/api/cron/cleanup",
      "https://synkroo.internal/api/cron/outbox?limit=25",
      "https://synkroo.internal/api/cron/reminders",
    ]);
  } finally {
    restore();
  }
});

test("dispatch: falha de um job não impede os demais", async () => {
  const restore = silentErrors();
  try {
    const attempted = [];
    const fetcher = async (request) => {
      attempted.push(request.url);
      if (request.url.endsWith("/api/cron/reminders")) {
        throw new Error("boom");
      }
      return { ok: true, status: 200 };
    };
    const settled = await dispatchScheduledJobs(
      { CRON_SECRET: "secret-1", CRON_JOBS_ENABLED: "reminders,cleanup" },
      at1000,
      fetcher,
    );
    assert.equal(settled.length, 3);
    assert.equal(settled[0].status, "fulfilled");
    assert.equal(settled[1].status, "rejected");
    assert.equal(settled[2].status, "fulfilled");
    assert.equal(attempted.length, 3);
  } finally {
    restore();
  }
});

test("dispatch: sem CRON_SECRET nenhum fetch é executado", async () => {
  const restore = silentErrors();
  try {
    let calls = 0;
    const fetcher = async () => {
      calls += 1;
      return { ok: true, status: 200 };
    };
    const settled = await dispatchScheduledJobs({}, at1000, fetcher);
    assert.deepEqual(settled, []);
    assert.equal(calls, 0);
  } finally {
    restore();
  }
});
