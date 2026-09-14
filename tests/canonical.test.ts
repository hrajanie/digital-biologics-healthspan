import { describe, expect, it } from 'vitest';
import { canonicalValue, semanticChecksum, SEMANTIC_RELATIVE_ROUNDING_BOUND } from '../src/core/canonical';

describe('semantic checksum projection', () => {
  it('absorbs observed browser/Node health differences without changing authoritative values', () => {
    const saved = Object.freeze({ cash: 63_611_645_343_826, starts: 622_524_302, health: Object.freeze({ expected: 1266880499.4475806, remaining: 360987678.4456007, small: .7746477284933009 }), shares: '13/88' });
    const replayed = { ...saved, health: { expected: 1266880499.4475808, remaining: 360987678.44560075, small: .7746477284933008 } };
    const before = JSON.stringify(saved);
    expect(semanticChecksum(saved)).toBe(semanticChecksum(replayed));
    expect(JSON.stringify(saved)).toBe(before);
    expect(saved.health.expected).toBe(1266880499.4475806);
    expect(canonicalValue(saved)).not.toBe(saved);
  });
  it('preserves exact cents, integer counts and rational strings', () => {
    const base = { cash: 63_611_645_343_826, count: 622_524_302, shares: '13/88' };
    expect(canonicalValue(base)).toEqual(base);
    expect(semanticChecksum({ ...base, cash: base.cash + 1 })).not.toBe(semanticChecksum(base));
    expect(semanticChecksum({ ...base, count: base.count + 1 })).not.toBe(semanticChecksum(base));
    expect(semanticChecksum({ ...base, shares: '14/88' })).not.toBe(semanticChecksum(base));
    expect(canonicalValue(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
    expect(canonicalValue(-Number.MAX_SAFE_INTEGER)).toBe(-Number.MAX_SAFE_INTEGER);
  });
  it('detects meaningful health differences and does not conflate strings or booleans', () => {
    const base = { health: 1266880499.4475806, label: 'approved', active: true };
    expect(semanticChecksum({ ...base, health: base.health + 1 })).not.toBe(semanticChecksum(base));
    expect(semanticChecksum({ ...base, health: base.health + .1 })).not.toBe(semanticChecksum(base));
    expect(semanticChecksum({ ...base, label: 'preclinical' })).not.toBe(semanticChecksum(base));
    expect(semanticChecksum({ ...base, active: false })).not.toBe(semanticChecksum(base));
  });
  it('normalizes object insertion order while preserving array order', () => {
    expect(semanticChecksum({ b: [2, 3], a: { y: true, x: 'v' } })).toBe(semanticChecksum({ a: { x: 'v', y: true }, b: [2, 3] }));
    expect(semanticChecksum([2, 3])).not.toBe(semanticChecksum([3, 2]));
  });
  it('bounds each noninteger projection error and is idempotent', () => {
    for (const value of [.7746477284933009, -47.542756421211756, 1266880499.4475806, 1.0000000000051, 3.141592653589793e-18, 5e-324]) {
      const projected = canonicalValue(value) as number;
      expect(Math.abs(projected - value)).toBeLessThanOrEqual(Math.abs(value) * SEMANTIC_RELATIVE_ROUNDING_BOUND + Number.MIN_VALUE);
      expect(canonicalValue(projected)).toBe(projected);
    }
  });
  it('rejects nonfinite or circular state without mutating ordinary shared references', () => {
    for (const value of [NaN, Infinity, -Infinity]) expect(() => semanticChecksum({ value })).toThrow(/finite/);
    const cyclic: { self?: unknown } = {}; cyclic.self = cyclic;
    expect(() => canonicalValue(cyclic)).toThrow(/circular/);
    const shared = Object.freeze({ value: .123456789012345 });
    expect(canonicalValue({ a: shared, b: shared })).toEqual({ a: { value: .123456789012 }, b: { value: .123456789012 } });
  });
});
