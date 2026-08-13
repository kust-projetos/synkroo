import assert from "node:assert/strict";
import test from "node:test";
import { isExpectedClientAbort } from "../ignore-client-abort.cjs";

test("recognizes only the expected Next.js client disconnect", () => {
  assert.equal(
    isExpectedClientAbort({ code: "ECONNRESET", message: "aborted" }),
    true,
  );
  assert.equal(
    isExpectedClientAbort({ code: "ECONNRESET", message: "database reset" }),
    false,
  );
  assert.equal(
    isExpectedClientAbort({ code: "ETIMEDOUT", message: "aborted" }),
    false,
  );
  assert.equal(isExpectedClientAbort(new Error("aborted")), false);
});
