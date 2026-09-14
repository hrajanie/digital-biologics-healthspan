import type {Company, CompanyValue, ForecastYear, InvestorPosition} from '../core/types';
import type {MonthAccount, Projection, Quote, State, Study} from './types';
import {allocateExit, initialCompany as baseCompany, issueEquity} from '../world/economy';
import {asNumber, cent, div, encode, floor, money, mul, q, sum} from '../world/rational';

const USD = 100;
const M = 1_000_000 * USD;

/** All displayed dollars use these same integer-cent amounts. No game-money scale. */
export const COSTS = {
  license: M, clinic: 2 * M, tests: .5 * M, supply: .5 * M,
  staff: 15_000 * USD, trialTeam: .5 * M, design: M, validation: M,
  labPartnership: .3 * M, policy: 2 * M,
  ownedStudy: 12 * M, codevelopStudy: 3 * M, sponsoredStudy: .5 * M,
} as const;

export const OPERATING_RATES = {
  startReceipt: 12_000 * USD, startMedicine: 6_000 * USD,
  followupReceipt: 250 * USD, test: 200 * USD,
  employeeMonth: 12_000 * USD, corporate: 1.5 * M,
  sponsorEnrollment: 25_000 * USD, sponsorObservation: 4_000 * USD,
} as const;

export function initialCompany(): Company {
  return {...baseCompany(), cash: 5 * M, classes: [
    {id: 'founders', name: 'Founders', shares: '80', invested: 0, preferred: false},
    {id: 'option-pool', name: 'Employee option reserve', shares: '10', invested: 0, preferred: false, reserved: true},
    {id: 'early', name: 'Early backers', shares: '10', invested: 0, preferred: false},
  ]};
}

const activeStudy = (study: Study): boolean => !['passed', 'failed', 'stopped'].includes(study.stage);
const studies = (state: State): Study[] => state.products.flatMap(product => product.studies);
const dollars = (cents: number): string => `${cents < 0 ? '−' : ''}$${(Math.abs(cents) / M).toFixed(1)}M`;

function finiteCount(value: number, label: string): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${label} must be a nonnegative whole count.`);
  return value;
}

/** Full study commitments are known; this returns only this month's remaining installment. */
export function studyInstallment(state: State): number {
  return money(studies(state).filter(activeStudy).reduce((total, study) => {
    money(study.dbBudget, 'DB study commitment'); money(study.paid, 'Paid study budget');
    if (!Number.isSafeInteger(study.installments) || study.installments < 1) throw new RangeError('A study requires at least one installment.');
    return total + Math.min(Math.max(0, study.dbBudget - study.paid), Math.ceil(study.dbBudget / study.installments));
  }, 0));
}

/** Settlement follows actual allocated work. Capacity, credits and financing are not receipts. */
export function operatingAccount(state: State, allocation: Projection): MonthAccount {
  const starts = finiteCount(allocation.starts, 'Commercial starts');
  const trialStarts = finiteCount(allocation.trialStarts, 'Trial starts');
  const tests = finiteCount(allocation.tests, 'Tests');
  const followups = finiteCount(allocation.followupDelivered, 'Delivered follow-up');
  const commercialFollowups = finiteCount(allocation.commercialFollowups ?? followups, 'Commercial follow-up');
  const employees = finiteCount(allocation.employees, 'DB operating employees');
  const sponsorStarts = finiteCount(allocation.sponsoredTrialStarts ?? 0, 'Sponsored trial starts');
  const sponsorObservation = finiteCount(allocation.sponsoredObservation ?? 0, 'Sponsored observation visits');
  if (sponsorStarts > trialStarts) throw new RangeError('Sponsored enrollment cannot exceed actual trial starts.');
  const sponsored = studies(state).filter(study => study.mode === 'sponsored' && activeStudy(study));
  const openEnrollment = sponsored.filter(study => study.stage === 'recruitment').reduce((n, study) => n + Math.max(0, study.target - study.enrolled), 0);
  const openObservation = sponsored.filter(study => study.stage === 'observation' && study.observed < study.observationMonths).reduce((n, study) => n + study.enrolled, 0);
  if (sponsorStarts > openEnrollment || sponsorObservation > openObservation) throw new RangeError('Sponsored fees require actual contracted enrollment or observation work.');
  if (starts > 0 && !state.network.licensed) throw new RangeError('Partner therapy delivery requires licensed supply.');
  if (followups > allocation.followupCapacity) throw new RangeError('Follow-up cannot exceed staffed capacity.');
  if (commercialFollowups > followups) throw new RangeError('Billed commercial follow-up cannot exceed actual visits.');
  const commercialReceipts = starts * OPERATING_RATES.startReceipt + commercialFollowups * OPERATING_RATES.followupReceipt;
  const receipts = money(commercialReceipts + sponsorStarts * OPERATING_RATES.sponsorEnrollment + sponsorObservation * OPERATING_RATES.sponsorObservation);
  const payroll = money(employees * OPERATING_RATES.employeeMonth);
  // Trial-product manufacture is already inside the study's funded CMC budget.
  const medicine = money(starts * OPERATING_RATES.startMedicine);
  const testing = money(tests * OPERATING_RATES.test);
  const research = studyInstallment(state);
  const corporate = OPERATING_RATES.corporate;
  if (!Number.isFinite(state.company.royalty) || state.company.royalty < 0 || state.company.royalty > .95) throw new RangeError('Invalid earned-service royalty.');
  const royalties = cent(commercialReceipts * state.company.royalty);
  const costs = money(payroll + medicine + testing + research + corporate + royalties);
  return {month: state.month, starts, trialStarts, tests, followups, commercialFollowups, receipts, costs, payroll, medicine, testing, research, corporate, royalties, cashFlow: receipts - costs, healthAdded: 0};
}

/** Venture underwriting: an explicit corporate premise, earned evidence, and funding risk. */
export function quoteCompany(state: State, projection: Projection): Quote {
  const records = state.accounts.slice(-3);
  // A planned clinic or trial does not manufacture underwriting evidence.
  const deliveredContribution = records.length ? records.reduce((total, account) => {
    const receipts = account.starts * OPERATING_RATES.startReceipt + (account.commercialFollowups ?? account.followups) * OPERATING_RATES.followupReceipt;
    return total + receipts - account.payroll - account.medicine - account.testing - account.royalties;
  }, 0) / records.length : 0;
  const deliveryValue = cent(Math.max(0, deliveredContribution) * 12 * 5);
  let evidenceValue = 0;
  for (const product of state.products) {
    // Repeating or replacing a generation cannot stack asset values for one product.
    const passed = product.studies.filter(study => study.stage === 'passed');
    if (passed.length) evidenceValue += Math.max(...passed.map(study => study.mode === 'own' ? 80 * M : study.mode === 'codevelop' ? 45 * M : 8 * M));
    else if (product.studies.some(study => study.stage === 'failed')) evidenceValue -= product.rights === 'owned' ? 40 * M : 20 * M;
  }
  const validationValue = state.products.filter(product => product.validation > 0).length * 10 * M;
  const policyValue = state.policy.accepted ? 15 * M : 0;
  const monthlyBurn = Math.max(0, -projection.cashFlow);
  const runway = monthlyBurn > 0 ? Math.max(0, state.company.cash) / monthlyBurn : Infinity;
  // The first opening offer is the authored $250M premise. Later distress is real.
  const opening = state.month === 0 && state.company.rounds.length === 0;
  const risk = opening || runway >= 9 ? 1 : runway >= 6 ? .9 : runway >= 3 ? .8 : .65;
  // Opening $250M equity underwriting consists of $245M corporate scope plus
  // the actual $5M cash. Raising $50M therefore produces a coherent $300M mark.
  const beforeRisk = Math.max(0, 245 * M + state.company.cash - state.company.debt + deliveryValue + evidenceValue + validationValue + policyValue);
  const preMoney = cent(beforeRisk * risk);
  const maxRaise = opening ? 75 * M : cent(Math.min(150 * M, preMoney * .3));
  return {preMoney, maxRaise, drivers: [
    {label: 'Corporate scope premise', value: '$245M'},
    {label: 'Cash less debt', value: dollars(state.company.cash - state.company.debt)},
    {label: 'Delivered clinic contribution', value: `+${dollars(deliveryValue)}`},
    {label: 'Observed Phase 1 evidence', value: `${evidenceValue < 0 ? '' : '+'}${dollars(evidenceValue)}`},
    {label: 'Completed model validation', value: `+${dollars(validationValue)}`},
    {label: 'Accepted regulatory scope', value: `+${dollars(policyValue)}`},
    {label: 'Funding risk', value: risk === 1 ? 'No discount' : `${Math.round((1 - risk) * 100)}% discount · ${runway.toFixed(1)} months cash`},
  ], reasons: [
    'The $250M opening pre-money is a fictional corporate premise: $245M for existing corporate scope plus $5M cash, before the delivery network. It is not a real fundraising offer. New financing cash enters the next equity mark once; subsequent spending reduces it.',
    'Delivered contribution uses up to three settled months: care receipts less site payroll, purchased medicine, testing and earned royalties, annualized at 5×. Corporate spending is shown separately.',
    'Passed Phase 1 evidence supports $80M for an owned asset, $45M for co-development, or $8M for sponsored-site execution. Failed evidence can reduce the offer. Launching or repeating a study does not earn a valuation bonus.',
    'Completed model validation adds $10M per product; accepted regulatory scope adds $15M. A new AI release or faster compute alone adds no financing value.',
    opening ? 'The opening offer permits $25M–$75M. The amount changes dilution; the corporate premise is held fixed for this first offer.' : 'Under nine months of operating cash applies a 10–35% financing-risk discount. A later round can raise $5M up to the displayed maximum.',
    'This venture estimate is separate from the last priced round and installed-network cash-flow value. A $100B future scenario is not a promised result of this short slice.',
  ]};
}

function fallbackProjection(state: State): Projection {
  const last = state.accounts.at(-1);
  return {starts: 0, trialStarts: 0, tests: 0, testResults: 0, medicine: 0, followupRequired: 0, followupCapacity: 0, followupDelivered: 0,
    clinicUsed: 0, clinicCapacity: state.network.clinic, testingCapacity: state.network.tests, supplyCapacity: state.network.supply,
    limiter: 'clinic', reason: '', receipts: last?.receipts ?? 0, costs: last?.costs ?? OPERATING_RATES.corporate,
    cashFlow: last?.cashFlow ?? -OPERATING_RATES.corporate, payroll: last?.payroll ?? 0, corporate: OPERATING_RATES.corporate,
    research: last?.research ?? 0, employees: 0, partnerEmployees: 0};
}

/** Pure issuance. The caller freezes the pre-plan quote before applying any other actions. */
export function raiseCompany(state: State, amount: number, preMoney?: number): Company {
  money(amount, 'Round size');
  const price = money(preMoney ?? quoteCompany(state, fallbackProjection(state)).preMoney, 'Pre-money valuation');
  const opening = state.month === 0 && state.company.rounds.length === 0;
  const minimum = (opening ? 25 : 5) * M;
  const maximum = opening ? 75 * M : cent(Math.min(150 * M, price * .3));
  if (amount < minimum || amount > maximum) throw new RangeError(`Choose a round between ${dollars(minimum)} and ${dollars(maximum)}.`);
  if (state.roundMonth === state.month) throw new RangeError('A financing round has already closed this month.');
  const next = issueEquity(state.company, {
    id: `flow-round-${state.month}-${state.company.rounds.length + 1}`,
    name: opening ? 'Opening founder-protected round' : 'Milestone founder-protected round',
    cash: amount, preMoney: price, founderSeats: state.company.founderSeats,
  }, 2027 + Math.floor(state.month / 12));
  // Economic dilution is not a new strategic consent right or board transfer.
  next.control = state.company.control === 'lost' ? 'lost' : next.founderSeats < 2 || next.strategicControl || !next.ceo ? 'at-risk' : 'retained';
  return next;
}

interface ScheduledStudy {remainingBudget: number;installment: number;remainingService: number;months: number}
function studySchedule(state: State): ScheduledStudy[] {
  return studies(state).filter(activeStudy).map(study => {
    const remainingBudget = Math.max(0, study.dbBudget - study.paid);
    const installment = Math.ceil(study.dbBudget / Math.max(1, study.installments));
    const months = Math.max(1, study.preparationLeft + Math.ceil(Math.max(0, study.target - study.enrolled) / 20) + Math.max(0, study.observationMonths - study.observed) + study.analysisLeft);
    // Only already contracted study services; there are no unapproved therapy sales.
    const remainingService = study.mode === 'sponsored'
      ? Math.max(0, study.target - study.enrolled) * OPERATING_RATES.sponsorEnrollment + study.target * Math.max(0, study.observationMonths - study.observed) * OPERATING_RATES.sponsorObservation
      : 0;
    return {remainingBudget, installment, remainingService, months};
  });
}

/** Conservative five-year snapshot: no future approvals, new sites or AI windfalls. */
function forecast(state: State, projection: Projection, scenario: 'low' | 'base' | 'high'): ForecastYear[] {
  const uptake = scenario === 'low' ? .8 : scenario === 'high' ? 1.1 : 1;
  const receiptFactor = scenario === 'low' ? .9 : scenario === 'high' ? 1.05 : 1;
  const costFactor = scenario === 'low' ? 1.1 : scenario === 'high' ? .95 : 1;
  const schedule = studySchedule(state);
  // Current known people only. The same 75% eligibility assumption as the slice
  // is applied to paid future screens, with the same one-month result delay.
  let waiting = state.population.waiting, unassessed = state.population.unassessed;
  let readyNext = state.population.pendingTests.reduce((n, batch) => n + batch.eligible, 0);
  const followupLots = state.cohorts.map(lot => ({count: lot.count, until: Math.max(0, lot.followupMonths - (state.month - lot.startMonth)), commercial: lot.trialId === null}));
  let cash = state.company.cash, peakGap = Math.max(0, -cash);
  const yearly: ForecastYear[] = [];
  for (let year = 0; year < 5; year++) {
    const row: ForecastYear = {year: 2027 + Math.floor(state.month / 12) + year + 1, starts: 0, receipts: 0, operations: 0, capex: 0, taxes: 0, freeCash: 0, recurring: 0, fundingGap: 0};
    for (let month = 0; month < 12; month++) {
      const elapsed = year * 12 + month;
      waiting += readyNext; readyNext = 0;
      const committed = state.projects.filter(project => project.readyAt <= state.month + elapsed);
      const extraFollowup = committed.filter(project => project.kind === 'staff').reduce((n, project) => n + project.quantity, 0);
      const followupCapacity = (state.network.followupEmployees + extraFollowup) * 60;
      const continuing = state.population.baselineCare + followupLots.filter(lot => lot.until > elapsed).reduce((n, lot) => n + lot.count, 0);
      const continuingCommercial = state.population.baselineCare + followupLots.filter(lot => lot.until > elapsed && lot.commercial).reduce((n, lot) => n + lot.count, 0);
      // Freeze today's sale rate rather than inventing uptake for a future asset;
      // continuing obligations can still reduce that rate in a later month.
      const starts = Math.max(0, Math.min(waiting, Math.floor(projection.starts * uptake), state.network.clinic, state.network.supply, state.network.tests, followupCapacity - continuing));
      waiting -= starts;
      if (starts) followupLots.push({count: starts, until: elapsed + 6, commercial: true});
      const followups = Math.min(followupCapacity, continuingCommercial + starts);
      const screening = Math.max(0, Math.min(unassessed, Math.floor(projection.tests * uptake) - starts, state.network.tests - starts));
      unassessed -= screening; readyNext = Math.floor(screening * .75);
      const tests = starts + screening;
      let studySpend = 0, studyReceipts = 0;
      for (const item of schedule) {
        const installment = Math.min(item.remainingBudget, item.installment);
        item.remainingBudget -= installment; studySpend += installment;
        if (item.months > 0) {
          const services = Math.ceil(item.remainingService / item.months);
          item.remainingService -= services; item.months--; studyReceipts += services;
        }
      }
      // Committed hires/equipment have been paid already; their operating payroll begins on completion.
      const extraStaff = committed.filter(project => project.kind === 'staff' || project.kind === 'clinic' || project.kind === 'trial-team')
        .reduce((count, project) => count + (project.kind === 'staff' ? project.quantity : project.kind === 'clinic' ? 10 : 4), 0);
      const payroll = (projection.employees + extraStaff) * OPERATING_RATES.employeeMonth;
      const commercial = cent((starts * OPERATING_RATES.startReceipt + followups * OPERATING_RATES.followupReceipt) * receiptFactor);
      const receipts = commercial + studyReceipts;
      const royalty = cent(commercial * state.company.royalty);
      const operations = cent((payroll + starts * OPERATING_RATES.startMedicine + tests * OPERATING_RATES.test + OPERATING_RATES.corporate) * costFactor + studySpend + royalty);
      const uncommissionedBasis = state.projects.filter(project => project.readyAt > state.month + elapsed && ['clinic', 'tests', 'supply', 'trial-team'].includes(project.kind)).reduce((n, project) => n + project.cost, 0);
      const installedBasis = Math.max(0, state.company.capex - uncommissionedBasis);
      const capex = cent(installedBasis * .025 / 12);
      const taxes = cent(Math.max(0, receipts - operations - capex) * .2);
      const freeCash = receipts - operations - capex - taxes;
      cash += freeCash;
      const needed = Math.max(peakGap, -cash);
      row.fundingGap += needed - peakGap; peakGap = needed;
      row.starts! += starts; row.receipts += receipts; row.operations += operations; row.capex += capex; row.taxes += taxes; row.freeCash += freeCash;
      // Trial-service milestones cannot become an everlasting residual multiple.
      const recurringTax = cent(Math.max(0, commercial - (operations - studySpend) - capex) * .2);
      row.recurring += commercial - (operations - studySpend) - capex - recurringTax;
    }
    yearly.push(row);
  }
  return yearly;
}

function discounted(forecast: ForecastYear[]): {enterprise: number;residual: number;discountedResidual: number} {
  const residual = cent(Math.max(0, forecast[4]!.recurring) * 8);
  const discountedResidual = residual / Math.pow(1.15, 5);
  return {enterprise: cent(forecast.reduce((total, year, i) => total + year.freeCash / Math.pow(1.15, i + 1), 0) + discountedResidual), residual, discountedResidual};
}

export function valueCompany(state: State, projection: Projection): CompanyValue {
  const baseForecast = forecast(state, projection, 'base');
  const base = discounted(baseForecast), low = discounted(forecast(state, projection, 'low')), high = discounted(forecast(state, projection, 'high'));
  const balance = state.company.cash - state.company.debt;
  return {enterprise: base.enterprise, equity: Math.max(0, cent(base.enterprise + balance)),
    low: Math.max(0, cent(Math.min(low.enterprise, base.enterprise, high.enterprise) + balance)),
    high: Math.max(0, cent(Math.max(low.enterprise, base.enterprise, high.enterprise) + balance)),
    residual: base.residual, residualShare: base.enterprise > 0 ? base.discountedResidual / base.enterprise : 0,
    discount: .15, multiple: 8, forecast: baseForecast, fundingGap: baseForecast.reduce((n, row) => n + row.fundingGap, 0), explanation: [
      'Installed-network DCF is a conservative operating snapshot, separate from the $250M corporate venture premise and the last priced financing round. A small clinical network can have zero cash-flow equity value while investors underwrite a much larger unproved business.',
      'Five years use the current sale rate as a ceiling, protect existing and new follow-up commitments, and screen only the current untreated catchment at 75% eligibility. No future approval, new territory, unbuilt expansion, stronger AI or $100B outcome is assumed. Partner courses require six months of visits; existing trial visits occupy capacity without ordinary care fees. This short-slice estimate is conditional on continuing funded operations.',
      'Remaining authorized study budgets are charged once. Contracted sponsored enrollment and observation fees are finite, spread over remaining study clocks, and excluded from recurring residual value. Future study approvals and uncontracted trial fees are excluded.',
      'Already paid projects are not charged twice; committed hiring payroll starts when ready. Model credits cannot pay wages, medicine or clinical studies and carry no cash value here.',
      'Monthly operations include $1.5M corporate spending, actual operating staff, purchased medicine, testing and earned royalties. Maintenance is 2.5% a year of paid capital basis; modeled tax is 20% of positive cash profit.',
      'Free cash flow is discounted at 15%; residual value is 8× positive recurring free cash flow in year five. Equity adds current cash and subtracts debt once. Financing receipts are not operating revenue. Funding gaps are disclosed, with no automatic future rescue.',
      'Low/base/high vary uptake, received prices and operating costs. Forecast spending continues even when a funding gap appears; these are conditional operating values, not executable transactions.',
    ]};
}

/** This illustrative check replaces other investors in a closed round; it changes no state. */
export function investorPosition(state: State, value: CompanyValue, roundId: string, check: number): InvestorPosition {
  money(check, 'Illustrative check');
  const round = state.company.rounds.find(item => item.id === roundId);
  if (!round) throw new RangeError('Choose a recorded funding round.');
  if (check > round.raised) throw new RangeError('The illustrative check must fit inside the selected round.');
  if (!state.company.classes.some(item => item.id === round.classId)) throw new RangeError('The round share class is missing.');
  const shares = mul(q(round.issuedShares), div(q(check), q(round.raised)));
  const total = sum(state.company.classes.map(item => q(item.shares)));
  const payout = (equity: number): number => {
    const allocation = allocateExit(equity, state.company.classes).find(item => item.classId === round.classId)!;
    return Number(floor(mul(q(allocation.proceeds), div(q(check), q(round.raised)))));
  };
  const proceeds = payout(value.equity);
  return {check, roundId, shares: encode(shares), initialOwnership: asNumber(div(q(check), q(round.postMoney))),
    ownership: asNumber(div(shares, total)), proceeds, low: payout(value.low), high: payout(value.high),
    multiple: check > 0 ? proceeds / check : 0, entryValue: round.postMoney};
}
