/**
 * Provider message-clock parsing (WhatsApp inbound).
 *
 * WAHA delivers the provider message clock as `payload.timestamp` (epoch
 * seconds, number); Meta delivers `message.timestamp` (epoch seconds,
 * string). This is the ONLY trustworthy inbound event time: DB
 * `messages.createdAt` is persistence time and must never stand in for it —
 * a delayed SIM stored after a new pending intent would otherwise look
 * fresh and confirm the wrong intent.
 *
 * Returns an ISO-8601 UTC string, or undefined when missing/invalid.
 * Callers persist the inbound row regardless, but fail closed (escalate,
 * never mutate) on undefined — there is intentionally no fallback to the
 * insert timestamp.
 */
export function parseProviderEventTimestamp(value: unknown): string | undefined {
  let seconds: number | null = null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    seconds = value;
  } else if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value.trim());
    if (Number.isFinite(n)) seconds = n;
  }
  if (seconds === null || seconds <= 0) return undefined;
  const date = new Date(seconds * 1000);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}
