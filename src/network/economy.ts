import type { Company, CompanyValue, ForecastYear, InvestorPosition } from '../core/types';
import type { Facility, Projection, QuarterAccount, State } from './types';
import { allocateExit, initialCompany, issueEquity } from '../world/economy';
import { asNumber, cent, div, encode, floor, money, mul, q, sum } from '../world/rational';

const USD = 100;
const M = 1_000_000 * USD;
const clamp = (value: number, low = 0, high = 1): number => Math.max(low, Math.min(high, value));

export function initialNetworkCompany(): Company {
  return {
    ...initialCompany(), cash: 1.8 * M,
    classes: [
      { id: 'founders', name: 'Founders', shares: '80', invested: 0, preferred: false },
      { id: 'option-pool', name: 'Option reserve', shares: '10', invested: 0, preferred: false, reserved: true },
      { id: 'early', name: 'Early backers', shares: '10', invested: 0, preferred: false },
    ],
  };
}

export interface FundraiseQuote { preMoney: number; maxRaise: number; reasons: string[] }
export type FinancingTerms = 'protected' | 'growth' | 'control';

/** An illustrative offer for uncertain future scope, distinct from the operating DCF. */
export function fundraiseQuote(state: State): FundraiseQuote {
  const recent = state.accounts.slice(-4);
  const records = recent.length ? recent : [state.account];
  const revenue = records.reduce((n, a) => n + a.revenue, 0) / records.length;
  const cashFlow = records.reduce((n, a) => n + a.cashFlow, 0) / records.length;
  const contribution = records.reduce((n, a) => n + a.cashFlow + a.research + a.central, 0) / records.length;
  const clinical = state.programs.filter(p => p.developmentSpend > 0 && p.evidence > 0);
  const clinicalValue = clinical.reduce((n, p) => {
    // Evidence changes the offer. Announcing a trial or receiving a model release is not a readout.
    const confidence = clamp(p.evidence);
    const observedFailure = p.study?.failed ? .25 : 1;
    return n + 8 * M * confidence * confidence * observedFailure;
  }, 0);
  const capacity = state.facilities.filter(f => f.status === 'operating' && (f.owner === 'db' || f.owner === 'partner') && (f.kind === 'clinic' || f.kind === 'hospital'))
    .reduce((n, f) => n + f.capacity, 0);
  const reachValue = Math.max(0, capacity - 80) * 1_250 * USD;
  const beforeRisk = 3.572 * M + revenue * 4 * 2 + Math.max(0, contribution - 132_000 * USD) * 4 * 3 + clinicalValue + reachValue;
  const runway = cashFlow < 0 ? Math.max(0, state.company.cash) / -cashFlow : Infinity;
  const risk = runway < 1 ? .55 : runway < 2 ? .7 : runway < 4 ? .85 : 1;
  const preMoney = cent(Math.max(.75 * M, beforeRisk * risk));
  const maxRaise = cent(Math.max(.1 * M, preMoney * .6));
  return { preMoney, maxRaise, reasons: [
    `The offer uses ${records.length > 1 ? `${records.length}-quarter average` : 'current quarterly'} service revenue, contribution and commissioned delivery capacity.`,
    clinical.length ? `Available clinical evidence in ${clinical.map(p => p.name).join(', ')} supports additional future scope; a trial announcement alone does not.` : 'No development readout is priced yet. An informative study result can improve the next offer.',
    risk < 1 ? `Less than ${runway < 1 ? 'one quarter' : runway < 2 ? 'two quarters' : 'one year'} of operating runway reduces this offer by ${Math.round((1 - risk) * 100)}%.` : 'Current operating runway avoids a distressed-financing discount.',
    'This is a fictional venture financing offer, not a DCF, sale price or guaranteed future round. The chosen raise determines dilution.',
  ] };
}

/** Issuance is pure; the engine must apply any effective control transfer before care. */
export function financedCompany(state: State, amount: number, terms: FinancingTerms = 'protected'): Company {
  money(amount, 'Round size');
  const quote = fundraiseQuote(state);
  if (amount < .1 * M || amount > quote.maxRaise) throw new RangeError('Choose a round size between $100,000 and the current maximum offer.');
  if (!['protected', 'growth', 'control'].includes(terms)) throw new RangeError('Unknown financing terms.');
  const multiple = terms === 'growth' ? 1.2 : terms === 'control' ? 1.65 : 1;
  const next = issueEquity(state.company, {
    id: `network-round-${state.tick}-${state.company.rounds.length + 1}`,
    name: terms === 'protected' ? 'Founder-protected financing' : terms === 'growth' ? 'Growth financing · 10% option reserve' : 'Control-transfer financing',
    cash: amount, preMoney: cent(quote.preMoney * multiple),
    poolTopup: terms === 'growth' ? .1 : 0,
    founderSeats: terms === 'control' ? 1 : state.company.founderSeats,
    strategicControl: terms === 'control',
  }, 2027 + Math.floor(state.tick / 4));
  // Network-edition founder protections separate voting authority from wealth.
  // The legacy helper's economic-minority warning is not a governance transfer.
  next.control = state.company.control === 'lost' ? 'lost' : next.founderSeats < 2 || next.strategicControl || !next.ceo ? 'at-risk' : 'retained';
  return next;
}

export interface OperatingRates { startReceipt: number; startCost: number; followupReceipt: number; followupCost: number; staffQuarter: number; siteQuarter: number }

/** DB receipts exclude medicine invoices and clinical bills paid directly to partners. */
export function operatingRates(site: Facility): OperatingRates {
  if (site.owner === 'partner') return { startReceipt: 900 * USD, startCost: 150 * USD, followupReceipt: 100 * USD, followupCost: 25 * USD, staffQuarter: 37_500 * USD, siteQuarter: 0 };
  if (site.delivery === 'home') return { startReceipt: 2_200 * USD, startCost: 650 * USD, followupReceipt: 200 * USD, followupCost: 65 * USD, staffQuarter: 30_000 * USD, siteQuarter: 20_000 * USD };
  if (site.delivery === 'wearable') return { startReceipt: 1_300 * USD, startCost: 350 * USD, followupReceipt: 120 * USD, followupCost: 35 * USD, staffQuarter: 30_000 * USD, siteQuarter: 15_000 * USD };
  return { startReceipt: 6_500 * USD, startCost: (site.delivery === 'local' ? 2_250 : 2_700) * USD, followupReceipt: 400 * USD, followupCost: 200 * USD, staffQuarter: 30_000 * USD, siteQuarter: (site.kind === 'hospital' ? 75_000 : 40_000) * USD };
}

function count(value: number | undefined, label: string): number {
  const result = value ?? 0;
  if (!Number.isFinite(result) || result < 0) throw new RangeError(`${label} must be finite and nonnegative.`);
  return result;
}

/**
 * Consumes the allocator's completed work; does not infer extra care from capacity.
 * trialCost includes the research team and external work. Construction and funding
 * are separate engine transactions. Staff quantities are totals, not per-site units.
 */
export function operatingAccount(state: State, startsBySite: Record<string, number>, followupBySite: Record<string, number>, trialCost = 0): QuarterAccount {
  money(trialCost, 'Quarterly research spending');
  let starts = 0, followup = 0, revenue = 0, payroll = 0, supplies = 0, premises = 0, employees = 2 + (trialCost > 0 ? 2 : 0), partnerEmployees = 0;
  for (const site of state.facilities) {
    const initial = count(startsBySite[site.id], 'Treatment starts'), later = count(followupBySite[site.id], 'Follow-up contacts');
    const operated = site.status === 'operating' && (site.owner === 'db' || site.owner === 'partner');
    if (!operated) {
      if (initial || later) throw new RangeError(`Care cannot be billed at non-operating DB network site ${site.name}.`);
      continue;
    }
    if ((initial || later) && site.kind !== 'clinic' && site.kind !== 'hospital') throw new RangeError(`The ${site.kind} does not administer patient care.`);
    const staff = count(site.employees, 'Staff'), units = count(site.units, 'Site units');
    employees += staff;
    if (site.kind === 'clinic' || site.kind === 'hospital') {
      const rates = operatingRates(site);
      starts += initial; followup += later;
      revenue += initial * rates.startReceipt + later * rates.followupReceipt;
      supplies += initial * rates.startCost + later * rates.followupCost;
      payroll += staff * rates.staffQuarter;
      premises += units * rates.siteQuarter;
      if (site.owner === 'partner') partnerEmployees += 6 * units;
    } else if (site.kind === 'factory' || site.kind === 'lab') {
      // These internal services create no second sale when DB treats the patient.
      payroll += staff * 30_000 * USD;
      premises += units * (site.kind === 'factory' ? 60_000 : 25_000) * USD;
    }
  }
  for (const id of new Set([...Object.keys(startsBySite), ...Object.keys(followupBySite)])) {
    if (!state.facilities.some(f => f.id === id) && (startsBySite[id] || followupBySite[id])) throw new RangeError(`Unknown care site: ${id}`);
  }
  // A factory's finite shipped courses replace purchased material. Credit only
  // actual delivered care; shared factory capacity cannot be credited twice.
  const factoryRemaining = new Map(state.facilities.filter(f => f.kind === 'factory' && f.owner === 'db' && f.status === 'operating').map(f => [f.id, f.capacity]));
  const careRemaining = new Map(state.facilities.filter(f => f.owner === 'db' && f.status === 'operating' && f.delivery === 'clinic' && (f.kind === 'clinic' || f.kind === 'hospital')).map(f => [f.id, startsBySite[f.id] ?? 0]));
  for (const link of [...state.links].sort((a, b) => a.id.localeCompare(b.id))) {
    if (!link.active || link.kind !== 'medicine' || !factoryRemaining.has(link.from) || !careRemaining.has(link.to)) continue;
    const shipped = Math.min(factoryRemaining.get(link.from)!, careRemaining.get(link.to)!, count(link.lastFlow, 'Delivered factory courses'), count(link.capacity, 'Medicine route capacity'));
    factoryRemaining.set(link.from, factoryRemaining.get(link.from)! - shipped);
    careRemaining.set(link.to, careRemaining.get(link.to)! - shipped);
    supplies += shipped * (300 - 750) * USD;
  }
  // The population payer trades lower earned service fees for broader access.
  // Royalties apply to DB's actual discounted receipts, not the undiscounted bill.
  revenue = cent(revenue * (state.partnerships.includes('payer') ? .9 : 1));
  const royalty = cent(revenue * clamp(state.company.royalty, 0, .95));
  supplies = cent(supplies + royalty); payroll = cent(payroll);
  const central = 75_000 * USD, costs = cent(payroll + supplies + premises + trialCost + central);
  revenue = cent(revenue);
  return { tick: state.tick, starts, followup, revenue, costs, payroll, supplies, research: trialCost, central, cashFlow: revenue - costs, employees, partnerEmployees, healthAdded: 0 };
}

type ForecastCase = 'low' | 'base' | 'high';

/** Engine-authored costs are final; research excludes paid patient-product updates. */
export interface NetworkForecastProjection extends Projection {
  research?: number;
  maintenanceBasis?: number;
}

function researchSchedule(state: State): number[] {
  const active = state.programs.filter(p => p.study && !p.study.paused && !p.study.failed);
  if (!active.length) return Array(20).fill(state.programs.some(p => p.developmentSpend > 0 || p.study) ? 0 : 150_000 * USD);
  const schedule = Array<number>(20).fill(0);
  for (const p of active) {
    const study = p.study!;
    const spent = 'spent' in study && typeof study.spent === 'number' ? study.spent : 0;
    let remaining = Math.max(0, study.cost - spent);
    const installment = cent(study.cost / (study.phase === 'phase1' ? 6 : study.phase === 'phase2' ? 9 : 14));
    // Fund only the remaining authorized phase budget, never another trial.
    for (let i = 0; i < 20 && remaining > 0; i++) {
      const payment = Math.min(remaining, installment);
      schedule[i] += payment; remaining -= payment;
    }
  }
  return schedule.map(cent);
}

/** Paid build costs enter basis once, but maintenance starts only on commissioning. */
function commissionedBasis(state: State, tick: number): number {
  return cent(state.facilities.filter(f => f.owner === 'db' && (f.status === 'operating' || f.status === 'building' && f.readyAt <= tick)).reduce((n, f) => {
    const uncommissioned = state.projects.filter(p => p.siteId === f.id && p.readyAt > tick).reduce((sum, p) => sum + p.cost, 0);
    return n + Math.max(0, f.basis - uncommissioned);
  }, 0));
}

function operatingForecast(state: State, projection: Projection, scenario: ForecastCase, quarterProjections?: NetworkForecastProjection[]): ForecastYear[] {
  const forecast: ForecastYear[] = [];
  const research = researchSchedule(state);
  const receiptFactor = scenario === 'low' ? .85 : scenario === 'high' ? 1.1 : 1;
  const expenseFactor = scenario === 'low' ? 1.1 : scenario === 'high' ? .95 : 1;
  const baseQuarterResearch = research[0]!;
  let cash = state.company.cash, fundingPeak = 0;
  for (let year = 0; year < 5; year++) {
    const row: ForecastYear = { year: Math.min(2050, 2027 + Math.floor(state.tick / 4)) + 1 + year, starts: 0, receipts: 0, operations: 0, capex: 0, taxes: 0, freeCash: 0, recurring: 0, fundingGap: 0 };
    for (let quarter = 0; quarter < 4; quarter++) {
      const i = year * 4 + quarter;
      const quarterProjection = quarterProjections?.[i] ?? projection;
      const receipts = cent(quarterProjection.revenue * receiptFactor);
      const authored = quarterProjections?.[i];
      const authoredResearch = authored?.research ?? 0;
      const operations = authored
        ? cent((authored.costs - authoredResearch) * expenseFactor + authoredResearch)
        : cent(Math.max(0, quarterProjection.costs - baseQuarterResearch) * expenseFactor + research[i]!);
      const basis = authored?.maintenanceBasis ?? commissionedBasis(state, state.tick + i);
      const capex = cent(basis * .025 / 4);
      const taxes = cent(Math.max(0, receipts - operations - capex) * .2);
      const freeCash = receipts - operations - capex - taxes;
      cash += freeCash;
      const required = Math.max(fundingPeak, -cash);
      row.fundingGap += required - fundingPeak; fundingPeak = required;
      row.starts! += quarterProjection.starts;
      row.receipts += receipts; row.operations += operations; row.capex += capex; row.taxes += taxes; row.freeCash += freeCash;
    }
    row.recurring = row.freeCash;
    forecast.push(row);
  }
  return forecast;
}

function discounted(forecast: ForecastYear[]): { enterprise: number; residual: number; discountedResidual: number } {
  const residual = cent(Math.max(0, forecast[4]!.recurring) * 8);
  const discountedResidual = residual / 1.15 ** 5;
  return { enterprise: cent(forecast.reduce((n, y, i) => n + y.freeCash / 1.15 ** (i + 1), 0) + discountedResidual), residual, discountedResidual };
}

/** A deliberately bounded operating valuation; it never executes a sale. */
export function forecastNetwork(state: State, projection: Projection, quarterProjections?: NetworkForecastProjection[]): CompanyValue {
  if (quarterProjections && quarterProjections.length !== 20) throw new RangeError('Provide exactly 20 known-network quarterly projections.');
  for (const quarter of quarterProjections ?? []) {
    money(quarter.revenue, 'Projected receipts'); money(quarter.costs, 'Projected operating costs');
    if (quarter.research !== undefined) { money(quarter.research, 'Projected research'); if (quarter.research > quarter.costs) throw new RangeError('Projected research must be included in total operating costs.'); }
    if (quarter.maintenanceBasis !== undefined) money(quarter.maintenanceBasis, 'Commissioned maintenance basis');
  }
  const forecast = operatingForecast(state, projection, 'base', quarterProjections);
  const base = discounted(forecast), low = discounted(operatingForecast(state, projection, 'low', quarterProjections)), high = discounted(operatingForecast(state, projection, 'high', quarterProjections));
  const balance = state.company.cash - state.company.debt;
  const equity = Math.max(0, cent(base.enterprise + balance));
  return {
    enterprise: base.enterprise, equity,
    low: Math.max(0, cent(Math.min(low.enterprise, base.enterprise, high.enterprise) + balance)),
    high: Math.max(0, cent(Math.max(low.enterprise, base.enterprise, high.enterprise) + balance)),
    residual: base.residual, residualShare: base.enterprise > 0 ? base.discountedResidual / base.enterprise : 0,
    discount: .15, multiple: 8, forecast, fundingGap: forecast.reduce((n, y) => n + y.fundingGap, 0),
    explanation: [
      quarterProjections ? 'Illustrative game outcomes in constant USD. Five operating years use 20 supplied capacity-constrained quarterly projections of installed and already-committed networks, their actual commissioning schedules and continuing-care workload. No future AI release, unapproved therapy success or uncommitted expansion is assumed.' : 'Illustrative game outcomes in constant USD. Five operating years use the supplied capacity-constrained next-quarter service projection; no hypothetical new network or future AI premium is added.',
      quarterProjections ? 'Known funded projects contribute operating receipts and costs only after their scheduled commissioning. Their already-paid upfront costs are not charged again. The separate venture offer can price uncertain future scope beyond this operating forecast.' : 'This conservative snapshot holds the current care mix and continuing-care workload constant. Uncommissioned projects and unapproved future therapies have no speculative upside here; the separate venture offer can price uncertain future scope.',
      quarterProjections ? 'Supplied quarterly operating costs are used exactly in the base case, including finite current-study installments and actual product updates; they are not rescheduled or charged twice. One-off financing receipts and already-paid construction are excluded.' : 'The fallback funds only the remaining current phase budget at its agreed installment rate, capped by amounts already spent. No next phase is silently started. The opening research mandate continues until development begins. One-off financing receipts and already-paid construction are excluded.',
      'Low/base/high vary earned service receipts by −15%/0%/+10% and operating costs by +10%/0%/−5%, excluding separately identified research installments. They are operating scenarios, not probabilities or clinical efficacy predictions.',
      'Maintenance capex is 2.5% of commissioned owned asset basis annually, including paid projects as they open; cash taxes are 20% of positive cash earnings after maintenance. Funding gaps are disclosed; no rescue round is assumed.',
      'Enterprise value discounts free cash flow at 15%, plus 8× positive recurring year-five free cash flow. Equity adds unrestricted cash and subtracts debt once. Restricted compute credits are excluded.',
      'There is no separately added data, pipeline, healthspan or platform valuation. Preferences are 1× non-participating and pari-passu; the option pool is assumed fully issued and vested at zero exercise cost.',
    ],
  };
}

/** The check replaces a slice of an actual round; no money or shares are issued. */
export function investorPosition(state: State, value: CompanyValue, roundId: string, check: number): InvestorPosition {
  money(check, 'Illustrative investor check');
  const round = state.company.rounds.find(r => r.id === roundId);
  if (!round) throw new RangeError('Select a recorded financing round.');
  if (check > round.raised) throw new RangeError('The illustrative check must fit within the existing round.');
  if (!state.company.classes.some(c => c.id === round.classId)) throw new RangeError('The recorded financing share class is missing.');
  const shares = mul(q(round.issuedShares), div(q(check), q(round.raised)));
  const allShares = sum(state.company.classes.map(c => q(c.shares)));
  const payout = (exit: number): number => {
    const allocation = allocateExit(exit, state.company.classes).find(c => c.classId === round.classId)!;
    return Number(floor(div(mul(q(allocation.proceeds), q(check)), q(round.raised))));
  };
  const proceeds = payout(value.equity);
  return { check, roundId, shares: encode(shares), initialOwnership: asNumber(div(q(check), q(round.postMoney))), ownership: asNumber(div(shares, allShares)), proceeds, low: payout(value.low), high: payout(value.high), multiple: check > 0 ? proceeds / check : 0, entryValue: round.postMoney };
}
