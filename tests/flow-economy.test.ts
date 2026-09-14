import {describe, expect, it} from 'vitest';
import {COSTS, OPERATING_RATES, initialCompany, investorPosition, operatingAccount, quoteCompany, raiseCompany, studyInstallment, valueCompany} from '../src/flow/economy';
import {FLOW_VERSION, type Candidate, type Projection, type State, type Study} from '../src/flow/types';
import {allocateExit} from '../src/world/economy';
import {asNumber, div, q, sum} from '../src/world/rational';

const M = 100_000_000;
const candidate: Candidate = {generation: 0, response: .6, annualGain: .1, durability: 5, harm: .01, predictionConfidence: .6};

function state(): State {
  return {version: FLOW_VERSION, seed: 2027, scenario: 'fast', month: 0, status: 'active', company: initialCompany(),
    population: {total: 100_000, unassessed: 90_000, ineligible: 0, waiting: 10_000, baselineCare: 0, nextPerson: 0, pendingTests: []},
    cohorts: [], products: [
      {id: 'partner-biologic', name: 'Partner biologic', kind: 'fixed', description: '', available: true, candidate, authorized: candidate, rights: 'delivery', studies: [], readoutGeneration: null, readoutPassed: false, validation: 0},
      {id: 'immune-reset', name: 'Immune reset', kind: 'personalized', description: '', available: true, candidate, authorized: null, rights: 'none', studies: [], readoutGeneration: null, readoutPassed: false, validation: 0},
    ], network: {licensed: true, supply: 120, clinic: 120, tests: 180, followupEmployees: 6, trialTeam: false},
    projects: [], world: {generation: 0, compute: 1, outsideAccess: .2, biology: 1, signal: '', rival: ''},
    policy: {funded: false, accepted: false}, labDeal: false, creditsUsed: 0, events: [], accounts: [], commands: [],
    health: {expected: 0, experienced: 0, remaining: 0, people: 0, tailError: 0}, lastStop: '', firstDeliveryReported: false, capacityNotice: '', roundMonth: null};
}

function allocation(overrides: Partial<Projection> = {}): Projection {
  return {starts: 60, trialStarts: 0, tests: 120, testResults: 0, medicine: 60,
    followupRequired: 100, followupCapacity: 360, followupDelivered: 100, clinicUsed: 60,
    clinicCapacity: 120, testingCapacity: 180, supplyCapacity: 120, limiter: 'clinic', reason: '',
    receipts: 0, costs: 0, cashFlow: -1.5 * M, payroll: 0, corporate: 1.5 * M, research: 0,
    employees: 16, partnerEmployees: 8, ...overrides};
}

function study(overrides: Partial<Study> = {}): Study {
  return {id: 'p1-reset-0', productId: 'immune-reset', generation: 0, mode: 'own', started: 0,
    stage: 'preparation', preparationLeft: 2, target: 40, enrolled: 0, observationMonths: 6, observed: 0,
    analysisLeft: 1, totalBudget: COSTS.ownedStudy, dbBudget: COSTS.ownedStudy, paid: 0, installments: 11,
    response: null, harm: null, candidate, ...overrides};
}

describe('flow corporate underwriting and exact capitalization', () => {
  it('starts at $250M pre-money and $5M cash, independent of the micro-network DCF', () => {
    const s = state();
    expect(s.company.cash).toBe(5 * M);
    expect(quoteCompany(s, allocation()).preMoney).toBe(250 * M);
    expect(quoteCompany(s, allocation()).maxRaise).toBe(75 * M);
    expect(valueCompany(s, allocation()).equity).toBe(0);
  });

  it('a $50M raise coherently becomes $300M post-money with one cash addition', () => {
    const s = state(), original = structuredClone(s);
    s.company = raiseCompany(s, 50 * M, quoteCompany(s, allocation()).preMoney);
    expect(s.company.cash).toBe(55 * M);
    expect(s.company.rounds[0]!.preMoney).toBe(250 * M);
    expect(s.company.rounds[0]!.postMoney).toBe(300 * M);
    expect(quoteCompany(s, allocation()).preMoney).toBe(300 * M);
    expect(original.company.rounds).toHaveLength(0);
    expect(s.company.classes.at(-1)!.shares).toBe('20');
    expect(s.company.founderSeats).toBe(3);
    expect(s.company.strategicControl).toBe(false);
  });

  it('opening raise size is editable rather than fixed 20% dilution', () => {
    for (const amount of [25, 50, 75]) {
      const s = state(); s.company = raiseCompany(s, amount * M);
      const classes = s.company.classes;
      const investorFraction = asNumber(div(q(classes.at(-1)!.shares), sum(classes.map(c => q(c.shares)))));
      expect(investorFraction).toBeCloseTo(amount / (250 + amount), 14);
    }
    expect(() => raiseCompany(state(), 24 * M)).toThrow(/between/);
    expect(() => raiseCompany(state(), 76 * M)).toThrow(/between/);
    expect(() => raiseCompany(state(), 25 * M + .5)).toThrow(/integer/);
  });

  it('freezes a supplied pre-plan offer despite action ordering', () => {
    const s = state(), quoted = quoteCompany(s, allocation()).preMoney;
    const financingFirst = raiseCompany(s, 50 * M, quoted);
    financingFirst.cash -= COSTS.license;
    const operationsFirst = structuredClone(s); operationsFirst.company.cash -= COSTS.license;
    const financed = raiseCompany(operationsFirst, 50 * M, quoted);
    expect(financed).toEqual(financingFirst);
  });

  it('does not allow another closed financing round in the same month', () => {
    const s = state(); s.roundMonth = 0;
    expect(() => raiseCompany(s, 50 * M)).toThrow(/already closed/);
  });

  it('retains founder authority below 25% economics without granting a veto', () => {
    const s = state();
    for (let round = 0; round < 10; round++) {
      s.month = round; s.roundMonth = null;
      s.company = raiseCompany(s, 75 * M, 250 * M);
    }
    const founders = s.company.classes.find(c => c.id === 'founders')!;
    expect(asNumber(div(q(founders.shares), sum(s.company.classes.map(c => q(c.shares)))))).toBeLessThan(.25);
    expect(s.company.control).toBe('retained');
    expect(s.company.founderSeats).toBe(3);
    expect(s.company.strategicControl).toBe(false);
  });

  it('does not repair an actual existing control loss through financing', () => {
    const s = state(); s.company.control = 'lost';
    expect(raiseCompany(s, 50 * M).control).toBe('lost');
  });

  it('prices actual evidence, not announcing a trial or an AI release', () => {
    const s = state(), original = quoteCompany(s, allocation()).preMoney;
    s.world.generation = 5; s.world.biology = 100; s.world.compute = 1_000;
    s.products[1]!.studies.push(study()); s.products[1]!.rights = 'owned';
    expect(quoteCompany(s, allocation()).preMoney).toBe(original);
    s.products[1]!.studies[0]!.stage = 'passed';
    expect(quoteCompany(s, allocation()).preMoney).toBe(original + 80 * M);
    s.products[1]!.studies.push(study({id: 'second', stage: 'passed', generation: 1}));
    expect(quoteCompany(s, allocation()).preMoney).toBe(original + 80 * M);
    expect(quoteCompany(s, allocation()).reasons.join(' ')).toMatch(/new AI release.*adds no financing value/);
  });

  it('distinguishes owned assets, co-development and sponsored-site execution', () => {
    const s = state(); s.products[1]!.studies = [study({stage: 'passed', mode: 'codevelop'})];
    expect(quoteCompany(s, allocation()).preMoney).toBe(295 * M);
    s.products[1]!.studies[0]!.mode = 'sponsored';
    expect(quoteCompany(s, allocation()).preMoney).toBe(258 * M);
    s.products[1]!.rights = 'owned'; s.products[1]!.studies[0]!.stage = 'failed';
    expect(quoteCompany(s, allocation()).preMoney).toBe(210 * M);
  });

  it('uses settled clinic contribution and names the underwriting drivers', () => {
    const s = state();
    s.accounts.push(operatingAccount(s, allocation()));
    const quote = quoteCompany(s, allocation());
    expect(quote.preMoney).toBeGreaterThan(250 * M);
    expect(quote.drivers.map(d => d.label)).toContain('Delivered clinic contribution');
    expect(quote.drivers.map(d => d.label)).toContain('Funding risk');
    const withoutSettled = state();
    expect(quoteCompany(withoutSettled, allocation({starts: 10_000, receipts: 1_000 * M})).preMoney).toBe(250 * M);
  });

  it('shows distress, completed validation, and accepted policy separately', () => {
    const s = state(); s.month = 6; s.company.cash = 2 * M;
    const before = quoteCompany(s, allocation());
    expect(before.preMoney).toBeLessThan(250 * M);
    expect(before.drivers.at(-1)!.value).toMatch(/35% discount/);
    s.products[1]!.validation = 1; s.policy.accepted = true;
    expect(quoteCompany(s, allocation()).preMoney - before.preMoney).toBe(25 * M * .65);
  });
});

describe('flow operating accounts and full commitments', () => {
  it('settles real receipts and exhaustive cost lines without corporate hiding site margin', () => {
    const s = state(), p = allocation(), account = operatingAccount(s, p);
    expect(account.receipts).toBe((60 * 12_000 + 100 * 250) * 100);
    expect(account.medicine).toBe(60 * 6_000 * 100);
    expect(account.payroll).toBe(16 * 12_000 * 100);
    expect(account.testing).toBe(120 * 200 * 100);
    expect(account.corporate).toBe(1.5 * M);
    expect(account.costs).toBe(account.payroll + account.medicine + account.testing + account.corporate + account.research + account.royalties);
    expect(account.receipts - account.costs + account.corporate).toBeGreaterThan(0);
    expect(account.cashFlow).toBe(account.receipts - account.costs);
  });

  it('offers $12M full Phase 1 commitment, $3M DB co-development share and $0.5M sponsored share', () => {
    expect(COSTS.ownedStudy).toBe(12 * M);
    expect(COSTS.codevelopStudy).toBe(3 * M);
    expect(COSTS.sponsoredStudy).toBe(.5 * M);
    const s = state(); s.products[1]!.studies = [study()];
    const first = studyInstallment(s);
    expect(first).toBe(Math.ceil(12 * M / 11));
    const clinical = s.products[1]!.studies[0]!;
    let paid = 0;
    for (let i = 0; i < 20; i++) {const next = studyInstallment(s); paid += next; clinical.paid += next;}
    expect(paid).toBe(12 * M);
    expect(studyInstallment(s)).toBe(0);
  });

  it('does not re-charge ended studies or double-charge trial medicine inside CMC', () => {
    const s = state(); s.products[1]!.studies = [study({stage: 'stopped'})];
    expect(studyInstallment(s)).toBe(0);
    const care = operatingAccount(s, allocation({trialStarts: 20}));
    expect(care.medicine).toBe(60 * OPERATING_RATES.startMedicine);
  });

  it('sponsored services earn only finite actual enrollment and observation fees', () => {
    const s = state(); s.products[1]!.studies = [study({mode: 'sponsored', dbBudget: COSTS.sponsoredStudy, stage: 'recruitment'})];
    const active = s.products[1]!.studies[0]!;
    let earned = 0;
    for (let month = 0; month < 2; month++) {
      const a = operatingAccount(s, allocation({starts: 0, followupDelivered: 0, trialStarts: 20, sponsoredTrialStarts: 20}));
      earned += a.receipts; active.enrolled += 20;
    }
    active.stage = 'observation';
    for (let month = 0; month < 6; month++) {
      earned += operatingAccount(s, allocation({starts: 0, followupDelivered: 0, sponsoredObservation: 40})).receipts;
      active.observed++;
    }
    expect(earned).toBe(1.96 * M);
    expect(() => operatingAccount(s, allocation({sponsoredObservation: 40}))).toThrow(/actual contracted/);
    active.stage = 'passed';
    expect(operatingAccount(s, allocation({starts: 0, followupDelivered: 0})).receipts).toBe(0);
  });

  it('restricted AI credits are not cash, wages, medicines or free trial budgets', () => {
    const s = state(); s.products[1]!.studies = [study()];
    const before = operatingAccount(s, allocation());
    s.company.credits = 100 * M;
    expect(operatingAccount(s, allocation())).toEqual(before);
    expect(s.company.cash).toBe(5 * M);
    expect(quoteCompany(s, allocation()).preMoney).toBe(250 * M);
  });

  it('rejects invented sponsor receipts, fractional staff, and unlicensed delivery', () => {
    expect(() => operatingAccount(state(), allocation({sponsoredTrialStarts: 1}))).toThrow();
    expect(() => operatingAccount(state(), allocation({employees: 1.5}))).toThrow(/whole count/);
    const s = state(); s.network.licensed = false;
    expect(() => operatingAccount(s, allocation())).toThrow(/licensed/);
  });
});

describe('flow DCF and illustrative investor accounting', () => {
  it('values no free pipeline approval, AI premium, or restricted credits', () => {
    const s = state(), p = allocation(), before = valueCompany(s, p);
    s.world.generation = 9; s.world.biology = 1_000; s.company.credits = 1_000 * M;
    s.products[1]!.candidate = {...candidate, response: .99, annualGain: 1, durability: 50};
    expect(valueCompany(s, p)).toEqual(before);
    expect(before.discount).toBe(.15); expect(before.multiple).toBe(8);
    expect(before.forecast).toHaveLength(5);
    expect(before.explanation.join(' ')).toMatch(/No future approval/);
  });

  it('counts cash and debt once, and excludes financing from operating forecasts', () => {
    const s = state();
    s.network = {...s.network, clinic: 2400, supply: 1000, tests: 1400, followupEmployees: 100};
    s.company.cash = 100 * M;
    const p = allocation({starts: 1000, tests: 1400, employees: 300, clinicCapacity: 2400, supplyCapacity: 1000, testingCapacity: 1400, followupCapacity: 6000});
    const before = valueCompany(s, p);
    s.company = raiseCompany(s, 50 * M, 250 * M);
    const after = valueCompany(s, p);
    expect(after.enterprise).toBe(before.enterprise);
    expect(after.equity - before.equity).toBe(50 * M);
    expect(after.forecast.map(r => r.receipts)).toEqual(before.forecast.map(r => r.receipts));
    s.company.debt = 10 * M;
    expect(valueCompany(s, p).equity).toBe(after.equity - 10 * M);
  });

  it('caps snapshot commercial starts by the existing untreated pool', () => {
    const s = state(); s.population.unassessed = 0; s.population.waiting = 75;
    const value = valueCompany(s, allocation({starts: 60}));
    expect(value.forecast.reduce((n, row) => n + row.starts!, 0)).toBe(75);
  });

  it('protects finite follow-up capacity and ends receipts when a course completes', () => {
    const s = state(); s.population.waiting = 1_000; s.population.unassessed = 0; s.network.followupEmployees = 1;
    const value = valueCompany(s, allocation({starts: 60, tests: 60, followupCapacity: 60, employees: 11}));
    // Sixty people occupy the only team's 60 monthly visits for six months.
    expect(value.forecast[0]!.starts).toBe(120);
    expect(value.forecast[0]!.receipts).toBe((120 * 12_000 + 720 * 250) * 100);
    s.population.waiting = 0;
    s.cohorts = [{id: 'finished-soon', firstPerson: 0, count: 60, productId: 'partner-biologic', generation: 0, startMonth: -5, candidate, trialId: null, alive: 60, experienced: 0, remaining: 0, continuity: 1, age: 50, followupMonths: 6}];
    const ending = valueCompany(s, allocation({starts: 0, tests: 0, followupCapacity: 60, employees: 11}));
    expect(ending.forecast[0]!.receipts).toBe(60 * 250 * 100);
    expect(ending.forecast[1]!.receipts).toBe(0);
  });

  it('does not bill ordinary care on top of trial observation services', () => {
    const s = state(); s.products[1]!.studies = [study({mode: 'sponsored', stage: 'observation', enrolled: 40, dbBudget: COSTS.sponsoredStudy})];
    const account = operatingAccount(s, allocation({starts: 0, followupDelivered: 40, commercialFollowups: 0, sponsoredObservation: 40}));
    expect(account.followups).toBe(40);
    expect(account.receipts).toBe(40 * OPERATING_RATES.sponsorObservation);
    expect(account.commercialFollowups).toBe(0);
  });

  it('charges only remaining trial commitments and excludes one-off fees from residual', () => {
    const s = state(); s.products[1]!.studies = [study({mode: 'sponsored', dbBudget: .5 * M, paid: .4 * M})];
    const p = allocation({starts: 0, tests: 0, followupDelivered: 0, employees: 0});
    const funded = valueCompany(s, p);
    const noStudy = structuredClone(s); noStudy.products[1]!.studies = [];
    const baseline = valueCompany(noStudy, p);
    expect(funded.forecast[0]!.operations - baseline.forecast[0]!.operations).toBe(.1 * M);
    expect(funded.forecast[0]!.receipts).toBe(1.96 * M);
    expect(funded.residual).toBe(0);
    expect(funded.forecast[4]!.recurring).toBe(baseline.forecast[4]!.recurring);
  });

  it('illustrative checks do not mutate cash, shares, the round, or gameplay', () => {
    const s = state(); s.company = raiseCompany(s, 50 * M);
    const original = structuredClone(s), value = {...valueCompany(s, allocation()), equity: 300 * M, low: 150 * M, high: 600 * M};
    const round = s.company.rounds[0]!;
    const first = investorPosition(s, value, round.id, 1 * M);
    const second = investorPosition(s, value, round.id, 2 * M);
    expect(s).toEqual(original);
    expect(first.initialOwnership).toBeCloseTo(1 / 300, 14);
    expect(second.ownership).toBeCloseTo(2 * first.ownership, 14);
    expect(first.proceeds).toBe(1 * M);
    expect(first.multiple).toBe(1);
    expect(() => investorPosition(s, value, round.id, 51 * M)).toThrow(/fit inside/);
  });

  it('later rounds dilute the same exact investor holding, without an automatic follow-on', () => {
    const s = state(); s.company = raiseCompany(s, 50 * M);
    const roundId = s.company.rounds[0]!.id;
    const value = {...valueCompany(s, allocation()), equity: 300 * M};
    const before = investorPosition(s, value, roundId, M);
    s.month = 12; s.company = raiseCompany(s, 75 * M, 300 * M);
    const after = investorPosition(s, value, roundId, M);
    expect(after.shares).toBe(before.shares);
    expect(after.initialOwnership).toBe(before.initialOwnership);
    expect(after.ownership).toBeCloseTo(before.ownership * 300 / 375, 14);
    expect(after.check).toBe(M);
  });

  it('whole-table preferred conversion conserves every cent at low and high exits', () => {
    const s = state(); s.company = raiseCompany(s, 50 * M); s.month = 6;
    s.company = raiseCompany(s, 75 * M, 300 * M);
    for (const exit of [0, 1, 100, 80 * M, 125 * M, 375 * M, 10_000 * M]) {
      expect(allocateExit(exit, s.company.classes).reduce((n, allocation) => n + allocation.proceeds, 0)).toBe(exit);
      expect(s.company.control).toBe('retained');
    }
  });
});
