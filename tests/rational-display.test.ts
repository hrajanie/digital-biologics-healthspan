import { describe, expect, it } from 'vitest';
import { asNumber, rational } from '../src/world/rational';
import { shareFraction } from '../src/world/economy';
import { initialNetworkCompany } from '../src/network/economy';

describe('magnitude-safe exact-share display', () => {
  it('preserves ordinary conversion and fractions with enormous numerator and denominator', () => {
    expect(asNumber(rational(1n, 3n))).toBe(1 / 3);
    const huge = 10n ** 450n;
    expect(asNumber(rational(huge + 1n, 3n * huge + 7n))).toBeCloseTo(1 / 3, 14);
    expect(asNumber(rational(-(huge + 1n), 3n * huge + 7n))).toBeCloseTo(-1 / 3, 14);
    expect(asNumber(rational(0n, huge))).toBe(0);
  });

  it('does not falsely zero a small share when only the denominator exceeds Number range', () => {
    expect(asNumber(rational(10n ** 307n + 1n, 10n ** 311n + 3n))).toBeCloseTo(.0001, 16);
    expect(asNumber(rational(10n ** 400n + 1n, 10n ** 700n + 3n))).toBe(1e-300);
  });

  it('handles Number range boundaries without overflowing intermediate values', () => {
    expect(asNumber(rational(10n ** 708n + 1n, 10n ** 400n + 3n))).toBe(1e308);
    expect(asNumber(rational(10n ** 710n, 10n ** 400n + 3n))).toBe(Infinity);
    expect(asNumber(rational(1n, 10n ** 400n))).toBe(0);
  });

  it('keeps founder ownership finite on a huge exact cap table without changing its shares', () => {
    const classes = initialNetworkCompany().classes;
    const huge = 10n ** 450n;
    classes[0]!.shares = `${huge + 1n}/${huge + 3n}`;
    classes[1]!.shares = '2'; classes[2]!.shares = '7';
    const unchanged = JSON.stringify(classes);
    expect(shareFraction(classes, 'founders')).toBeCloseTo(.1, 14);
    expect(JSON.stringify(classes)).toBe(unchanged);
  });
});
