import type { Company, CompanyValue, DealVariant, ExitAllocation, Family, ForecastYear, GameState, InvestorPosition, Money, ShareClass } from '../core/types';
import { infrastructureCapacity, PROGRAMS, siteCount } from './content';
import {deployedAssetBasis} from './deployment';
import { add, apportion, asNumber, cent, cmp, div, encode, floor, money, mul, q, sub, sum } from './rational';

const M = 100_000_000;
const FAMILIES: Family[] = ['diagnostics', 'clinic', 'manufacturing', 'evidence', 'followup', 'network'];
export interface EquityTerms {
  cash: Money; preMoney: Money; poolTopup?: number; credits?: Money; id?: string; name?: string;
  founderSeats?: number; strategicControl?: boolean;
}
export type ForecastScenario = 'low' | 'base' | 'high';

export function initialCompany(): Company {
  return {
    cash: 12 * M, credits: 0, debt: 0, revenue: 0, expenses: 0, capex: 0, taxes: 0, royalty: 0,
    founderSeats: 3, strategicControl: false, ceo: true, control: 'retained', cureQuarter: null,
    classes: [
      { id: 'founders', name: 'Founders', shares: '55', invested: 0, preferred: false },
      { id: 'option-pool', name: 'Option reserve', shares: '15', invested: 0, preferred: false, reserved: true },
      { id: 'platform', name: 'Founding platform', shares: '20', invested: 0, preferred: false },
      { id: 'early', name: 'Early backers', shares: '10', invested: 0, preferred: false },
    ],
    rounds: [], contracts: [], priority: 'balanced', totalRevenue: 0, totalSpend: 0, lastRevenue: 0, lastExpenses: 0,
  };
}

function verifyClasses(classes: ShareClass[]): void {
  const ids = new Set<string>();
  for (const item of classes) {
    if (ids.has(item.id)) throw new RangeError(`Duplicate share class: ${item.id}`);
    ids.add(item.id);
    if (cmp(q(item.shares), q(0)) < 0) throw new RangeError('Shares cannot be negative.');
    money(item.invested, 'Invested capital');
    if (item.preferred && item.invested > 0 && cmp(q(item.shares), q(0)) === 0) throw new RangeError('A preferred investment requires shares.');
  }
}

/** Exact fraction of the fully diluted capitalization; use shareFraction only for display. */
export function shareRatio(classes: ShareClass[], id: string): string {
  verifyClasses(classes);
  const total = sum(classes.map(c => q(c.shares)));
  const item = classes.find(c => c.id === id);
  return !item || cmp(total, q(0)) === 0 ? '0' : encode(div(q(item.shares), total));
}
export function shareFraction(classes: ShareClass[], id: string): number { return asNumber(q(shareRatio(classes, id))); }

/**
 * Pool top-up occurs before pricing. poolTopup is the desired POST-round pool fraction,
 * and never shrinks an existing pool. Credits are restricted assets, not raised cash.
 * This helper applies financing only; the engine attaches any operating contract.
 */
export function issueEquity(company: Company, terms: EquityTerms | DealVariant, year: number): Company {
  money(terms.cash, 'Round cash'); money(terms.preMoney, 'Pre-money valuation');
  money(terms.credits ?? 0, 'Compute credits');
  verifyClasses(company.classes);
  if (terms.cash <= 0 || terms.preMoney <= 0) throw new RangeError('An equity round requires positive cash and pre-money valuation.');
  const desired = q(terms.poolTopup ?? 0);
  if (cmp(desired, q(0)) < 0 || cmp(desired, q(1)) >= 0) throw new RangeError('Post-money option reserve must be in [0, 1).');
  const total = sum(company.classes.map(c => q(c.shares)));
  if (cmp(total, q(0)) <= 0) throw new RangeError('An equity round requires existing shares.');
  const classes = company.classes.map(c => ({ ...c }));
  const oldPool = sum(classes.filter(c => c.reserved).map(c => q(c.shares)));
  const postMultiple = div(add(q(terms.preMoney), q(terms.cash)), q(terms.preMoney));
  const targetBeforeMoney = mul(desired, postMultiple);
  const numerator = sub(mul(targetBeforeMoney, total), oldPool);
  let topup = q(0);
  if (cmp(numerator, q(0)) > 0) {
    const denominator = sub(q(1), targetBeforeMoney);
    if (cmp(denominator, q(0)) <= 0) throw new RangeError('Requested option reserve leaves no ownership for existing holders.');
    topup = div(numerator, denominator);
    let pool = classes.find(c => c.reserved);
    if (!pool) {
      pool = { id: 'option-pool', name: 'Option reserve', shares: '0', invested: 0, preferred: false, reserved: true };
      if (classes.some(c => c.id === pool!.id)) throw new RangeError('An option-pool class must be marked reserved.');
      classes.push(pool);
    }
    pool.shares = encode(add(q(pool.shares), topup));
  }
  const issued = mul(add(total, topup), div(q(terms.cash), q(terms.preMoney)));
  const id = ('id' in terms && terms.id) || `round-${year}-${company.rounds.length + 1}`;
  const classId = `${id}-preferred`;
  if (company.rounds.some(r => r.id === id) || classes.some(c => c.id === classId)) throw new RangeError('Round IDs must be unique.');
  const name = terms.name || `Financing ${company.rounds.length + 1}`;
  classes.push({ id: classId, name, shares: encode(issued), invested: terms.cash, preferred: true });
  // Later cash cannot silently erase a previously granted consent right or board seat.
  const founderSeats = Math.min(company.founderSeats, terms.founderSeats ?? company.founderSeats);
  const strategicControl = company.strategicControl || !!terms.strategicControl;
  const atRisk = shareFraction(classes, 'founders') < .25 || founderSeats < 2 || strategicControl;
  return {
    ...company, cash: money(company.cash + terms.cash), credits: money(company.credits + (terms.credits ?? 0)),
    classes, founderSeats, strategicControl,
    control: company.control === 'lost' ? 'lost' : atRisk ? 'at-risk' : company.control,
    rounds: [...company.rounds.map(r => ({ ...r })), {
      id, year, name, raised: terms.cash, preMoney: terms.preMoney, postMoney: money(terms.preMoney + terms.cash),
      classId, issuedShares: encode(issued), poolTopup: terms.poolTopup ?? 0,
    }],
    contracts: company.contracts.map(c => ({ ...c })),
  };
}

/**
 * 1x nonparticipating, pari-passu preferred. Convert low preference-per-share
 * classes only when their common entitlement exceeds their preference. Reserved
 * options share in common proceeds on the disclosed zero-exercise-cost convention.
 */
export function allocateExit(proceeds: Money, classes: ShareClass[]): ExitAllocation[] {
  money(proceeds, 'Exit proceeds'); verifyClasses(classes);
  if (!classes.length) {
    if (proceeds) throw new RangeError('Cannot allocate proceeds to an empty capitalization.');
    return [];
  }
  const preferred = classes.filter(c => c.preferred && c.invested > 0);
  const preferenceTotal = preferred.reduce((acc, c) => money(acc + c.invested), 0);
  if (proceeds <= preferenceTotal && preferenceTotal > 0) {
    const allocations = apportion(proceeds, preferred.map(c => ({ id: c.id, weight: q(c.invested) })));
    return classes.map(c => ({ classId: c.id, proceeds: allocations.get(c.id) ?? 0, converted: false }));
  }
  const converted = new Set(classes.filter(c => c.preferred && c.invested === 0).map(c => c.id));
  let commonShares = sum(classes.filter(c => !c.preferred || converted.has(c.id)).map(c => q(c.shares)));
  let heldPreference = preferenceTotal;
  const ranked = [...preferred].sort((a, b) => cmp(div(q(a.invested), q(a.shares)), div(q(b.invested), q(b.shares))) || a.id.localeCompare(b.id));
  for (const c of ranked) {
    const threshold = div(q(c.invested), q(c.shares));
    const shouldConvert = cmp(commonShares, q(0)) === 0
      ? proceeds > heldPreference
      : cmp(div(q(proceeds - heldPreference), commonShares), threshold) > 0;
    if (!shouldConvert) break;
    converted.add(c.id);
    commonShares = add(commonShares, q(c.shares));
    heldPreference -= c.invested;
  }
  const common = classes.filter(c => !c.preferred || converted.has(c.id));
  const remainder = proceeds - heldPreference;
  const allocations = apportion(remainder, common.map(c => ({ id: c.id, weight: q(c.shares) })));
  return classes.map(c => ({ classId: c.id,
    proceeds: c.preferred && !converted.has(c.id) ? c.invested : allocations.get(c.id) ?? 0,
    converted: converted.has(c.id),
  }));
}

function unit(value: number): number { return Math.max(0, Math.min(1, value > 1 ? value / 100 : value)); }
const clamp = (value: number, low = 0, high = 1): number => Math.max(low, Math.min(high, value));
interface ForecastProgram { id: string; probability: number; weight: number; price: number; cost: number; royalty: number }
interface ForecastRegion {
  source: GameState['regions'][number]; levels: Record<Family, number>; unlocked: boolean;
  people: { alive: number; age: number }[]; trialPatients: number; treated: number; uptake: number;
}

/** Clinical uncertainty affects eligible future demand and its operating mix, not a separate asset. */
function clinicalPrograms(state: GameState, ahead: number, scenario: ForecastScenario, platform: boolean, planning = false): ForecastProgram[] {
  const result: ForecastProgram[] = [];
  for (const p of state.programs) {
    const definition = PROGRAMS.find(d => d.id === p.id);
    if (!definition) continue;
    if (planning && (!p.active || (p.stage !== 'approved' && p.stage !== 'platform'))) continue;
    const platformEligible = !planning && platform && p.stage === 'phase2' && p.evidence >= .45 && (p.platformScope || state.policy.scope.includes(p.family));
    if (!p.active && !platformEligible) continue;
    let probability = p.stage === 'approved' || p.stage === 'platform' || platformEligible ? 1 : 0;
    if (!probability && p.study && !p.study.paused) {
      const phase = p.study.phase;
      const delay = phase === 'phase3' ? 2 : phase === 'phase2' ? 3 : phase === 'phase1' ? 4 : 5;
      const evidence = unit(p.evidence);
      const likelihood = phase === 'phase3' ? .55 + .25 * evidence : phase === 'phase2' ? .25 + .25 * evidence : .10 + .15 * evidence;
      if (ahead >= delay) probability = clamp(likelihood * (scenario === 'low' ? .5 : scenario === 'high' ? 1.2 : 1));
    }
    if (!probability) continue;
    probability *= Math.max(.65, 1 - Math.max(0, p.harm - definition.harm));
    result.push({ id: p.id, probability, weight: probability * Math.max(.2, p.benefit * p.response),
      price: definition.price, cost: definition.cost / Math.pow(Math.max(1, state.world.biology), .25), royalty: p.royalty ?? 0 });
  }
  return result;
}

/** Contract royalties are netted from their own receipts exactly once. */
function projectedRoyalty(state: GameState, program: ForecastProgram, regionId: string, tick: number): number {
  // Only non-therapy contracts were ever added to the company-wide royalty balance.
  const globalContracts = state.company.contracts.filter(c => c.family !== 'therapy');
  const permanentGlobal = Math.max(0, state.company.royalty - globalContracts.reduce((n, c) => n + c.royalty, 0));
  const activeGlobal = globalContracts.filter(c => c.start <= tick && c.end > tick).reduce((n, c) => n + c.royalty, 0);
  const scoped = state.company.contracts.filter(c => c.family === 'therapy' && c.programId === program.id && (!c.regionId || c.regionId === regionId) && c.start <= tick && c.end > tick).reduce((n, c) => n + c.royalty, 0);
  return clamp(permanentGlobal + activeGlobal + program.royalty + scoped, 0, .95);
}

function patientSurvival(age: number): number { return Math.pow(1 - clamp(.007 * Math.exp((age - 45) / 22), .004, .7), .25); }
function alivePatients(region: ForecastRegion): number { return region.people.reduce((n, p) => n + p.alive, 0); }
function annualResources(region: ForecastRegion, state: GameState, contracts: GameState['company']['contracts'], regionCount: number): number {
  const l = region.levels, sites = siteCount(l.network);
  const local = contracts.filter(c => !c.regionId || c.regionId === region.source.id);
  const supply = (family: string): number => local.filter(c => c.family === family).reduce((n, c) => n + c.capacity / (c.regionId ? 1 : Math.max(1, regionCount)), 0);
  const diagnostics = l.diagnostics > 0 ? sites * 160 * (1 + .35 * (l.diagnostics - 1)) * Math.pow(state.world.compute, .2) : 0;
  const clinic = (l.clinic > 0 ? sites * 100 * (1 + .3 * (l.clinic - 1)) : 0) + supply('hospital') + supply('therapy');
  const manufacturing = (l.manufacturing > 0 ? sites * 140 * (1 + .4 * (l.manufacturing - 1)) * Math.pow(state.world.biology, .25) : 0) + supply('manufacturing') + supply('therapy');
  const followup = l.followup > 0 ? sites * 120 * (1 + .4 * (l.followup - 1)) : 0;
  return Math.max(0, Math.min(diagnostics, clinic, manufacturing, followup));
}

/**
 * Twenty operating quarters, aggregated to five years, including after 2050.
 * Known assets, resource queues and contract settlement follow their actual scope.
 * Frontier levels stay fixed; uptake/price/cost and clinical probability are scenarios.
 * New forecast care creates future follow-up obligations, never campaign health score.
 */
export function forecastCompany(state: GameState, scenario: ForecastScenario = 'base', planning = false): ForecastYear[] {
  const factors = scenario === 'low' ? { uptake: .68, price: .9, cost: 1.15 } : scenario === 'high' ? { uptake: 1.24, price: 1.08, cost: .9 } : { uptake: 1, price: 1, cost: 1 };
  const rivalLoad = Math.min(.24, state.world.rivals.reduce((n, r) => n + Math.max(0, r.share), 0) * .2);
  const regions: ForecastRegion[] = state.regions.map(source => {
    // Buckets with the same current age have identical future survival, avoiding repeated work.
    const ageBuckets = new Map<number, number>();
    for (const c of state.cohorts.filter(c => c.regionId === source.id)) {
      const age = c.age + Math.max(0, (state.tick - c.start) / 4);
      ageBuckets.set(age, (ageBuckets.get(age) ?? 0) + Math.max(0, c.alive));
    }
    const people = [...ageBuckets].map(([age, alive]) => ({ age, alive }));
    const trialPatients = Math.max(0, state.trialFollowup?.[source.id] ?? 0);
    const gross = infrastructureCapacity(source.levels, state.world.compute, state.world.biology) / 4;
    const open = Math.max(1, gross * (1 - rivalLoad) - Math.ceil((people.reduce((n, p) => n + p.alive, 0) + trialPatients) / 4) - source.lastTrial);
    const uptake = source.queue ? source.queue.care / Math.max(1, source.queue.care + source.queue.idle) : source.lastTreated / open;
    return { source, levels: { ...source.levels }, unlocked: source.unlocked, people, trialPatients, treated: source.treated, uptake: clamp(uptake) };
  });
  const studies = state.programs.filter(p => p.study && !p.study.paused).map(p => ({ ...p.study!, done: false }));
  const projects = state.projects.map(p => ({ ...p, done: false }));
  let recognition = state.policy.recognition || state.policy.stage === 'personal';
  let platform = state.policy.stage === 'platform' || state.policy.stage === 'personal';
  let cash = state.company.cash, peakFunding = Math.max(0, -cash);
  const forecast: ForecastYear[] = [];
  for (let ahead = 1; ahead <= 5; ahead++) {
    const year: ForecastYear & { starts: number } = { year: 2027 + Math.floor((state.tick + (ahead - 1) * 4) / 4), receipts: 0, operations: 0, capex: 0, taxes: 0, freeCash: 0, recurring: 0, fundingGap: 0, starts: 0, contractStarts: {} };
    for (let quarter = 0; quarter < 4; quarter++) {
      const elapsed = (ahead - 1) * 4 + quarter, tick = state.tick + elapsed;
      // Actual commissioning decrements remaining before this quarter's operations.
      for (const project of projects) if (!project.done && project.remaining <= elapsed + 1) {
        project.done = true;
        if (project.kind === 'recognition') recognition = true;
        if (project.kind === 'platform') platform = true;
        if (project.kind === 'build' && project.family) {
          const region = regions.find(r => r.source.id === project.regionId);
          if (!region) continue;
          region.levels[project.family] = project.targetLevel ?? region.levels[project.family] + 1;
          if (project.family === 'network') {
            region.unlocked = true;
            for (const family of FAMILIES) if (family !== 'network') region.levels[family] = Math.max(1, region.levels[family]);
          }
        }
      }
      const permitted = regions.filter(r => r.unlocked && (r.source.jurisdiction === 0 || recognition));
      const contracts = state.company.contracts.filter(c => c.start <= tick && c.end > tick);
      const programs = clinicalPrograms(state, ahead, scenario, platform, planning);
      const programWeight = programs.reduce((n, p) => n + p.weight, 0);
      const scope = Math.min(1, .36 + programs.reduce((n, p) => n + p.probability, 0) * .18 + (platform ? .15 : 0));
      const activeStudies = studies.filter(s => !s.done);
      let remainingEnrollment = activeStudies.reduce((n, s) => n + Math.max(0, s.target - s.enrolled), 0);
      const trialShare = state.company.priority === 'research' ? .3 : state.company.priority === 'care' ? .04 : .13;
      let receipts = 0, variable = 0, trialSeats = 0, evidenceSites = 0;
      const payerDelivered = new Map<string, number>();
      const trialByRegion = new Map<string, number>();
      for (const region of permitted) {
        const gross = Math.floor(annualResources(region, state, contracts, permitted.length) / 4);
        const slots = Math.floor(gross * (1 - rivalLoad));
        const followup = Math.min(slots, Math.ceil((alivePatients(region) + region.trialPatients) / 4));
        const afterFollowup = Math.max(0, slots - followup);
        const trials = Math.floor(Math.min(afterFollowup * trialShare, remainingEnrollment));
        remainingEnrollment -= trials; trialSeats += trials; trialByRegion.set(region.source.id, trials);
        evidenceSites += siteCount(region.levels.network) * (1 + region.levels.evidence * .15);
        const uptake = planning ? (scenario === 'low' ? .9 : 1) : Math.min(1, Math.min(.98, Math.max(.16, region.uptake) + ahead * .095) * factors.uptake);
        const untreated = Math.max(0, region.source.population - region.treated);
        const demand = planning ? Math.min(untreated, Math.round(untreated * (.12 + state.world.access * .018))) : Math.min(untreated, (region.source.population * .035 + region.source.waiting * .08) / 4) * scope * (1 - Math.min(.55, unit(state.world.counterfactualAccess) * .4));
        const careSlots = programs.length ? Math.max(0, Math.floor(Math.min((afterFollowup - trials) * uptake, demand))) : 0;
        let remaining = careSlots;
        for (const [index, program] of programs.entries()) {
          const desired = index === programs.length - 1 ? remaining : Math.floor(careSlots * program.weight / programWeight);
          remaining -= desired;
          if (desired <= 0) continue;
          const unitCost = program.cost * factors.cost;
          const royalty = projectedRoyalty(state, program, region.source.id, tick);
          const payers = contracts.filter(c => c.annualRevenue > 0 && (!c.regionId || c.regionId === region.source.id) && (!c.programId || c.programId === program.id));
          // Restricted prepayment only relaxes the matching-care working-capital limit.
          // It never changes cash until the single earned-receipt settlement below.
          let advance = 0;
          for (const contract of payers) {
            const unused = Math.max(0, contract.capacity / 4 - (payerDelivered.get(contract.id) ?? 0));
            const unitReceipt = contract.annualRevenue / Math.max(1, contract.capacity);
            advance += Math.min(desired, unused) * Math.min(unitCost, unitReceipt * (1 - royalty));
          }
          const liquidity = Math.max(0, cash + receipts - variable - .1 * M);
          const count = Math.min(desired, Math.max(0, Math.floor((liquidity + advance) / Math.max(1, unitCost))));
          if (!count) continue;
          let uncovered = count, contractedReceipts = 0;
          for (const contract of payers) {
            const covered = Math.min(uncovered, Math.max(0, contract.capacity / 4 - (payerDelivered.get(contract.id) ?? 0)));
            payerDelivered.set(contract.id, (payerDelivered.get(contract.id) ?? 0) + covered);
            if(covered>0)year.contractStarts![contract.id] = (year.contractStarts![contract.id] ?? 0) + covered;
            uncovered -= covered;
            contractedReceipts += covered * contract.annualRevenue / Math.max(1, contract.capacity);
          }
          receipts += (contractedReceipts + uncovered * program.price * factors.price) * (1 - royalty);
          variable += count * unitCost;
          region.treated += count;
          year.starts += count;
          // Age 54 is the midpoint of the engine's authored 46–62 initiation range.
          region.people.push({ alive: count, age: 54 });
        }
      }
      // Existing trial participants keep their queue after pause or completion.
      for (const region of regions) region.trialPatients *= .998;
      let seatsLeft = trialSeats, enrolled = 0;
      const readiness = Math.min(.55, .12 + Math.log2(1 + evidenceSites) * .055) * Math.pow(state.world.research, .15);
      for (const [index, study] of activeStudies.entries()) {
        const seats = Math.floor(seatsLeft / (activeStudies.length - index)); seatsLeft -= seats;
        if (study.readiness < 1) study.readiness = Math.min(1, study.readiness + readiness);
        else if (study.enrolled < study.target) { const added = Math.min(seats, study.target - study.enrolled); study.enrolled += added; enrolled += added; }
        else if (study.observation < study.observationRequired) study.observation += 1;
        else { study.review += 1; if (study.review >= (state.policy.stage === 'personal' ? 1 : 2)) study.done = true; }
      }
      if (trialSeats) for (const region of regions) region.trialPatients += enrolled * (trialByRegion.get(region.source.id) ?? 0) / trialSeats;
      let continuityCost = 0, siteOps = 0, replacement = 0;
      for (const region of regions) {
        for (const patient of region.people) { patient.alive *= patientSurvival(patient.age); patient.age += .25; }
        continuityCost += (alivePatients(region) + region.trialPatients) * 650;
        if (!region.unlocked) continue;
        siteOps += siteCount(region.levels.network) * 9_500;
        replacement += deployedAssetBasis(region.levels);
      }
      const headquarters = (.12 + .004 * Math.max(0, Math.floor(tick / 4))) * M;
      const operations = cent(variable + activeStudies.length * .022 * M + siteOps + headquarters + continuityCost + contracts.reduce((n, c) => n + c.annualCost / 4, 0));
      // Original construction and trial packages are paid already. Only ongoing cash costs recur.
      const capex = cent(replacement * .025 / 4), netReceipts = cent(receipts);
      const taxes = cent(Math.max(0, netReceipts - operations - capex) * .2);
      const freeCash = cent(netReceipts - operations - capex - taxes);
      cash += freeCash;
      const requiredFunding = Math.max(peakFunding, -cash);
      year.fundingGap += cent(requiredFunding - peakFunding); peakFunding = requiredFunding;
      year.receipts += netReceipts; year.operations += operations; year.capex += capex; year.taxes += taxes; year.freeCash += freeCash;
    }
    year.recurring = year.freeCash;
    forecast.push(year);
  }
  return forecast;
}

function discountedValue(forecast: ForecastYear[]): { enterprise: number; residual: number; discountedResidual: number } {
  const residual = cent(Math.max(0, forecast[4]!.recurring) * 8);
  const discountedResidual = residual / Math.pow(1.15, 5);
  const enterprise = cent(forecast.reduce((acc, year, i) => acc + year.freeCash / Math.pow(1.15, i + 1), 0) + discountedResidual);
  return { enterprise, residual, discountedResidual };
}

export function valueCompany(state: GameState): CompanyValue {
  const forecast = forecastCompany(state);
  const base = discountedValue(forecast);
  const low = discountedValue(forecastCompany(state, 'low'));
  const high = discountedValue(forecastCompany(state, 'high'));
  const balance = state.company.cash - state.company.debt;
  const equity = Math.max(0, cent(base.enterprise + balance));
  return {
    enterprise: base.enterprise, equity, low: Math.max(0, cent(Math.min(low.enterprise, base.enterprise, high.enterprise) + balance)),
    high: Math.max(0, cent(Math.max(low.enterprise, base.enterprise, high.enterprise) + balance)),
    residual: base.residual, residualShare: base.enterprise > 0 ? base.discountedResidual / base.enterprise : 0,
    discount: .15, multiple: 8, forecast, fundingGap: forecast.reduce((acc, year) => acc + year.fundingGap, 0),
    explanation: [
      'Five future operating years in constant fictional USD, including years after the 2050 scoring cutoff.',
      'Receipts use installed and committed capacity, clinical scope, observed utilization, demand, rivals and signed contracts. Active clinical evidence can support probability-weighted future operating scope.',
      'Payer advances fund matching care only; delivered starts are billed once at contracted prices. Royalties reduce only matching earned receipts.',
      'Quarterly commissioning and resource minima precede patient and trial follow-up, then new starts. Existing patient ages drive survival; future starts use mean age 54. Forecast maintenance capex is 2.5% annually of installed replacement cost, including deployment; 20% modeled cash tax is deducted; prepaid trial packages are not charged twice.',
      'Enterprise value discounts free cash flow at 15%, plus 8× positive recurring year-five free cash flow. Equity adds cash and subtracts debt; restricted compute credits are not cash.',
      'Low/base/high vary uptake, price, delivery cost and clinical probability. Funding gaps are disclosed; future financing is not assumed.',
      'There is no separate pipeline value, healthspan monetization or whole-market terminal value. Reserved options participate fully diluted at zero exercise cost.',
    ],
  };
}

/**
 * A check is a slice of an ALREADY RECORDED round. It adds no company money and
 * issues no shares. Optional offset identifies contiguous checks for exact cent
 * partitioning: [0,a) plus [a,a+b) equals [0,a+b), even at one-cent exits.
 * Pass a worker-computed suppliedValue to avoid repeating the operating forecast.
 */
export function sliceRound(state: GameState, roundId: string, check: Money, offset: Money = 0, suppliedValue?: CompanyValue): InvestorPosition {
  money(check, 'Investor check'); money(offset, 'Investor check offset');
  const round = state.company.rounds.find(r => r.id === roundId);
  if (!round) throw new RangeError('Select an actual recorded financing round.');
  if (check + offset > round.raised) throw new RangeError('The investor check must fit inside the recorded round.');
  const classItem = state.company.classes.find(c => c.id === round.classId);
  if (!classItem) throw new RangeError('The recorded round share class is missing.');
  const ratio = div(q(check), q(round.raised));
  const shares = mul(q(round.issuedShares), ratio);
  const totalShares = sum(state.company.classes.map(c => q(c.shares)));
  const valuation = suppliedValue ?? valueCompany(state);
  const payout = (exit: number): number => {
    const classProceeds = allocateExit(exit, state.company.classes).find(c => c.classId === round.classId)!.proceeds;
    const to = floor(div(mul(q(classProceeds), q(check + offset)), q(round.raised)));
    const from = floor(div(mul(q(classProceeds), q(offset)), q(round.raised)));
    return Number(to - from);
  };
  const proceeds = payout(valuation.equity);
  return { check, roundId, shares: encode(shares), initialOwnership: asNumber(div(q(check), q(round.postMoney))),
    ownership: asNumber(div(shares, totalShares)), proceeds, low: payout(valuation.low), high: payout(valuation.high),
    multiple: check > 0 ? proceeds / check : 0, entryValue: round.postMoney };
}

/** Reconstruct the fixed game opening cap table through its recorded funding rounds. */
export function investorDilutionHistory(state:GameState,roundId:string,check:Money):{year:number;round:string;ownership:number}[]{
 money(check,'Investor check');const entry=state.company.rounds.find(r=>r.id===roundId);if(!entry||check>entry.raised)throw new RangeError('Select a check inside a recorded round.');
 let company=initialCompany();const rows:{year:number;round:string;ownership:number}[]=[];
 for(const round of state.company.rounds){company=issueEquity(company,{id:round.id,name:round.name,cash:round.raised,preMoney:round.preMoney,poolTopup:round.poolTopup,credits:0,founderSeats:3,strategicControl:false},round.year);if(company.classes.some(c=>c.id===entry.classId)){const classShares=q(company.classes.find(c=>c.id===entry.classId)!.shares);const owned=mul(classShares,div(q(check),q(entry.raised)));rows.push({year:round.year,round:round.name,ownership:asNumber(div(owned,sum(company.classes.map(c=>q(c.shares)))))});}}
 return rows;
}
