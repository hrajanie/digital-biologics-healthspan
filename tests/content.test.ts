import { describe, expect, it } from 'vitest';
import { buildCost, buildDuration, CONTENT_NOTICE, DEALS, EVENTS, INFRASTRUCTURE, infrastructureCapacity, JURISDICTIONS, PROGRAMS, REGIONS, RELEASES, releasesForScenario, SCENARIOS, siteCount } from '../src/world/content';

describe('authored fictional world', () => {
  it('has six regions in three jurisdictions and all six infrastructure families', () => {
    expect(REGIONS).toHaveLength(6); expect(new Set(REGIONS.map(r => r.jurisdiction)).size).toBe(3); expect(JURISDICTIONS).toHaveLength(3);
    expect(Object.keys(INFRASTRUCTURE)).toHaveLength(6);
    for (const family of Object.keys(INFRASTRUCTURE) as (keyof typeof INFRASTRUCTURE)[]) {
      expect(Number.isSafeInteger(buildCost(family, 0))).toBe(true);
      expect(buildCost(family, 1)).toBeGreaterThan(buildCost(family, 0));
      expect(buildDuration(family)).toBeGreaterThanOrEqual(2);
    }
  });
  it('has six differentiated programs across three disease families', () => {
    expect(PROGRAMS).toHaveLength(6); expect(new Set(PROGRAMS.map(p => p.family)).size).toBe(3);
    expect(PROGRAMS.filter(p => p.initialStage === 'approved')).toHaveLength(2);
    expect(new Set(PROGRAMS.map(p => [p.response, p.durability, p.harm].join(':'))).size).toBe(6);
    expect(PROGRAMS.find(p => p.id === 'personalized-neuro')!.available).toBeGreaterThan(2040);
    expect(PROGRAMS.every(p => Number.isSafeInteger(p.price) && Number.isSafeInteger(p.cost))).toBe(true);
  });
  it('contains eight releases and two bullish but strategically different trajectories', () => {
    expect(RELEASES).toHaveLength(8); expect(Object.keys(SCENARIOS)).toHaveLength(2);
    const a = releasesForScenario('convergence'), b = releasesForScenario('staggered');
    expect(a.map(r => r.year)).not.toEqual(b.map(r => r.year));
    expect(a.every(r => r.research > 1 && r.compute > 1 && r.biology > 1 && r.access > 1)).toBe(true);
    expect(b[0]!.compute).toBeGreaterThan(a[0]!.compute); expect(b[0]!.biology).toBeLessThan(a[0]!.biology);
    a[0]!.year = 1990; expect(RELEASES[0]!.year).toBe(2028);
  });
  it('offers three meaningfully different term bundles in each of six deal families', () => {
    expect(DEALS).toHaveLength(6); expect(new Set(DEALS.map(d => d.family)).size).toBe(6);
    for (const deal of DEALS) {
      expect(deal.variants).toHaveLength(3);
      expect(new Set(deal.variants.map(v => v.description)).size).toBe(3);
      expect(deal.variants.every(v => [v.cash, v.credits, v.preMoney, v.annualCost, v.annualRevenue].every(Number.isSafeInteger))).toBe(true);
    }
    const equity = DEALS.find(d => d.family === 'equity')!;
    expect(equity.variants.filter(v => v.founderSeats === 3 && !v.strategicControl)).toHaveLength(2);
    expect(DEALS.find(d => d.family === 'frontier')!.variants[2]!.strategicControl).toBe(false);
    expect(EVENTS).toHaveLength(12); expect(new Set(EVENTS.map(e => e.trigger)).size).toBe(12);
    expect(CONTENT_NOTICE).toContain('Fictional');
  });
  it('keeps delivery constrained by the weakest family while supporting large late networks', () => {
    const levels = { diagnostics: 1, clinic: 1, manufacturing: 1, evidence: 1, followup: 1, network: 0 };
    expect(infrastructureCapacity(levels)).toBe(100);
    expect(infrastructureCapacity({ ...levels, diagnostics: 0 })).toBe(0);
    expect(infrastructureCapacity({ ...levels, diagnostics: 9 }, 100, 100)).toBe(100);
    expect(siteCount(6)).toBe(160_000);
    expect(infrastructureCapacity({ ...levels, network: 8 })).toBe(120_000_000);
  });
});
