import type { DealDefinition, DealVariant, EventDefinition, Family, ProgramDefinition, RegionDefinition, ReleaseDefinition, ScenarioId } from '../core/types';

/** Every geography, organization, clinical outcome and financial term is fictional. */
export const CONTENT_NOTICE = 'Fictional game assumptions in constant USD. No clinical forecasts, investment advice, or real transaction terms.';
const M = 100_000_000;

export const JURISDICTIONS = [
  { id: 0, name: 'Pacific Compact', description: 'Product approvals first; a funded demonstration can open a platform agenda.', evidence: 'Prospective outcomes and portable records', recognition: 'Compact-wide recognition after an implementation period' },
  { id: 1, name: 'Northern Union', description: 'Joint review rewards broad evidence, but requires a funded follow-up obligation.', evidence: 'Broad cohorts and continuity guarantees', recognition: 'Mutual recognition after audited operations' },
  { id: 2, name: 'Eastern Partnership', description: 'Regional access can scale quickly when local capacity and affordability are credible.', evidence: 'Local bridging cohort and manufacturing controls', recognition: 'Local bridging remains necessary until negotiated recognition' },
] as const;

export const REGIONS: RegionDefinition[] = [
  { id: 'pacific', name: 'Pacific Corridor', jurisdiction: 0, x: 17, y: 43, population: 75_000_000, description: 'Your opening clinical hub: strong research, scarce delivery capacity.' },
  { id: 'northeast', name: 'Atlantic Cities', jurisdiction: 0, x: 31, y: 36, population: 130_000_000, description: 'Dense hospitals and a large treatment queue; rivals bid for the same staff.' },
  { id: 'rhine', name: 'Rhine Network', jurisdiction: 1, x: 50, y: 34, population: 110_000_000, description: 'Experienced manufacturers, demanding evidence review, and pooled purchasers.' },
  { id: 'nordic', name: 'Northern Arc', jurisdiction: 1, x: 53, y: 22, population: 45_000_000, description: 'Excellent longitudinal records support durable evidence and follow-up.' },
  { id: 'east-asia', name: 'Eastern Metros', jurisdiction: 2, x: 80, y: 43, population: 420_000_000, description: 'Deep manufacturing capacity; local bridging and affordability unlock scale.' },
  { id: 'south-asia', name: 'Southern Mosaic', jurisdiction: 2, x: 71, y: 60, population: 620_000_000, description: 'The largest unmet need; distributed clinics and reliable follow-up determine access.' },
];

export const INFRASTRUCTURE: Record<Family, { name: string; description: string; baseCost: number; duration: number }> = {
  diagnostics: { name: 'Diagnostic fabric', description: 'Identify eligible people and measure the patient-specific starting point.', baseCost: .7 * M, duration: 2 },
  clinic: { name: 'Clinical delivery', description: 'Trained teams turn eligible demand into initiated care.', baseCost: 1.2 * M, duration: 3 },
  manufacturing: { name: 'Manufacturing mesh', description: 'Validated production and release testing constrain personalized batches.', baseCost: 1.6 * M, duration: 4 },
  evidence: { name: 'Evidence system', description: 'Recruit and observe cohorts; preserve auditability as versions change.', baseCost: .9 * M, duration: 3 },
  followup: { name: 'Continuity service', description: 'Maintain benefit through monitoring, retreatment and retention.', baseCost: .6 * M, duration: 2 },
  network: { name: 'Partner network', description: 'Replicate qualified delivery sites; standards and staff still constrain each site.', baseCost: 1.4 * M, duration: 4 },
};

/** level is the CURRENT level; buying its next level costs this much. */
export function buildCost(family: Family, level: number): number {
  if (!Number.isInteger(level) || level < 0 || level > 30) throw new RangeError('Infrastructure level must be an integer from 0 to 30.');
  return Math.round(INFRASTRUCTURE[family].baseCost * Math.pow(family === 'network' ? 2.05 : 1.62, level));
}
export function buildDuration(family: Family): number { return INFRASTRUCTURE[family].duration; }
export function siteCount(level: number): number {
  if (!Number.isInteger(level) || level < 0) throw new RangeError('Network level must be a nonnegative integer.');
  return [1, 20, 100, 600, 4_000, 25_000, 160_000, 600_000, 1_200_000][Math.min(level, 8)]!;
}
export function infrastructureCapacity(levels: Record<Family, number>, compute = 1, biology = 1): number {
  if (['diagnostics', 'clinic', 'manufacturing', 'followup'].some(f => levels[f as Family] < 1)) return 0;
  const perSite = Math.min(
    160 * (1 + .35 * (levels.diagnostics - 1)) * Math.pow(Math.max(.1, compute), .2),
    100 * (1 + .3 * (levels.clinic - 1)),
    140 * (1 + .4 * (levels.manufacturing - 1)) * Math.pow(Math.max(.1, biology), .25),
    120 * (1 + .4 * (levels.followup - 1)),
  );
  return Math.floor(perSite * siteCount(levels.network));
}

export const PROGRAMS: ProgramDefinition[] = [
  { id: 'autoimmune-care', name: 'Autoimmune continuity', family: 'autoimmune', modality: 'Conventional care', description: 'Available now. Modest durable gains depend on continuing access; the world comparator also improves.', available: 2027, initialStage: 'approved', benefit: 1.1, durability: .86, response: .70, harm: .008, cost: 42_000, price: 65_000, scope: 'Established autoimmune symptom control' },
  { id: 'immune-reset', name: 'Immune reset', family: 'autoimmune', modality: 'Engineered cell therapy', description: 'A larger possible gain with manufacturing, acute safety and long observation obligations.', available: 2027, initialStage: 'preclinical', benefit: 6.2, durability: .91, response: .77, harm: .038, cost: 180_000, price: 280_000, scope: 'Refractory autoimmune disease after eligibility review' },
  { id: 'cancer-rna', name: 'Personalized cancer RNA', family: 'oncology', modality: 'Individualized RNA', description: 'Fast design becomes useful only after clinical evidence, production release and tumor-specific delivery align.', available: 2029, initialStage: 'preclinical', benefit: 3.8, durability: .83, response: .61, harm: .023, cost: 110_000, price: 175_000, scope: 'Biomarker-selected adjuvant oncology' },
  { id: 'onco-cell', name: 'Precision oncology cells', family: 'oncology', modality: 'Engineered cell therapy', description: 'High potential response, intensive clinic use, and a consequential acute harm signal.', available: 2032, initialStage: 'preclinical', benefit: 5.4, durability: .88, response: .72, harm: .057, cost: 230_000, price: 340_000, scope: 'Selected relapsed oncology indications' },
  { id: 'neuro-care', name: 'Cognitive continuity', family: 'neuro', modality: 'Conventional coordinated care', description: 'An immediately available care pathway with small annual gains and substantial continuity needs.', available: 2027, initialStage: 'approved', benefit: .9, durability: .81, response: .58, harm: .006, cost: 50_000, price: 72_000, scope: 'Supportive care for established neurological impairment' },
  { id: 'personalized-neuro', name: 'Personalized neural repair', family: 'neuro', modality: 'Future individualized biologic', description: 'A deliberately speculative future modality. Better models do not substitute for long neurological observation.', available: 2041, initialStage: 'preclinical', benefit: 4.6, durability: .89, response: .56, harm: .045, cost: 90_000, price: 140_000, scope: 'Future biomarker-selected neurodegeneration' },
];

export const SCENARIOS = {
  convergence: { name: 'Convergent acceleration', description: 'Design, wet-lab validation and production improve together. The early research window is unusually valuable; access and continuity become the later constraint.' },
  staggered: { name: 'Staggered abundance', description: 'Cheap models arrive before biological validation. Portable evidence and careful cash management buy time; manufacturing and access accelerate later.' },
} satisfies Record<ScenarioId, { name: string; description: string }>;
export function scenarioDescription(scenario: ScenarioId): string { return SCENARIOS[scenario].description; }

/** Step multipliers, applied once on the release quarter. */
export const RELEASES: ReleaseDefinition[] = [
  { id: 'atlas', year: 2028, title: 'Atlas design models', detail: 'Candidate design becomes cheap. Evidence teams, assay access and version selection gain strategic value.', research: 1.35, compute: 2.0, biology: 1.10, access: 1.05, version: 2 },
  { id: 'bench', year: 2030, title: 'Bench-scale autonomous labs', detail: 'Experiments become faster. Early clinical programs can enter scarce observational capacity before rivals.', research: 1.50, compute: 1.8, biology: 1.25, access: 1.08, version: 3 },
  { id: 'compiler', year: 2033, title: 'Biological design compiler', detail: 'Personalized designs proliferate; a product-by-product approval strategy now has a substantial opportunity cost.', research: 1.65, compute: 2.2, biology: 1.35, access: 1.12, version: 4 },
  { id: 'release', year: 2036, title: 'Rapid batch release', detail: 'Validated production improves. Clinics and follow-up, rather than design, increasingly decide who benefits.', research: 1.35, compute: 1.9, biology: 1.70, access: 1.18, version: 5 },
  { id: 'federation', year: 2039, title: 'Federated evidence models', detail: 'Portable evidence supports cross-jurisdiction recognition. Exclusive contracts may now strand valuable evidence.', research: 1.45, compute: 2.0, biology: 1.35, access: 1.40, version: 6 },
  { id: 'neural', year: 2043, title: 'Neural-state models', detail: 'A new neuro opportunity appears, but observation time makes late starts costly and uncertainty remains.', research: 1.80, compute: 2.8, biology: 1.30, access: 1.20, version: 7 },
  { id: 'commons', year: 2046, title: 'Distributed care commons', detail: 'Rivals can also scale. The comparator improves quickly; differentiation depends on underserved access and continuity.', research: 1.25, compute: 2.0, biology: 1.50, access: 1.50, version: 8 },
  { id: 'abundance', year: 2049, title: 'Personalization at the edge', detail: 'Routine design is abundant. The last initiation window favors operating networks over unfinished experiments.', research: 1.30, compute: 2.4, biology: 1.35, access: 1.35, version: 9 },
];

export function releasesForScenario(scenario: ScenarioId): ReleaseDefinition[] {
  if (scenario === 'convergence') return RELEASES.map(r => ({ ...r }));
  const years = [2028, 2031, 2034, 2038, 2041, 2044, 2047, 2049];
  return RELEASES.map((r, i) => ({ ...r, year: years[i]!,
    research: i < 3 ? 1 + (r.research - 1) * .65 : r.research * 1.06,
    compute: i < 3 ? r.compute * 1.2 : r.compute,
    biology: i < 3 ? 1.04 : r.biology * 1.12,
    access: i < 3 ? 1.02 : r.access * 1.08,
    detail: i < 3 ? `${r.detail} In this scenario, wet-lab and deployment gains lag the model release.` : `${r.detail} Delayed biological and access improvements are now arriving.`,
  }));
}

const term = (name: string, description: string, overrides: Partial<DealVariant>): DealVariant => {
  const result: DealVariant = { name, description, cash: 0, credits: 0, preMoney: 0, poolTopup: 0, annualCost: 0, annualRevenue: 0, royalty: 0,
    capacity: 0, duration: 5, exclusive: false, portable: true, founderSeats: 3, strategicControl: false, ...overrides };
  for (const field of ['cash', 'credits', 'preMoney', 'annualCost', 'annualRevenue'] as const) result[field] = Math.round(result[field]);
  return result;
};

export const DEALS: DealDefinition[] = [
  { id: 'equity', family: 'equity', name: 'Mission capital', availableYear: 2027, description: 'Real dilution buys operating time. Larger checks can transfer the ability to set strategy.', variants: [
    term('Patient seed', '$18M at $72M pre-money; no pool reset, portable partnerships, founders retain three seats.', { cash: 18 * M, preMoney: 72 * M, founderSeats: 3 }),
    term('Scale round', '$40M at $80M pre-money, 15% post-round option reserve; founders retain three seats but accept more dilution.', { cash: 40 * M, preMoney: 80 * M, poolTopup: .15, founderSeats: 3 }),
    term('Control bid', '$120M at $180M pre-money; the investor controls strategic decisions and founders keep one seat.', { cash: 120 * M, preMoney: 180 * M, poolTopup: .15, founderSeats: 1, strategicControl: true }),
  ] },
  { id: 'frontier', family: 'frontier', name: 'Frontier model partnership', availableYear: 2028, description: 'Compute can reduce research bills; restricted credits cannot fund salaries or clinics.', variants: [
    term('Portable compute', '$6M restricted credits, $0.6M/year for three years; no cash or exclusivity.', { credits: 6 * M, annualCost: .6 * M, duration: 3 }),
    term('Lab alliance', '$8M cash at $80M pre-money plus $15M restricted credits; five-year access costs $1M/year and a 2% royalty.', { cash: 8 * M, credits: 15 * M, preMoney: 80 * M, annualCost: M, royalty: .02 }),
    term('Exclusive frontier', '$20M cash at $100M pre-money and $40M credits; seven-year exclusivity, 6% royalty and nonportable evidence. Founders retain three seats and strategic authority.', { cash: 20 * M, credits: 40 * M, preMoney: 100 * M, annualCost: 1.5 * M, royalty: .06, duration: 7, exclusive: true, portable: false, founderSeats: 3, strategicControl: false }),
  ] },
  { id: 'therapy', family: 'therapy', name: 'Therapy rights', availableYear: 2029, description: 'License one program, preserve trial obligations, and decide who owns the improvement path.', variants: [
    term('Nonexclusive access', '$0.18M annual design license for five years and a 4% program royalty; validated assays improve readiness and reduce future study budgets 20%. Clinical approval still requires evidence.', { annualCost: .18 * M, royalty: .04 }),
    term('Co-development', '$0.7M/year plus 10% program royalty for seven years; a partner supplies 8,000 transferable annual clinic/production slots; royalties and study rights cover only the selected program.', { annualCost: .7 * M, royalty: .10, capacity: 8_000, duration: 7 }),
    term('Exclusive platform', '$3.5M/year and 3% program royalty for eight years; 24,000 transferable annual clinic/production slots, restricted evidence and an exclusive program commitment. Royalties cover only the selected program.', { annualCost: 3.5 * M, royalty: .03, capacity: 24_000, duration: 8, exclusive: true, portable: false }),
  ] },
  { id: 'hospital', family: 'hospital', name: 'Hospital alliance', availableYear: 2027, description: 'Buy staffed throughput now; a network contract still needs manufacturing and longitudinal care.', variants: [
    term('Open referral', '2,400 annual slots for $0.8M/year over three years; portable records and no lock-in.', { annualCost: .8 * M, capacity: 2_400, duration: 3 }),
    term('Regional anchor', '12,000 annual slots for $2.5M/year over five years; local exclusivity, portable evidence.', { annualCost: 2.5 * M, capacity: 12_000, exclusive: true }),
    term('National pathway', '80,000 annual slots for $11M/year over seven years; exclusive referrals and nonportable hospital records.', { annualCost: 11 * M, capacity: 80_000, duration: 7, exclusive: true, portable: false }),
  ] },
  { id: 'manufacturing', family: 'manufacturing', name: 'Production reservation', availableYear: 2027, description: 'Reserved qualified batches protect supply, but take-or-pay costs survive low utilization.', variants: [
    term('Flexible batches', '4,000 annual batches for $1.1M/year over three years; portable methods and no exclusivity.', { annualCost: 1.1 * M, capacity: 4_000, duration: 3 }),
    term('Dedicated line', '25,000 annual batches for $4M/year over five years; exclusive line access with transferable evidence.', { annualCost: 4 * M, capacity: 25_000, exclusive: true }),
    term('Global mesh', '150,000 annual batches for $15M/year over eight years; a 2% program royalty and nonportable release process.', { annualCost: 15 * M, capacity: 150_000, royalty: .02, duration: 8, exclusive: true, portable: false }),
  ] },
  { id: 'payer', family: 'payer', name: 'Access purchasing', availableYear: 2028, description: 'Prepaid autoimmune continuity care unlocks delivery working capital. Lower population prices trade margin for reach; fixed access obligations survive under-delivery. Prepayments cannot fund construction or research.', variants: [
    term('Access pilot', '30,000 autoimmune continuity starts/year: up to $22M receipts, $0.5M fixed access obligation, three years. Restricted quarterly prepayment funds matching care; portable evidence.', { annualRevenue: 22 * M, annualCost: .5 * M, capacity: 30_000, duration: 3 }),
    term('Outcomes contract', '1M autoimmune continuity starts/year: up to $600M receipts, $5M fixed outcomes obligation, five years. Restricted care prepayment and portable evidence; lower price than retail.', { annualRevenue: 600 * M, annualCost: 5 * M, capacity: 1_000_000 }),
    term('Population guarantee', '6M autoimmune continuity starts/year: up to $3B receipts, $30M fixed access obligation, seven years. Restricted care prepayment at lower margin; exclusive access and nonportable outcomes data.', { annualRevenue: 3000 * M, annualCost: 30 * M, capacity: 6_000_000, duration: 7, exclusive: true, portable: false }),
  ] },
];

export const EVENTS: EventDefinition[] = [
  { id: 'design-surplus', kind: 'world', title: 'Design is no longer scarce', trigger: 'model-release', detail: 'New versions multiply candidate opportunities. Existing studies remain valid for their enrolled version; switching requires a bridge.' },
  { id: 'queue-pressure', kind: 'network', title: 'The queue outgrows the clinic', trigger: 'utilization-high', detail: 'Eligible people accumulate faster than staffed treatment slots. More compute cannot remove this delivery bottleneck.' },
  { id: 'batch-shortfall', kind: 'network', title: 'Production is the limiting step', trigger: 'manufacturing-bottleneck', detail: 'Personalized batches await qualified release. A production reservation or manufacturing upgrade can restore throughput.' },
  { id: 'followup-fragility', kind: 'warning', title: 'Continuity is fraying', trigger: 'followup-bottleneck', detail: 'The treated population now needs more longitudinal support. Unfunded continuity reduces expected future benefit.' },
  { id: 'observation-clock', kind: 'clinical', title: 'Biology still takes time', trigger: 'study-observation', detail: 'Enrollment is complete; durability and harms still require observation. Model releases do not erase this clock.' },
  { id: 'version-bridge', kind: 'clinical', title: 'A new design version is available', trigger: 'version-gap', detail: 'A bridge can preserve some evidence while measuring the changed therapy. Immediate replacement would exceed the supported scope.' },
  { id: 'policy-window', kind: 'policy', title: 'A platform agenda opens', trigger: 'platform-qualified', detail: 'Demonstrated quality, outcomes and operating scale create a chance to negotiate a platform charter.' },
  { id: 'recognition-divide', kind: 'policy', title: 'Evidence meets a border', trigger: 'new-jurisdiction', detail: 'A local bridge or mutual recognition agreement is required before platform evidence can support expanded scope.' },
  { id: 'rival-access', kind: 'world', title: 'Rivals expand the alternative', trigger: 'rival-expansion', detail: 'Other providers add capacity. Your counterfactual now includes earlier treatment elsewhere, reducing the incremental gain of some starts.' },
  { id: 'funding-gap', kind: 'finance', title: 'Operating commitments exceed cash', trigger: 'runway-short', detail: 'Licenses, take-or-pay capacity and ongoing care remain payable. Restricted compute credits cannot close the operating gap.' },
  { id: 'control-warning', kind: 'finance', title: 'Control requires a cure', trigger: 'control-at-risk', detail: 'Economic dilution and contractual rights are distinct. Restore the required governance position within the cure window or the mission ends.' },
  { id: 'last-window', kind: 'ending', title: 'The initiation window closes', trigger: 'year-2050', detail: 'Only care actually initiated by the campaign cutoff enters lifetime healthspan. Existing cohorts retain their modeled future gains, harms and continuity obligations.' },
];
