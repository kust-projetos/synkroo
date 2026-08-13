const isExpectedClientAbort = (value) =>
  Boolean(
    value &&
    typeof value === "object" &&
    value.code === "ECONNRESET" &&
    value.message === "aborted",
  );

const originalConsoleError = console.error.bind(console);

console.error = (...args) => {
  const hasAbort = args.some(isExpectedClientAbort);
  const isNextAbortLog =
    args.some(
      (value) =>
        typeof value === "string" && value.includes("uncaughtException"),
    ) && hasAbort;

  if (hasAbort || isNextAbortLog) return;
  originalConsoleError(...args);
};

module.exports = { isExpectedClientAbort };
