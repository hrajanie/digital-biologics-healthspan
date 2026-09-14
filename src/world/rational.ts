/** Exact rational arithmetic for shares and cent allocation; never persist a bigint. */
export interface Rational { n: bigint; d: bigint }
function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}
export function rational(n: bigint, d = 1n): Rational {
  if (!d) throw new RangeError('A rational denominator cannot be zero.');
  if (d < 0n) { n = -n; d = -d; }
  const common = gcd(n, d);
  return { n: n / common, d: d / common };
}
export function q(value: string | number | bigint): Rational {
  if (typeof value === 'bigint') return rational(value);
  if (typeof value === 'number' && !Number.isFinite(value)) throw new RangeError('A finite rational value is required.');
  const raw = String(value).trim();
  if (raw.includes('/')) {
    const parts = raw.split('/');
    if (parts.length !== 2) throw new RangeError('Invalid share fraction.');
    return div(q(parts[0]!), q(parts[1]!));
  }
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(raw);
  if (!match) throw new RangeError('Invalid rational value.');
  const decimal = match[3] ?? '';
  const exponent = Number(match[4] ?? 0) - decimal.length;
  if (Math.abs(exponent) > 1000) throw new RangeError('Rational exponent is out of range.');
  let n = BigInt(match[2]! + decimal) * (match[1] === '-' ? -1n : 1n);
  if (exponent >= 0) n *= 10n ** BigInt(exponent);
  return rational(n, exponent < 0 ? 10n ** BigInt(-exponent) : 1n);
}
export const add = (a: Rational, b: Rational): Rational => rational(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rational, b: Rational): Rational => rational(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rational, b: Rational): Rational => rational(a.n * b.n, a.d * b.d);
export const div = (a: Rational, b: Rational): Rational => rational(a.n * b.d, a.d * b.n);
export const cmp = (a: Rational, b: Rational): number => a.n * b.d < b.n * a.d ? -1 : a.n * b.d > b.n * a.d ? 1 : 0;
export const encode = (a: Rational): string => a.d === 1n ? String(a.n) : `${a.n}/${a.d}`;
/** Display conversion only. Large exact cap tables must not become Infinity / Infinity. */
export function asNumber(a: Rational): number {
  const numerator = Number(a.n), denominator = Number(a.d);
  if (Number.isFinite(numerator) && Number.isFinite(denominator)) return numerator / denominator;
  if (a.n === 0n) return 0;
  const negative = (a.n < 0n) !== (a.d < 0n);
  const n = (a.n < 0n ? -a.n : a.n).toString(), d = (a.d < 0n ? -a.d : a.d).toString();
  const leading = (digits: string) => Number(`${digits[0]}.${digits.slice(1, 17)}`);
  let mantissa = leading(n) / leading(d), exponent = n.length - d.length;
  if (mantissa < 1) { mantissa *= 10; exponent--; }
  // Parsing the final scientific value handles representable boundary values and
  // true over/underflow without overflowing an intermediate power of ten.
  return Number(`${negative ? '-' : ''}${mantissa}e${exponent}`);
}
export const sum = (values: Rational[]): Rational => values.reduce(add, q(0));
export function floor(a: Rational): bigint { return a.n >= 0n ? a.n / a.d : -((-a.n + a.d - 1n) / a.d); }
export function money(value: number, label = 'Money'): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a nonnegative safe integer number of USD cents.`);
  return value;
}
export function cent(value: number): number {
  const result = Math.round(value);
  if (!Number.isSafeInteger(result)) throw new RangeError('Financial result exceeded exact integer cents.');
  return result;
}

/** Largest remainders allocate every cent, including tied fractional entitlements. */
export function apportion(proceeds: number, weighted: { id: string; weight: Rational }[]): Map<string, number> {
  money(proceeds, 'Proceeds');
  const total = sum(weighted.map(item => item.weight));
  if (cmp(total, q(0)) <= 0) {
    if (proceeds > 0) throw new RangeError('Positive proceeds require a positive ownership weight.');
    return new Map(weighted.map(item => [item.id, 0]));
  }
  const items = weighted.map(item => {
    if (cmp(item.weight, q(0)) < 0) throw new RangeError('Allocation weights cannot be negative.');
    const exact = div(mul(q(proceeds), item.weight), total);
    const cents = floor(exact);
    return { id: item.id, cents: Number(cents), remainder: sub(exact, q(cents)) };
  });
  let left = proceeds - items.reduce((acc, item) => acc + item.cents, 0);
  const ranked = [...items].sort((a, b) => cmp(b.remainder, a.remainder) || a.id.localeCompare(b.id));
  for (const item of ranked) {
    if (!left) break;
    item.cents += 1;
    left -= 1;
  }
  return new Map(items.map(item => [item.id, item.cents]));
}
