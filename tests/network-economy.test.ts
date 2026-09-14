import { describe, expect, it } from 'vitest';
import type { CompanyValue } from '../src/core/types';
import type { Facility, Projection, State } from '../src/network/types';
import { financedCompany, forecastNetwork, fundraiseQuote, initialNetworkCompany, investorPosition, operatingAccount, operatingRates, type NetworkForecastProjection } from '../src/network/economy';
import { allocateExit, issueEquity, shareFraction } from '../src/world/economy';

const USD = 100, M = 1_000_000 * USD;
function clinic(overrides: Partial<Facility> = {}): Facility {
  return { id: 'clinic', name: 'Riverside Clinic', kind: 'clinic', region: 0, x: 0, y: 0, owner: 'db', status: 'operating', units: 1, capacity: 80, employees: 6, basis: 600_000 * USD, readyAt: 0, delivery: 'clinic', programId: 'routine', trialTeam: false, lastStarts: 80, lastFollowup: 240, lastRevenue: 616_000 * USD, lastCosts: 484_000 * USD, limiting: '', description: 'Treats patients and provides follow-up.', ...overrides };
}
function state(): State {
  const s: State = {
    version: 'network-2.2', seed: 2027, scenario: 'convergence', tick: 0, status: 'active', company: initialNetworkCompany(),
    facilities: [clinic()], links: [], regions: [], programs: [],
    world: { generation: 1, compute: 1, biology: 1, counterfactualAccess: 0, releases: [], nextSignal: '', localMakers: false, homeCare: false, homeMakers: false, wearables: false, rivals: [] },
    policy: { support: 0, stage: 'product', campaignSpend: 0, window: 0, nextWindow: 8, pendingStage: null, effectiveAt: 0, recognized: false },
    cohorts: [], health: { expected: 0, experienced: 0, remaining: 0, people: 0, low: 0, high: 0, tailError: 0 }, projects: [], events: [],
    account: { tick: 0, starts: 0, followup: 0, revenue: 0, costs: 0, payroll: 0, supplies: 0, research: 0, central: 0, cashFlow: 0, employees: 10, partnerEmployees: 0, healthAdded: 0 },
    accounts: [], commands: [], historicalFollowup: 240, creditsUsed: 0, publicCompany: false, partnerships: [], cureUntil: null,
  };
  s.account = operatingAccount(s, { clinic: 80 }, { clinic: 240 }, 150_000 * USD);
  return s;
}
function projection(s: State): Projection {
  return { starts: s.account.starts, revenue: s.account.revenue, costs: s.account.costs, cashFlow: s.account.cashFlow, employees: s.account.employees, partnerEmployees: s.account.partnerEmployees, limiting: [] };
}
function value(equity: number): CompanyValue {
  return { enterprise: equity, equity, low: Math.floor(equity / 2), high: equity * 2, residual: 0, residualShare: 0, discount: .15, multiple: 8, forecast: [], fundingGap: 0, explanation: [] };
}

describe('network operating account', () => {
  it('reconciles the opening business and counts employees without partner gross billings', () => {
    const s = state();
    expect(s.company.cash).toBe(1.8 * M);
    expect(s.company.classes.map(c => shareFraction(s.company.classes, c.id))).toEqual([.8, .1, .1]);
    expect(s.company.rounds).toEqual([]);
    expect(s.account).toMatchObject({ starts: 80, followup: 240, revenue: 616_000 * USD, supplies: 264_000 * USD, payroll: 180_000 * USD, central: 75_000 * USD, research: 150_000 * USD, costs: 709_000 * USD, cashFlow: -93_000 * USD, employees: 10, partnerEmployees: 0 });
    const baseline = JSON.stringify(s);
    expect(operatingAccount(s, { clinic: 80 }, { clinic: 240 }, 150_000 * USD)).toEqual(s.account);
    expect(JSON.stringify(s)).toBe(baseline);
  });
  it('books only DB fees for partner-delivered care and reports the separate workforce', () => {
    const s = state();
    s.facilities.push(clinic({ id: 'partner', owner: 'partner', kind: 'hospital', units: 2, employees: 2, capacity: 160 }));
    const next = operatingAccount(s, { clinic: 80, partner: 160 }, { clinic: 240, partner: 480 }, 150_000 * USD);
    expect(next.revenue - s.account.revenue).toBe((160 * 900 + 480 * 100) * USD);
    expect(next.cashFlow - s.account.cashFlow).toBe(81_000 * USD);
    expect(next.employees).toBe(12); expect(next.partnerEmployees).toBe(12);
  });
  it('pays idle staff and premises but cannot earn care revenue from a factory or unbuilt site', () => {
    const s = state();
    const idle = operatingAccount(s, {}, {});
    expect(idle.revenue).toBe(0); expect(idle.costs).toBe(295_000 * USD);
    s.facilities[0]!.status = 'building';
    expect(() => operatingAccount(s, { clinic: 10 }, {})).toThrow(/non-operating/);
    s.facilities[0] = clinic({ kind: 'factory' });
    expect(() => operatingAccount(s, { clinic: 10 }, {})).toThrow(/does not administer/);
    expect(() => operatingAccount(s, { missing: 1 }, {})).toThrow(/Unknown care site/);
  });
  it('credits finite internal factory shipments only once and includes its real workforce', () => {
    const s = state();
    s.facilities.push(clinic({ id: 'factory', kind: 'factory', employees: 8, capacity: 50 }));
    s.links = [
      { id: 'a', from: 'factory', to: 'clinic', active: true, kind: 'medicine', capacity: 80, lastFlow: 80 },
      { id: 'b', from: 'factory', to: 'clinic', active: true, kind: 'medicine', capacity: 80, lastFlow: 80 },
    ];
    const next = operatingAccount(s, { clinic: 80 }, { clinic: 240 }, 150_000 * USD);
    expect(next.supplies).toBe(s.account.supplies - 50 * 450 * USD);
    expect(next.revenue).toBe(s.account.revenue);
    expect(next.costs - s.account.costs).toBe((8 * 30_000 + 60_000 - 50 * 450) * USD);
    expect(next.employees).toBe(18);
  });
  it('makes local production and home services explicit without monetizing efficacy', () => {
    expect(operatingRates(clinic({ delivery: 'local' })).startReceipt).toBe(6_500 * USD);
    expect(operatingRates(clinic({ delivery: 'local' })).startCost).toBe(2_250 * USD);
    expect(operatingRates(clinic({ delivery: 'home' })).startReceipt).toBe(2_200 * USD);
    expect(operatingRates(clinic({ delivery: 'wearable' })).followupReceipt).toBe(120 * USD);
    const s = state(), stronger = structuredClone(s);
    stronger.world.biology = 1000; stronger.health.expected = 1e9;
    expect(operatingAccount(stronger, { clinic: 80 }, { clinic: 240 }, 150_000 * USD)).toEqual(s.account);
  });
  it('discounts earned payer receipts before calculating royalties', () => {
    const s = state(); s.partnerships.push('payer'); s.company.royalty = .1;
    const account = operatingAccount(s, { clinic: 80 }, { clinic: 240 }, 150_000 * USD);
    expect(account.revenue).toBe(554_400 * USD);
    expect(account.supplies).toBe((264_000 + 55_440) * USD);
    expect(account.cashFlow).toBe(account.revenue - account.costs);
    expect(operatingAccount(s, {}, {}, 0).revenue).toBe(0);
  });
});

describe('network fundraising and exact investor illustration', () => {
  it('offers an adjustable raise at a venture price separate from operating value', () => {
    const s = state();
    expect(fundraiseQuote(s).preMoney).toBe(8.5 * M);
    const small = financedCompany(s, .5 * M, 'protected'), large = financedCompany(s, 1.5 * M, 'protected');
    expect(s.company.rounds).toHaveLength(0);
    expect(small.cash - s.company.cash).toBe(.5 * M);
    expect(large.rounds[0]!.preMoney).toBe(8.5 * M);
    expect(shareFraction(large.classes, large.rounds[0]!.classId)).toBeCloseTo(.15, 12);
    expect(shareFraction(small.classes, small.rounds[0]!.classId)).toBeCloseTo(.5 / 9, 12);
    expect(() => financedCompany(s, 99_999 * USD)).toThrow(/100,000/);
    expect(() => financedCompany(s, fundraiseQuote(s).maxRaise + 1)).toThrow(/maximum/);
  });
  it('responds to actual evidence, operating proof and runway, not model headlines or announcements', () => {
    const s = state(), stronger = structuredClone(s);
    stronger.world.biology = 1000; stronger.world.generation = 20;
    expect(fundraiseQuote(stronger).preMoney).toBe(fundraiseQuote(s).preMoney);
    const candidate = { generation: 1, response: .5, annualGain: .5, durability: 5, harm: .02, predictionConfidence: .5 };
    stronger.programs.push({ id: 'immune', name: 'Immune reset', description: '', family: 'autoimmune', kind: 'fixed', modality: 'protein', availableAt: 0, stage: 'phase1', candidate, frontier: candidate, study: null, evidence: 0, authorizedGeneration: 0, authorizedCandidate: null, lastResult: '', starts: 0, developmentSpend: M, platformEligible: false });
    expect(fundraiseQuote(stronger).preMoney).toBe(fundraiseQuote(s).preMoney);
    stronger.programs[0]!.evidence = .55;
    expect(fundraiseQuote(stronger).preMoney).toBeGreaterThan(fundraiseQuote(s).preMoney);
    const distressed = structuredClone(s); distressed.company.cash = 10_000 * USD;
    expect(fundraiseQuote(distressed).preMoney).toBeLessThan(fundraiseQuote(s).preMoney);
    const commercial = structuredClone(s); commercial.account.revenue *= 2; commercial.account.cashFlow += s.account.revenue;
    expect(fundraiseQuote(commercial).preMoney).toBeGreaterThan(fundraiseQuote(s).preMoney);
  });
  it('keeps economic dilution distinct from explicit control-transfer terms', () => {
    const s = state();
    const safe = financedCompany(s, M, 'protected'), control = financedCompany(s, M, 'control'), growth = financedCompany(s, M, 'growth');
    expect(safe.founderSeats).toBe(3); expect(safe.strategicControl).toBe(false);
    expect(control.founderSeats).toBe(1); expect(control.strategicControl).toBe(true); expect(control.rounds[0]!.preMoney).toBeGreaterThan(safe.rounds[0]!.preMoney);
    expect(shareFraction(growth.classes, 'option-pool')).toBeCloseTo(.1, 14);
    const afterControl = { ...s, company: control };
    expect(financedCompany(afterControl, M, 'protected').strategicControl).toBe(true);
  });
  it('retains board and strategic authority after a $3M founder-protected round in 2030Q3', () => {
    const s = state(); s.tick = 14;
    const company = financedCompany(s, 3 * M, 'protected');
    expect(company.rounds[0]!.year).toBe(2030);
    expect(company.rounds[0]!.raised).toBe(3 * M);
    expect(company.founderSeats).toBe(3);
    // The shared boolean means authority has been transferred when TRUE.
    expect(company.strategicControl).toBe(false);
    expect(company.control).toBe('retained');
    expect(company.ceo).toBe(true);
    expect(s.company.rounds).toHaveLength(0);
  });
  it('slices the recorded round, dilutes later, and never changes funds or capitalization', () => {
    const s = state(); s.company = financedCompany(s, M);
    const id = s.company.rounds[0]!.id, saved = JSON.stringify(s), valuation = value(20 * M);
    const half = investorPosition(s, valuation, id, .5 * M), whole = investorPosition(s, valuation, id, M);
    expect(half.initialOwnership).toBeCloseTo(.5 / 9.5, 14);
    expect(half.ownership * 2).toBeCloseTo(whole.ownership, 14);
    expect(half.proceeds * 2).toBeLessThanOrEqual(whole.proceeds);
    expect(whole.proceeds - half.proceeds * 2).toBeLessThanOrEqual(1);
    expect(JSON.stringify(s)).toBe(saved);
    s.company = issueEquity(s.company, { id: 'later', cash: 3 * M, preMoney: 15 * M }, 2030);
    const after = investorPosition(s, valuation, id, .5 * M);
    expect(after.initialOwnership).toBe(half.initialOwnership);
    expect(after.ownership).toBeCloseTo(half.ownership * 15 / 18, 14);
    expect(() => investorPosition(s, valuation, id, M + 1)).toThrow(/fit/);
    expect(() => investorPosition(s, valuation, 'future', 0)).toThrow(/recorded/);
  });
  it('uses one compatible preference allocation and conserves available proceeds', () => {
    const s = state(); s.company = financedCompany(s, M);
    s.company = issueEquity(s.company, { id: 'later', cash: 3 * M, preMoney: 15 * M }, 2030);
    for (const proceeds of [0, 1, 5_000_001, 4 * M, 10 * M, 100 * M]) {
      const allocation = allocateExit(proceeds, s.company.classes);
      expect(allocation.reduce((n, a) => n + a.proceeds, 0)).toBe(proceeds);
      for (const round of s.company.rounds) expect(investorPosition(s, value(proceeds), round.id, round.raised).proceeds).toBe(allocation.find(a => a.classId === round.classId)!.proceeds);
    }
  });
});

describe('bounded network operating valuation', () => {
  it('reconciles cash and debt once and keeps restricted credits and healthspan out of DCF', () => {
    const s = state(), p = projection(s), before = JSON.stringify(s), a = forecastNetwork(s, p);
    expect(a.equity).toBe(Math.max(0, a.enterprise + s.company.cash));
    expect(a.residual).toBe(8 * Math.max(0, a.forecast[4]!.recurring));
    expect(a.enterprise).toBe(Math.round(a.forecast.reduce((n, y, i) => n + y.freeCash / 1.15 ** (i + 1), 0) + a.residual / 1.15 ** 5));
    expect(a.low).toBeLessThanOrEqual(a.equity); expect(a.high).toBeGreaterThanOrEqual(a.equity);
    expect(JSON.stringify(s)).toBe(before);
    const b = structuredClone(s); b.company.credits = 1000 * M; b.health.expected = 1e12;
    expect(forecastNetwork(b, p)).toEqual(a);
    b.company.cash += 10 * M; b.company.debt = M;
    expect(forecastNetwork(b, p).equity).toBe(Math.max(0, a.enterprise + b.company.cash - b.company.debt));
    expect(forecastNetwork(b, p).enterprise).toBe(a.enterprise);
  });
  it('does not add financing receipts or re-charge already paid construction, and reports gaps', () => {
    const s = state(), p = projection(s), a = forecastNetwork(s, p);
    s.company.cash = 0;
    expect(forecastNetwork(s, p).fundingGap).toBeGreaterThan(a.fundingGap);
    s.projects.push({ id: 'project', name: 'Factory', siteId: 'future', kind: 'factory', readyAt: 4, cost: 50 * M, units: 1 });
    expect(forecastNetwork(s, p).enterprise).toBe(a.enterprise);
    s.company = financedCompany(s, M);
    expect(forecastNetwork(s, p).enterprise).toBe(a.enterprise);
    expect(forecastNetwork(s, p).explanation.join(' ')).toContain('Uncommissioned projects');
  });
  it('extends through 2055 at the endpoint and does not silently initiate another trial', () => {
    const s = state(); s.tick = 92;
    expect(forecastNetwork(s, projection(s)).forecast.map(y => y.year)).toEqual([2051, 2052, 2053, 2054, 2055]);
    const candidate = { generation: 1, response: .5, annualGain: .5, durability: 5, harm: .02, predictionConfidence: .5 };
    s.programs.push({ id: 'immune', name: 'Immune reset', description: '', family: 'autoimmune', kind: 'fixed', modality: 'protein', availableAt: 0, stage: 'phase1', candidate, frontier: candidate, study: { phase: 'phase1', siteId: 'clinic', generation: 1, package: 'focused', started: 91, preparation: 0, target: 24, enrolled: 24, observation: 2, observed: 2, review: 1, paused: false, failed: false, cost: 900_000 * USD, response: .5, harm: .02 }, evidence: .1, authorizedGeneration: 0, authorizedCandidate: null, lastResult: '', starts: 0, developmentSpend: M, platformEligible: false });
    Object.assign(s.programs[0]!.study!, { spent: 750_000 * USD });
    const v = forecastNetwork(s, projection(s));
    expect(v.forecast[0]!.operations - v.forecast[1]!.operations).toBe(150_000 * USD);
    expect(v.forecast[4]!.operations).toBe(v.forecast[1]!.operations);
  });
  it('keeps the terminal tick96 forecast in 2051–2055', () => {
    const s = state(); s.tick = 96;
    expect(forecastNetwork(s, projection(s)).forecast.map(y => y.year)).toEqual([2051, 2052, 2053, 2054, 2055]);
  });
  it('uses committed-network quarterly projections only when their commissioning is reflected', () => {
    const s = state(), p = projection(s);
    const quarters = Array.from({ length: 20 }, (_, i) => ({ ...p, starts: p.starts + (i >= 2 ? 40 : 0), revenue: p.revenue + (i >= 2 ? 200_000 * USD : 0), costs: p.costs + (i >= 2 ? 100_000 * USD : 0) }));
    const before = JSON.stringify([s, quarters]);
    const baseline = forecastNetwork(s, p), committed = forecastNetwork(s, p, quarters);
    expect(committed.forecast[0]!.receipts - baseline.forecast[0]!.receipts).toBe(400_000 * USD);
    expect(committed.forecast[1]!.receipts - baseline.forecast[1]!.receipts).toBe(800_000 * USD);
    expect(committed.forecast[0]!.operations - baseline.forecast[0]!.operations).toBe(200_000 * USD);
    expect(committed.forecast[0]!.starts).toBe(p.starts * 4 + 80);
    expect(committed.forecast[1]!.starts).toBe((p.starts + 40) * 4);
    expect(committed.equity).toBeGreaterThan(baseline.equity);
    expect(committed.explanation.join(' ')).toContain('actual commissioning schedules');
    expect(JSON.stringify([s, quarters])).toBe(before);
    expect(() => forecastNetwork(s, p, quarters.slice(1))).toThrow(/exactly 20/);
  });
  it('does not turn a one-time patient update into repeated research in authored projections', () => {
    const s = state(); s.account.research = 650_000 * USD;
    const p = projection(s), operatingCosts = 559_000 * USD;
    const quarters: NetworkForecastProjection[] = Array.from({ length: 20 }, (_, i) => ({ ...p, costs: operatingCosts + (i === 0 ? 500_000 * USD : 0) + (i < 2 ? 150_000 * USD : 0), research: i < 2 ? 150_000 * USD : 0, maintenanceBasis: 0 }));
    const v = forecastNetwork(s, p, quarters);
    expect(v.forecast[0]!.operations).toBe(4 * operatingCosts + 800_000 * USD);
    expect(v.forecast[1]!.operations).toBe(4 * operatingCosts);
    expect(v.forecast[4]!.operations).toBe(4 * operatingCosts);
    expect(v.forecast.every(y => y.capex === 0)).toBe(true);
    const invalid = structuredClone(quarters); invalid[0]!.research = invalid[0]!.costs + 1;
    expect(() => forecastNetwork(s, p, invalid)).toThrow(/included/);
  });
  it('caps remaining fallback research at unspent phase budget', () => {
    const s = state(), candidate = { generation: 1, response: .5, annualGain: .5, durability: 5, harm: .02, predictionConfidence: .5 };
    s.programs.push({ id: 'immune', name: 'Immune reset', description: '', family: 'autoimmune', kind: 'fixed', modality: 'protein', availableAt: 0, stage: 'phase1', candidate, frontier: candidate, study: { phase: 'phase1', siteId: 'clinic', generation: 1, package: 'focused', started: 0, preparation: 0, target: 24, enrolled: 0, observation: 2, observed: 0, review: 1, paused: false, failed: false, cost: 900_000 * USD, response: null, harm: null }, evidence: 0, authorizedGeneration: 0, authorizedCandidate: null, lastResult: '', starts: 0, developmentSpend: 850_000 * USD, platformEligible: false });
    Object.assign(s.programs[0]!.study!, { spent: 850_000 * USD });
    s.account = operatingAccount(s, { clinic: 80 }, { clinic: 240 }, 50_000 * USD);
    const v = forecastNetwork(s, projection(s));
    expect(v.forecast[0]!.operations - v.forecast[1]!.operations).toBe(50_000 * USD);
    expect(v.forecast[1]!.operations).toBe(4 * 559_000 * USD);
    Object.assign(s.programs[0]!.study!, { spent: 900_000 * USD });
    s.account = operatingAccount(s, { clinic: 80 }, { clinic: 240 }, 0);
    const paid = forecastNetwork(s, projection(s));
    expect(paid.forecast.every(y => y.operations === 4 * 559_000 * USD)).toBe(true);
  });
  it('starts maintenance on paid expansion only when commissioned without charging capex twice', () => {
    const s = state(), p = projection(s);
    s.facilities[0]!.basis += 300_000 * USD;
    s.projects.push({ id: 'expand', name: 'Clinic expansion', siteId: 'clinic', kind: 'expand', readyAt: 2, cost: 300_000 * USD, units: 1 });
    const quarters: NetworkForecastProjection[] = Array.from({ length: 20 }, () => ({ ...p }));
    const v = forecastNetwork(s, p, quarters);
    expect(v.forecast[0]!.capex).toBe(18_750 * USD);
    expect(v.forecast[1]!.capex).toBe(22_500 * USD);
    expect(v.forecast[0]!.operations).toBe(4 * p.costs);
    const explicit = quarters.map((item, i) => ({ ...item, maintenanceBasis: (i < 2 ? 600_000 : 900_000) * USD }));
    expect(forecastNetwork(s, p, explicit).forecast).toEqual(v.forecast);
  });
});
