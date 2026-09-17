/**
 * Financeiro — exact-decimal money helpers (Etapa 5.1).
 *
 * Storage is numeric(10,2)/numeric(12,2); the risk is app-layer binary-float
 * math (e.g. `3 * 0.1 === 0.30000000000000004`). All helpers below work on
 * exact decimal semantics with half-up rounding at the cent level:
 *
 * - Parse `string | number` inputs as EXACT decimals (numbers via `String(v)`,
 *   i.e. shortest-round-trip repr, never binary arithmetic).
 * - Intermediate math in `bigint` rationals; a single half-up rounding step
 *   produces the final cent value.
 *
 * Same toCents/centsToDecimal pattern already used in
 * `payment-service.ts` and `financeiro-repository.ts` (kept local there to
 * avoid cross-module churn; new code should import from here).
 */

export interface ExactDecimal {
  /** Signed numerator. */
  n: bigint;
  /** Positive denominator (power of 10). */
  d: bigint;
}

/**
 * Parse a value as an exact decimal with at most `maxDecimals` fraction digits.
 * Throws `Error('Valor inválido')` for anything else (NaN, Infinity,
 * exponential notation, excess precision).
 */
export function parseDecimalExact(value: string | number, maxDecimals: number): ExactDecimal {
  const str = typeof value === 'number'
    ? (Number.isFinite(value) ? String(value) : '')
    : String(value).trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(str);
  if (!match) throw new Error('Valor inválido');
  const [, neg, intPart, fracPart = ''] = match;
  if (fracPart.length > maxDecimals) throw new Error('Valor inválido');
  const scale = 10n ** BigInt(fracPart.length);
  const num = BigInt(intPart + fracPart.padEnd(0, '0') || '0');
  const signed = neg === '-' ? -num : num;
  return { n: signed, d: scale === 0n ? 1n : scale };
}

/**
 * Round a rational `num / den` (den > 0) to the nearest integer, half-up
 * (ties go away from zero). Pure bigint — no float involved.
 */
export function halfUpDiv(num: bigint, den: bigint): bigint {
  if (den <= 0n) throw new Error('Valor inválido');
  const q = num / den; // truncates toward zero
  const r = num % den;
  if (r === 0n) return q;
  const twiceAbsR = (r < 0n ? -r : r) * 2n;
  if (twiceAbsR < den) return q;
  return q + (num < 0n ? -1n : 1n);
}

/** Convert a money value (max 2 decimals) to integer cents. Throws on invalid. */
export function toCents(value: string | number): bigint {
  const { n, d } = parseDecimalExact(value, 2);
  return halfUpDiv(n * 100n, d);
}

/** Render integer cents as a canonical 2-decimal string (`-0.05`, `100.00`). */
export function centsToDecimal(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
}

/**
 * `totalCents * percent / 100` with half-up rounding at the cent level.
 * `percent` accepts fractional values (e.g. `12.5`) parsed exactly.
 */
export function percentOfCents(totalCents: bigint, percent: string | number): bigint {
  const { n, d } = parseDecimalExact(percent, 4);
  return halfUpDiv(totalCents * n, d * 100n);
}

/**
 * Exact line total in cents: `quantity × unitPrice` with a single half-up
 * rounding step. Both operands are parsed as exact decimals (unitPrice up to
 * 3 decimals, e.g. `1.005`; quantity up to 3 decimals), so `10 × 1.005`
 * is exactly `1005` cents — never `1004.999...`.
 */
export function lineTotalCents(quantity: string | number, unitPrice: string | number): bigint {
  const q = parseDecimalExact(quantity, 3);
  const u = parseDecimalExact(unitPrice, 3);
  return halfUpDiv(q.n * u.n * 100n, q.d * u.d);
}

/**
 * Split a total into `count` cent parts that sum EXACTLY to the total.
 * The remainder (< count cents) is distributed one cent at a time to the
 * FIRST installments. Throws when `count < 1`.
 */
export function splitCentsExact(totalCents: bigint, count: number): bigint[] {
  if (!Number.isInteger(count) || count < 1) throw new Error('Valor inválido');
  const n = BigInt(count);
  const base = totalCents / n; // truncates toward zero; totals here are >= 0
  const rem = totalCents % n;
  const parts = Array.from({ length: count }, () => base);
  const extra = rem < 0n ? -rem : rem;
  for (let i = 0; i < Number(extra); i++) {
    parts[i] += totalCents < 0n ? -1n : 1n;
  }
  return parts;
}
