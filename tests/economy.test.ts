import {investorDilutionHistory} from '../src/world/economy';
import { describe, expect, it } from 'vitest';
import type { GameState, ShareClass } from '../src/core/types';
import { allocateExit, forecastCompany, initialCompany, issueEquity, shareFraction, shareRatio, sliceRound, valueCompany } from '../src/world/economy';
import { infrastructureCapacity, PROGRAMS, REGIONS } from '../src/world/content';
import { advanceQuarter, commitPlan, createCampaign, previewPlan } from '../src/core/engine';

const M = 100_000_000;
function state(): GameState {
  const levels = { diagnostics: 1, clinic: 1, manufacturing: 1, evidence: 1, followup: 1, network: 1 };
  return {
    schemaVersion: 1, engineVersion: 'test', contentVersion: 'test', id: 'test', seed: 2027, scenario: 'convergence', mode: 'campaign',
    year: 2027, quarter: 1, tick: 0, phase: 'planning', status: 'active', company: initialCompany(),
    regions: REGIONS.map((r, i) => ({ ...r, unlocked: i === 0, waiting: 50_000, treated: 0, levels: { ...levels },
      quality: .9, capacity: infrastructureCapacity(levels), lastTreated: i === 0 ? 100 : 0, lastTrial: 0,
      bottleneck: 'clinic', utilization: .2, siteCount: 20 })),
    programs: PROGRAMS.map(p => ({ ...p, stage: p.initialStage, version: 1, availableVersion: 1, readiness: 1, evidence: p.initialStage === 'approved' ? 1 : 0,
      study: null, active: p.initialStage === 'approved', licensed: false, partnered: false, starts: 0, lastResult: '', platformScope: false })),
    projects: [], policy: { stage: 'product', support: 0, lobbyBudget: 0, charter: null, implementation: 0, recognition: false, qualified: false, window: 0, scope: [], history: [] },
    world: { research: 1, compute: 1, biology: 1, access: 1, modelVersion: 1, releases: [], rivals: [], counterfactualAccess: 0, counterfactualPolicy: 0, lastShift: '' },
    cohorts: [], score: { expected: 0, experienced: 0, remaining: 0, outsideHarm: 0, low: 0, high: 0, people: 0, worldwide: 0, tailError: 0 },
    events: [], trace: [], history: [], committed: [], delegated: false, seenDecisions: [], outsideHarm: 0,
  };
}

describe('exact capitalization', () => {
  it('starts 55/15/20/10 common with $12M cash and no invented financing', () => {
    const c = initialCompany();
    expect(c.classes.map(p => shareFraction(c.classes, p.id))).toEqual([.55, .15, .2, .1]);
    expect(c.cash).toBe(12 * M); expect(c.credits).toBe(0); expect(c.rounds).toEqual([]);
    expect(c.classes.every(p => !p.preferred && p.invested === 0)).toBe(true);
  });
  it('matches $30M at $120M then $120M at $480M with a 15% second-round pool', () => {
    const original = initialCompany();
    const first = issueEquity(original, { cash: 30 * M, preMoney: 120 * M, id: 'seed' }, 2027);
    expect(shareRatio(first.classes, 'founders')).toBe('11/25');
    const second = issueEquity(first, { cash: 120 * M, preMoney: 480 * M, poolTopup: .15, id: 'a' }, 2030);
    expect(shareRatio(second.classes, 'founders')).toBe('13/40');
    expect(shareRatio(second.classes, 'option-pool')).toBe('3/20');
    expect(shareRatio(second.classes, 'a-preferred')).toBe('1/5');
    expect(shareRatio(second.classes, 'seed-preferred')).toBe('13/88');
    expect(second.cash).toBe(162 * M);
    expect(original).toEqual(initialCompany());
  });
  it('does not shrink the existing option reserve and rejects impossible reserve targets', () => {
    const c = issueEquity(initialCompany(), { cash: M, preMoney: 100 * M, poolTopup: .05 }, 2027);
    expect(c.classes.find(p => p.reserved)!.shares).toBe('15');
    expect(() => issueEquity(initialCompany(), { cash: 100 * M, preMoney: 100 * M, poolTopup: .6 }, 2027)).toThrow(/reserve/);
  });
  it('accounts for restricted credits separately and preserves granted investor rights', () => {
    const first = issueEquity(initialCompany(), { cash: 8 * M, preMoney: 80 * M, credits: 15 * M, founderSeats: 1, strategicControl: true }, 2028);
    expect(first.cash).toBe(20 * M); expect(first.credits).toBe(15 * M);
    expect(first.classes.at(-1)!.invested).toBe(8 * M);
    const next = issueEquity(first, { cash: M, preMoney: 100 * M, founderSeats: 3, strategicControl: false }, 2029);
    expect(next.founderSeats).toBe(1); expect(next.strategicControl).toBe(true); expect(next.control).toBe('at-risk');
  });
  it('maintains exact canonical fractions through many differently priced rounds', () => {
    let c = initialCompany();
    for (let i = 1; i <= 35; i++) c = issueEquity(c, { cash: (i + 2) * M, preMoney: (i * 19 + 120) * M, poolTopup: .15 }, 2027 + i);
    expect(shareRatio(c.classes, 'option-pool')).toBe('3/20');
    expect(c.classes.every(p => /^\d+(\/\d+)?$/.test(p.shares))).toBe(true);
    expect(c.classes.reduce((acc, p) => acc + shareFraction(c.classes, p.id), 0)).toBeCloseTo(1, 12);
  });
});

describe('preferred exit allocation', () => {
  const classes: ShareClass[] = [
    { id: 'founder', name: 'Common', shares: '60', invested: 0, preferred: false },
    { id: 'a', name: 'A', shares: '20', invested: 10, preferred: true },
    { id: 'b', name: 'B', shares: '20', invested: 100, preferred: true },
  ];
  it('pays insufficient proceeds pari passu, then converts only the advantaged preferred class', () => {
    expect(allocateExit(55, classes)).toEqual([
      { classId: 'founder', proceeds: 0, converted: false }, { classId: 'a', proceeds: 5, converted: false }, { classId: 'b', proceeds: 50, converted: false },
    ]);
    expect(allocateExit(220, classes)).toEqual([
      { classId: 'founder', proceeds: 90, converted: false }, { classId: 'a', proceeds: 30, converted: true }, { classId: 'b', proceeds: 100, converted: false },
    ]);
    expect(allocateExit(1000, classes).map(p => p.proceeds)).toEqual([600, 200, 200]);
  });
  it('conserves every cent across fractional shares, ties and mixed conversions', () => {
    const fractional = classes.map((c, i) => ({ ...c, shares: `${c.shares}/${i + 1}` }));
    for (let exit = 0; exit <= 1101; exit++) {
      const result = allocateExit(exit, fractional);
      expect(result.reduce((acc, p) => acc + p.proceeds, 0)).toBe(exit);
      expect(result.every(p => Number.isSafeInteger(p.proceeds) && p.proceeds >= 0)).toBe(true);
      expect(allocateExit(exit, [...fractional].reverse()).sort((a, b) => a.classId.localeCompare(b.classId)))
        .toEqual([...result].sort((a, b) => a.classId.localeCompare(b.classId)));
    }
  });
  it('pays the fully diluted option reserve under the zero-cost convention', () => {
    expect(allocateExit(100, initialCompany().classes).map(p => p.proceeds)).toEqual([55, 15, 20, 10]);
  });
  it('handles all-preferred and empty zero-value capitalization', () => {
    expect(allocateExit(300, classes.slice(1)).reduce((acc, p) => acc + p.proceeds, 0)).toBe(300);
    expect(allocateExit(0, [])).toEqual([]);
    expect(() => allocateExit(1, [])).toThrow();
  });
});

describe('state-derived five-year DCF and investor views', () => {
  it('projects after 2050 and shows actual discounted cash flows plus an 8x residual', () => {
    const s = state(); s.year = 2050; s.tick = 96;
    s.regions[0]!.levels.network = 5; s.regions[0]!.lastTreated = 180_000;
    const valuation = valueCompany(s);
    expect(valuation.forecast.map(y => y.year)).toEqual([2051, 2052, 2053, 2054, 2055]);
    expect(valuation.residual).toBe(Math.max(0, valuation.forecast[4]!.recurring) * 8);
    const sum = valuation.forecast.reduce((acc, year, i) => acc + year.freeCash / 1.15 ** (i + 1), 0) + valuation.residual / 1.15 ** 5;
    expect(valuation.enterprise).toBe(Math.round(sum));
    expect(valuation.equity).toBe(Math.max(0, valuation.enterprise + s.company.cash - s.company.debt));
    expect(valuation.low).toBeLessThanOrEqual(valuation.equity); expect(valuation.high).toBeGreaterThanOrEqual(valuation.equity);
  });
  it('ignores healthspan score and restricted credits in corporate valuation', () => {
    const a = state(), b = structuredClone(a);
    b.score.expected = 1e12; b.company.credits = 999 * M;
    expect(valueCompany(b)).toEqual(valueCompany(a));
  });
  it('includes committed capacity without charging already-paid construction twice', () => {
    const s = state();
    const before = forecastCompany(s);
    s.projects.push({ id: 'build', name: 'network', kind: 'build', regionId: 'pacific', family: 'network', remaining: 4, cost: 100 * M, started: 0 });
    const after = forecastCompany(s);
    expect(after[0]!.receipts).toBeGreaterThan(before[0]!.receipts);
    expect(after[0]!.capex - before[0]!.capex).toBeLessThan(M);
  });
  it('expires contractual receipts and costs and exposes operating cash gaps', () => {
    const s = state(); s.company.cash = 500 * M;
    const baseline = structuredClone(s);
    s.company.contracts.push({ id: 'contract', family: 'payer', name: 'Access', start: 0, end: 6, annualCost: 20 * M, annualRevenue: M, royalty: 0, capacity: 4, exclusive: false, portable: true, programId: 'autoimmune-care' });
    const base = forecastCompany(baseline); const projection = forecastCompany(s);
    expect(projection[0]!.receipts - base[0]!.receipts).toBe(M - 4 * 65_000);
    expect(projection[1]!.receipts - base[1]!.receipts).toBe(.5 * (M - 4 * 65_000));
    expect(projection[2]!.receipts).toBe(base[2]!.receipts);
    expect(projection[0]!.operations - base[0]!.operations).toBe(20 * M);
    s.company.cash = 0;
    expect(valueCompany(s).fundingGap).toBeGreaterThan(0);
  });
  it('earns no population contract receipts without delivered physical care', () => {
    const s = state(); s.regions.forEach(r => { r.levels.clinic = 0; r.capacity = 0; r.lastTreated = 0; });
    s.company.contracts.push({ id: 'empty-care', family: 'payer', name: 'Access promise', start: 0, end: 20, annualCost: M, annualRevenue: 30 * M, royalty: 0, capacity: 60_000, exclusive: false, portable: true });
    const forecast = forecastCompany(s);
    expect(forecast.every(y => y.receipts === 0)).toBe(true);
    expect(forecast.every(y => y.operations >= M)).toBe(true);
  });
  it('incorporates active clinical evidence in expected future operating scope only', () => {
    const s = state(); s.regions[0]!.levels.network = 5;
    const before = forecastCompany(s);
    const p = s.programs.find(p => p.id === 'immune-reset')!;
    p.active = true; p.stage = 'phase3'; p.evidence = .9;
    p.study = { package: 'broad', phase: 'phase3', readiness: 1, enrolled: 300, target: 300, observation: 2, observationRequired: 6, review: 0, budget: M, spent: M, start: 0, paused: false, version: 1, observedResponse: .7, observedHarm: .03 };
    const after = forecastCompany(s);
    expect(after[3]!.receipts).toBeGreaterThan(before[3]!.receipts);
    expect(valueCompany(s).explanation.join(' ')).toContain('no separate pipeline value');
  });
  it('slices existing round ownership and preferences, without funding or state mutation', () => {
    const s = state();
    s.company = issueEquity(s.company, { id: 'seed', cash: 30 * M, preMoney: 120 * M }, 2027);
    const before = JSON.stringify(s);
    const position = sliceRound(s, 'seed', 5 * M);
    expect(position.initialOwnership).toBeCloseTo(1 / 30, 14);
    expect(position.shares).toBe('25/6'); expect(position.ownership).toBeCloseTo(1 / 30, 14);
    expect(JSON.stringify(s)).toBe(before);
    s.company = issueEquity(s.company, { id: 'a', cash: 120 * M, preMoney: 480 * M, poolTopup: .15 }, 2030);
    expect(sliceRound(s, 'seed', 5 * M).ownership).toBeCloseTo(13 / 528, 14);
    expect(() => sliceRound(s, 'seed', 31 * M)).toThrow(/fit/);
    expect(() => sliceRound(s, 'imaginary', M)).toThrow(/recorded/);
  });
  it('partitions the entire actual round exactly down to cents with contiguous slices', () => {
    const s = state(); s.company = issueEquity(s.company, { id: 'seed', cash: 30 * M, preMoney: 120 * M }, 2027);
    const whole = sliceRound(s, 'seed', 30 * M);
    const first = sliceRound(s, 'seed', 10 * M + 1);
    const second = sliceRound(s, 'seed', 20 * M - 1, 10 * M + 1);
    for (const key of ['proceeds', 'low', 'high'] as const) expect(first[key] + second[key]).toBe(whole[key]);
    expect(first.ownership + second.ownership).toBeCloseTo(whole.ownership, 14);
  });
});

function capitalizedState(): GameState {
  const s = state(); s.company.cash = 1_000 * M;
  for (const [index, r] of s.regions.entries()) {
    if (index) for (const family of Object.keys(r.levels) as (keyof typeof r.levels)[]) r.levels[family] = 0;
    else r.levels.network = 3;
    r.lastTreated = 0; r.lastTrial = 0;
  }
  return s;
}
function contract(overrides: Partial<GameState['company']['contracts'][number]> = {}): GameState['company']['contracts'][number] {
  return { id: 'test-contract', family: 'therapy', name: 'Test contract', start: 0, end: 20, annualCost: 0, annualRevenue: 0, royalty: 0, capacity: 0, exclusive: false, portable: true, ...overrides };
}

describe('forecast mirrors known operating commitments', () => {
  it('nets a global royalty once without manufacturing a royalty operating expense', () => {
    const s = capitalizedState(), base = forecastCompany(s);
    s.company.royalty = .1;
    const changed = forecastCompany(s);
    for (let i = 0; i < 5; i++) {
      expect(Math.abs(changed[i]!.receipts - base[i]!.receipts * .9)).toBeLessThanOrEqual(2);
      expect(changed[i]!.operations).toBe(base[i]!.operations);
    }
  });
  it('applies program and license royalties only to the active matching program and region', () => {
    const s = capitalizedState(), base = forecastCompany(s);
    s.company.contracts.push(contract({ royalty: .04, annualCost: 18_000_000, programId: 'immune-reset' }));
    const inactive = forecastCompany(s);
    for (let i = 0; i < 5; i++) {
      expect(inactive[i]!.receipts).toBe(base[i]!.receipts);
      expect(inactive[i]!.operations - base[i]!.operations).toBe(18_000_000);
    }
    s.company.contracts[0]!.programId = 'autoimmune-care'; s.company.contracts[0]!.regionId = 'northeast';
    expect(forecastCompany(s).map(y => y.receipts)).toEqual(base.map(y => y.receipts));
    s.company.contracts[0]!.regionId = 'pacific';
    expect(forecastCompany(s)[0]!.receipts).toBeLessThan(base[0]!.receipts);
  });
  it('does not let an expired therapy license erase a permanent registry levy', () => {
    const s = capitalizedState(); s.company.royalty = .02;
    const base = forecastCompany(s);
    s.company.contracts.push(contract({ programId: 'autoimmune-care', royalty: .04, start: -20, end: 0 }));
    expect(forecastCompany(s)).toEqual(base);
  });
  it('starts and ends global contract royalties on their actual quarters', () => {
    const s = capitalizedState(); const base = forecastCompany(s);
    s.company.royalty = .1; s.company.contracts.push(contract({ family: 'frontier', royalty: .1, start: 4, end: 8 }));
    const changed = forecastCompany(s);
    expect(changed[0]!.receipts).toBe(base[0]!.receipts);
    expect(Math.abs(changed[1]!.receipts - base[1]!.receipts * .9)).toBeLessThanOrEqual(2);
    expect(changed[2]!.receipts).toBe(base[2]!.receipts);
  });
  it('counts a single program royalty once even when it is the entire revenue mix', () => {
    const s = capitalizedState(); s.programs.forEach(p => { p.active = p.id === 'autoimmune-care'; });
    const base = forecastCompany(s);
    s.programs.find(p => p.id === 'autoimmune-care')!.royalty = .1;
    const changed = forecastCompany(s);
    expect(Math.abs(changed[0]!.receipts - base[0]!.receipts * .9)).toBeLessThanOrEqual(2);
    expect(changed[0]!.operations).toBe(base[0]!.operations);
  });
  it('honors two-level target tranches and their commissioning quarter', () => {
    const s = capitalizedState();
    s.projects.push({ id: 'pending', name: 'Network tranche', kind: 'build', regionId: 'pacific', family: 'network', remaining: 6, cost: 100 * M, started: 0, targetLevel: 4 });
    const one = forecastCompany(s); s.projects[0]!.targetLevel = 5; const two = forecastCompany(s);
    expect(two[0]).toEqual(one[0]);
    expect(two[1]!.receipts).toBeGreaterThan(one[1]!.receipts);
    const firstQuarter = structuredClone(s); firstQuarter.projects[0]!.remaining = 1;
    const fourthQuarter = structuredClone(s); fourthQuarter.projects[0]!.remaining = 4;
    expect(forecastCompany(firstQuarter)[0]!.receipts).toBeGreaterThan(forecastCompany(fourthQuarter)[0]!.receipts);
  });
  it('commissions bundled diagnostic, clinic, manufacturing and follow-up standards in a new region', () => {
    const s = capitalizedState(), base = forecastCompany(s);
    s.projects.push({ id: 'new-network', name: 'New network', kind: 'build', regionId: 'northeast', family: 'network', remaining: 4, cost: M, started: 0, targetLevel: 1 });
    const projected = forecastCompany(s);
    expect(projected[0]!.receipts).toBeGreaterThan(base[0]!.receipts);
    expect(projected[1]!.receipts).toBeGreaterThan(base[1]!.receipts);
    const before = JSON.stringify(s); forecastCompany(s); expect(JSON.stringify(s)).toBe(before);
  });
  it('withholds payment for unbuilt regions and unsupported programs without displacing unrelated retail care', () => {
    const s = capitalizedState(), base = forecastCompany(s);
    s.company.contracts.push(contract({ family: 'payer', regionId: 'northeast', programId: 'autoimmune-care', capacity: 30_000, annualRevenue: 22 * M }));
    expect(forecastCompany(s).map(y => y.receipts)).toEqual(base.map(y => y.receipts));
    s.company.contracts[0]!.regionId = 'pacific'; s.company.contracts[0]!.programId = 'immune-reset';
    expect(forecastCompany(s).map(y => y.receipts)).toEqual(base.map(y => y.receipts));
  });
  it('settles each covered start once even with overlapping payer contracts', () => {
    const s = capitalizedState();
    s.company.contracts.push(contract({ family: 'payer', capacity: 10_000_000, annualRevenue: 650_000_000_000 }));
    const one = forecastCompany(s);
    s.company.contracts.push({ ...s.company.contracts[0]!, id: 'overlapping-payer' });
    expect(forecastCompany(s)).toEqual(one);
  });
  it('lets restricted payer prepayment fund matching care without becoming cash or an additional receipt', () => {
    const s = capitalizedState(); s.company.cash = 0; s.programs.forEach(p => { p.active = p.id === 'autoimmune-care'; });
    expect(forecastCompany(s)[0]!.receipts).toBe(0);
    s.company.contracts.push(contract({ family: 'payer', programId: 'autoimmune-care', capacity: 4_000_000, annualRevenue: 2_600_000_000_000 }));
    expect(forecastCompany(s)[0]!.receipts).toBeGreaterThan(0);
    const before = JSON.stringify(s); forecastCompany(s); expect(JSON.stringify(s)).toBe(before);
    s.company.contracts[0]!.programId = 'immune-reset';
    expect(forecastCompany(s)[0]!.receipts).toBe(0);
  });
  it('reserves trial follow-up after a study ends and charges its ongoing cost', () => {
    const s = capitalizedState(); s.regions[0]!.levels.network = 1;
    const base = forecastCompany(s); s.trialFollowup = { pacific: 100_000 };
    const constrained = forecastCompany(s);
    expect(constrained.every(y => y.receipts === 0)).toBe(true);
    expect(constrained[0]!.operations).toBeGreaterThan(base[0]!.operations);
  });
  it('reserves existing care follow-up before new starts and accrues future follow-up from forecast starts', () => {
    const s = capitalizedState(); s.regions[0]!.levels.network = 1;
    s.cohorts.push({ id: 'prior-care', profileId: 'prior-residents', regionId: 'pacific', programId: 'autoimmune-care', count: 100_000, start: 0, age: 54, version: 1, response: .7, durability: 7, annualGain: .1, harm: .01, continuity: 1, experienced: 0, remaining: 0, baselineDelay: 10, alive: 100_000, history: [] });
    expect(forecastCompany(s).every(y => y.receipts === 0)).toBe(true);
    s.cohorts = []; s.regions[0]!.queue = { gross: 500, rivals: 0, followupRequired: 0, followup: 0, trials: 0, care: 500, idle: 0 };
    const operating = forecastCompany(s);
    expect(operating[4]!.receipts).toBeLessThan(operating[0]!.receipts);
  });
  it('does not turn nonbinding manufacturing supply into a complete care pathway', () => {
    const s = capitalizedState(), base = forecastCompany(s);
    s.company.contracts.push(contract({ family: 'manufacturing', capacity: 4_000, annualCost: M }));
    const changed = forecastCompany(s);
    expect(changed.map(y => y.receipts)).toEqual(base.map(y => y.receipts));
    expect(changed[0]!.operations - base[0]!.operations).toBe(M);
    s.regions[0]!.levels.diagnostics = 0;
    s.company.contracts.push(contract({ id: 'hospital', family: 'hospital', capacity: 1_000_000 }));
    expect(forecastCompany(s).every(y => y.receipts === 0)).toBe(true);
  });
  it('reuses supplied company valuation when slicing a round without touching forecast state', () => {
    const s = capitalizedState(); s.company = issueEquity(s.company, { id: 'seed', cash: 30 * M, preMoney: 120 * M }, 2027);
    const supplied = { ...valueCompany(s), equity: 0, low: 0, high: 0 };
    Object.defineProperty(s, 'regions', { get() { throw new Error('Forecast must run in the worker, not during investor display.'); } });
    expect(sliceRound(s, 'seed', M, 0, supplied).proceeds).toBe(0);
  });
  it('uses current care demand and permissions for near-term planning, not financial uptake or hypothetical approvals', () => {
    const s = capitalizedState();
    const financial = forecastCompany(s, 'base')[0]!.starts!;
    expect(forecastCompany(s, 'base', true)[0]!.starts).toBeGreaterThan(financial);
    s.programs.forEach(p => { p.active = false; });
    const p = s.programs.find(p => p.id === 'immune-reset')!; p.active = true; p.stage = 'phase3'; p.evidence = .9;
    p.study = { package: 'broad', phase: 'phase3', readiness: 1, enrolled: 300, target: 300, observation: 2, observationRequired: 6, review: 0, budget: M, spent: M, start: 0, paused: false, version: 1, observedResponse: .7, observedHarm: .03 };
    expect(forecastCompany(s, 'high', true).every(y => y.starts === 0)).toBe(true);
    expect(forecastCompany(s, 'high')[4]!.starts).toBeGreaterThan(0);
  });
  it('brackets stable late-year realized care with known continuing-care queues and committed builds', () => {
    const s = createCampaign(); s.year = 2050; s.tick = 92; s.quarter = 1; s.company.cash = 1_000 * M;
    s.world.releases = ['atlas', 'bench', 'compiler', 'release', 'federation', 'neural', 'commons', 'abundance']; s.world.rivals = [];
    s.regions[0]!.levels.network = 4;
    s.cohorts.push({ id: 'prior-care', profileId: 'prior-residents', regionId: 'pacific', programId: 'autoimmune-care', count: 350_000, start: 88, age: 54, version: 1, response: .7, durability: 7, annualGain: .1, harm: .01, continuity: 1, experienced: 0, remaining: 0, baselineDelay: 10, alive: 350_000, history: [] });
    const actions = [{ type: 'build' as const, regionId: 'pacific', family: 'clinic' as const }, { type: 'build' as const, regionId: 'pacific', family: 'followup' as const }];
    const preview = previewPlan(s, actions); let actual = commitPlan(s, actions);
    for (let q = 0; q < 4; q++) actual = advanceQuarter(actual);
    const starts = actual.cohorts.filter(c => c.start >= 92).reduce((n, c) => n + c.count, 0);
    expect(starts).toBeGreaterThan(0);
    expect(starts).toBeGreaterThanOrEqual(preview.careLow * .99);
    expect(starts).toBeLessThanOrEqual(preview.careHigh * 1.01);
  });
});


it('records the investor dilution path through priced rounds and the option top-up',()=>{const state=createCampaign();const terms={cash:1800000000,preMoney:7200000000,poolTopup:0,credits:0,founderSeats:3,strategicControl:false};state.company=issueEquity(state.company,{...terms,id:'first',name:'First'},2028);state.company=issueEquity(state.company,{...terms,id:'next',name:'Next',cash:4000000000,preMoney:8000000000,poolTopup:.15},2032);const history=investorDilutionHistory(state,'first',100000000);expect(history).toHaveLength(2);expect(history[0].ownership).toBeCloseTo(1/90,12);expect(history[1].ownership).toBeCloseTo(sliceRound(state,'first',100000000).ownership,12);expect(history[1].ownership).toBeLessThan(history[0].ownership);});

it('labels forecast periods from the next unresolved quarter, including the 2051 endpoint',()=>{const s=createCampaign();expect(forecastCompany(s).map(y=>y.year)).toEqual([2027,2028,2029,2030,2031]);s.year=2050;s.tick=96;expect(forecastCompany(s).map(y=>y.year)).toEqual([2051,2052,2053,2054,2055]);});


it('a payer forecast reports matching delivery separately from all-program care',()=>{let s=createCampaign();s.year=2028;s.tick=4;s=commitPlan(s,[{type:'deal',dealId:'payer',variant:0},{type:'wait'}]);const y=forecastCompany(s,'base',true)[0];const contract=s.company.contracts.find(c=>c.family==='payer')!;expect(y.contractStarts![contract.id]).toBeGreaterThan(0);expect(y.contractStarts![contract.id]).toBeLessThan(y.starts!);expect(y.contractStarts![contract.id]).toBeLessThanOrEqual(contract.capacity);s.phase='planning';const preview=previewPlan(s,[{type:'wait'},{type:'wait'}]);expect(preview.summary.some(t=>t.includes('projected matching autoimmune-care'))).toBe(true);});
