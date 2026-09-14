import {describe,it,expect} from 'vitest';
import {advanceMonth,commitPlan,createCampaign,getView,options,previewPlan,projectMonth,runToNextDecision,validatePlan} from '../src/flow/engine';
import type {Action,State} from '../src/flow/types';
const M=100_000_000;
function fund(seed=2027){return commitPlan(createCampaign('fast',seed),[{type:'raise',amount:50*M}]);}
function ready(seed=2027){return advanceMonth(commitPlan(fund(seed),[{type:'license'},{type:'trial-team'},{type:'hire',people:12}]));}
function months(s:State,n:number){for(let i=0;i<n;i++)s=advanceMonth(s);return s;}
function population(s:State){return s.population.unassessed+s.population.ineligible+s.population.waiting+s.population.baselineCare+s.population.pendingTests.reduce((n,p)=>n+p.count,0)+s.cohorts.reduce((n,c)=>n+c.count,0);}
function replay(s:State){let r=createCampaign(s.scenario,s.seed);for(const cmd of s.commands){if(cmd.kind==='plan')r=commitPlan(r,cmd.actions);else r=months(r,cmd.months);}return r;}
describe('monthly treatment-route engine',()=>{
 it('starts with a real $5M balance, distinct $250M offer and one conserved autoimmune pool',()=>{const s=createCampaign();expect(s.company.cash).toBe(5*M);expect(getView(s).quote.preMoney).toBe(250*M);expect(population(s)).toBe(12000);expect(s.health.people).toBe(0);});
 it('plans remain paused and financing precedes expenses regardless of click order',()=>{const s=createCampaign(),a:Action[]=[{type:'license'},{type:'raise',amount:50*M},{type:'trial-team'}];const first=commitPlan(s,a),second=commitPlan(s,[...a].reverse());expect(first).toEqual(second);expect(first.month).toBe(0);expect(first.health.expected).toBe(0);expect(s.company.cash).toBe(5*M);expect(first.company.rounds[0].preMoney).toBe(250*M);});
 it('prevents combined overspending and reserves unpaid phase commitments',()=>{const s=createCampaign();expect(validatePlan(s,[{type:'expand',resource:'clinic'},{type:'expand',resource:'clinic'},{type:'expand',resource:'clinic'}]).valid).toBe(false);let low=advanceMonth(commitPlan(s,[{type:'trial-team'}]));expect(validatePlan(low,[{type:'start-study',productId:'immune-reset',mode:'own'}]).valid).toBe(false);expect(()=>commitPlan(low,[{type:'start-study',productId:'immune-reset',mode:'own'}])).toThrow(/short|Reserve/);});
 it('permits funded concurrent expansion and hiring packages rather than one hire per month',()=>{const s=commitPlan(fund(),[{type:'hire',people:7},{type:'hire',people:5},{type:'expand',resource:'clinic'}]);expect(s.projects).toHaveLength(3);const next=advanceMonth(s);expect(next.network.followupEmployees).toBe(18);expect(next.network.clinic).toBe(120);expect(advanceMonth(next).network.clinic).toBe(240);});
 it('does not deliver merely because a factory or clinic exists',()=>{const s=months(fund(),3);expect(s.accounts.every(a=>a.starts===0)).toBe(true);expect(s.health.expected).toBe(0);expect(s.cohorts).toHaveLength(0);});
 it('shows medicine as the first licensed route bottleneck and conserves every status',()=>{let s=advanceMonth(commitPlan(fund(),[{type:'license'}]));expect(s.accounts[0].starts).toBe(100);expect(s.population.pendingTests[0]).toMatchObject({count:100,eligible:75,readyAt:2});expect(population(s)).toBe(12000);expect(projectMonth(s).limiter).toBe('followup');for(let i=0;i<8;i++){s=advanceMonth(s);expect(population(s)).toBe(12000);}const ids=s.cohorts.flatMap(c=>Array.from({length:c.count},(_,i)=>c.firstPerson+i));expect(new Set(ids).size).toBe(ids.length);});
 it('baseline follow-up occupies real capacity without earning invented healthspan',()=>{const s=createCampaign(),p=projectMonth(s);expect(p.followupRequired).toBe(180);expect(p.followupDelivered).toBe(180);expect(s.health.people).toBe(0);expect(s.health.expected).toBe(0);});
 it('protects follow-up and shares clinic, testing and released dose capacity with studies',()=>{let s=commitPlan(ready(),[{type:'start-study',productId:'immune-reset',mode:'own'}]);s=months(s,3);const a=s.accounts.at(-1)!;expect(a.trialStarts).toBe(20);expect(a.starts).toBe(80);expect(a.starts+a.trialStarts).toBeLessThanOrEqual(s.network.supply);expect(a.tests).toBeLessThanOrEqual(s.network.tests);expect(a.followups).toBeLessThanOrEqual(s.network.followupEmployees*60);});
 it('charges the whole $12M owned phase exactly once, and preserves separate observation clocks',()=>{let s=commitPlan(ready(),[{type:'start-study',productId:'immune-reset',mode:'own'}]);const upfront=s.products[1].studies[0].paid,accountStart=s.accounts.length;s=months(s,10);expect(s.products[1].studies[0].stage).toBe('analysis');expect(s.products[1].studies[0].observed).toBe(6);s=advanceMonth(s);const t=s.products[1].studies[0];expect(['passed','failed']).toContain(t.stage);expect(t.paid).toBe(12*M);expect(upfront+s.accounts.slice(accountStart).reduce((n,a)=>n+a.research,0)).toBe(12*M);expect(s.status).toBe('slice-complete');});
 it('large recruitment capacity does not shorten six observation months',()=>{let s=ready();s.network.licensed=false;s.company.cash=1000*M;s.network.clinic=1200;s.network.tests=2000;s.network.supply=2000;s.network.followupEmployees=100;s=commitPlan(s,[{type:'start-study',productId:'immune-reset',mode:'codevelop'}]);s=months(s,4);expect(s.products[1].studies[0].stage).toBe('observation');expect(s.products[1].studies[0].observed).toBe(0);expect(months(s,5).products[1].studies[0].stage).toBe('observation');expect(months(s,6).products[1].studies[0].stage).toBe('analysis');});
 it('preserves authorized fixed efficacy and the running candidate when new AI arrives',()=>{let s=commitPlan(ready(),[{type:'start-study',productId:'immune-reset',mode:'own'}]);const authorized=structuredClone(s.products[0].authorized);s=months(s,3);expect(s.world.generation).toBe(1);expect(s.products[0].authorized).toEqual(authorized);expect(s.products[1].studies[0].generation).toBe(0);expect(s.products[1].candidate.generation).toBe(0);});
 it('a parallel design retains recruitment, spent money and accumulated observation',()=>{let s=months(commitPlan(ready(),[{type:'start-study',productId:'immune-reset',mode:'own'}]),3);const old=s.products[1].studies[0];s=commitPlan(s,[{type:'update',productId:'immune-reset',choice:'parallel'}]);expect(s.products[1].studies[0]).toEqual(old);s=advanceMonth(s);expect(s.products[1].candidate.generation).toBe(1);expect(s.products[1].studies[0].generation).toBe(0);expect(s.products[1].studies[0].enrolled).toBe(40);expect(s.products[1].studies[0].stage).toBe('observation');expect(validatePlan(s,[{type:'start-study',productId:'immune-reset',mode:'codevelop'}]).valid).toBe(true);});
 it('replacement stops only the named study at commissioning and retains enrolled people',()=>{let s=months(commitPlan(ready(),[{type:'start-study',productId:'immune-reset',mode:'own'}]),3);const oldStudy=s.products[1].studies[0],paid=oldStudy.paid;const before=s.cohorts.filter(c=>c.trialId===oldStudy.id).reduce((n,c)=>n+c.count,0);s=commitPlan(s,[{type:'update',productId:'immune-reset',choice:'replace'}]);expect(s.products[1].studies[0].stage).toBe('recruitment');s=advanceMonth(s);expect(s.products[1].studies[0].stage).toBe('stopped');expect(s.products[1].studies[0].paid).toBe(paid);expect(s.cohorts.filter(c=>c.trialId===oldStudy.id).reduce((n,c)=>n+c.count,0)).toBe(before);expect(population(s)).toBe(12000);});
 it('credits pay only defined line items with exact copays and no repeated consumption',()=>{let s=months(fund(),4);const p=previewPlan(s,[{type:'update',productId:'immune-reset',choice:'parallel'},{type:'lab-partnership'}]);expect(p.valid).toBe(true);expect(p.upfront).toBe(55_000_000);s=commitPlan(s,[{type:'update',productId:'immune-reset',choice:'parallel'},{type:'lab-partnership'}]);expect(s.company.credits).toBe(1.25*M);expect(s.creditsUsed).toBe(.75*M);s=advanceMonth(s);expect(s.company.credits).toBe(1.25*M);expect(s.products[1].candidate.generation).toBe(1);});
 it('cash settlement is exactly receipts minus exhaustively itemized costs',()=>{let s=ready();for(let i=0;i<7;i++){const before=s.company.cash;s=advanceMonth(s);const a=s.accounts.at(-1)!;expect(a.costs).toBe(a.payroll+a.medicine+a.testing+a.research+a.corporate+a.royalties);expect(s.company.cash-before).toBe(a.receipts-a.costs);expect(Number.isSafeInteger(s.company.cash)).toBe(true);}});
 it('run-to-decision is replayable ordinary time and stops on the first new consequence',()=>{const start=commitPlan(fund(),[{type:'license'}]);let s=runToNextDecision(start);expect(s.month).toBe(1);expect(s.events.some(e=>e.kind==='delivery')).toBe(true);expect(s).toEqual(replay(s));s=runToNextDecision(s);expect(s.month).toBeGreaterThan(1);expect(s).toEqual(replay(s));});
 it('repeated previews do not reroll a readout or alter command history',()=>{const s=commitPlan(ready(31),[{type:'start-study',productId:'immune-reset',mode:'codevelop'}]);const original=structuredClone(s);for(let i=0;i<3;i++)previewPlan(s,[{type:'hire',people:2}]);expect(s).toEqual(original);expect(months(s,11)).toEqual(months(original,11));});
 it('blocks a cancer trial in an autoimmune-only opening population',()=>{const s=months(ready(),4);expect(validatePlan(s,[{type:'start-study',productId:'cancer-vaccine',mode:'own'}]).reasons.join(' ')).toMatch(/oncology population/);});
 it('control loss prevents the next patient delivery',()=>{const s=ready();s.company.strategicControl=true;const people=s.health.people,next=advanceMonth(s);expect(next.status).toBe('control-loss');expect(next.health.people).toBe(people);expect(next.accounts).toHaveLength(s.accounts.length);});
 it('ends the opening proof at month24 rather than pretending a 2050 campaign exists',()=>{const s=months(commitPlan(createCampaign(),[{type:'raise',amount:75*M}]),30);expect(s.month).toBe(24);expect(s.status).toBe('slice-complete');expect(getView(s).milestone.detail).toMatch(/Human review gate/);});
 it('keeps private AI release dates out of next-decision text',()=>{const s=fund();expect(getView(s).nextDecision.label).not.toContain('AI');expect(options(s).some(o=>o.id==='study-own'&&o.totalCommitment===12*M)).toBe(true);});
 it('does not bill trial follow-up twice as commercial care or collect evidence without staffed visits',()=>{
  let s=commitPlan(ready(),[{type:'start-study',productId:'immune-reset',mode:'sponsored'}]);s=months(s,4);
  const p=projectMonth(s);expect(p.followupDelivered-p.commercialFollowups!).toBe(40);expect(p.sponsoredObservation).toBe(40);
  const studied=s.products[1].studies[0];s.network.followupEmployees=1;
  const shortage=projectMonth(s);expect(shortage.sponsoredObservation).toBe(0);expect(shortage.followupDelivered).toBe(60);
  const observed=studied.observed;s=advanceMonth(s);expect(s.products[1].studies[0].observed).toBe(observed);
  expect(s.accounts.at(-1)!.receipts).toBe(s.accounts.at(-1)!.commercialFollowups!*25_000);
 });
 it('distinguishes eligibility screening from pre-dose safety work within laboratory capacity',()=>{const s=advanceMonth(commitPlan(fund(),[{type:'license'}]));const p=projectMonth(s);expect(p.tests).toBe(p.eligibilityTests!+p.safetyTests!);expect(p.safetyTests).toBe(p.starts+p.trialStarts);});

 it('offers an action even when it needs financing in the same pending plan',()=>{
  let s=advanceMonth(commitPlan(createCampaign(),[{type:'trial-team'}]));
  expect(options(s).find(o=>o.id==='study-own')!.available).toBe(true);
  expect(validatePlan(s,[{type:'start-study',productId:'immune-reset',mode:'own'}]).valid).toBe(false);
  expect(validatePlan(s,[{type:'start-study',productId:'immune-reset',mode:'own'},{type:'raise',amount:30*M}]).valid).toBe(true);
 });
 it('can actually begin a parallel newer-generation study without cancelling the first',()=>{
  let s=months(commitPlan(ready(),[{type:'start-study',productId:'immune-reset',mode:'own'}]),3);
  s=advanceMonth(commitPlan(s,[{type:'update',productId:'immune-reset',choice:'parallel'}]));
  s=commitPlan(s,[{type:'start-study',productId:'immune-reset',mode:'codevelop'}]);
  const [old,newer]=s.products[1].studies;expect(old.generation).toBe(0);expect(old.stage).toBe('observation');expect(newer.generation).toBe(1);expect(newer.stage).toBe('preparation');
 });
 it('names the pending plan milestone rather than the unchanged opening-state review',()=>{const s=fund(),p=previewPlan(s,[{type:'license'}]);expect(p.milestoneLabel).toBe('First partner treatments');expect(p.monthsToMilestone).toBe(1);});

 it('recommends one sustained staffing batch instead of another hire every month',()=>{
  let s=advanceMonth(commitPlan(fund(),[{type:'license'}]));
  expect(projectMonth(s).sustainedFollowupRequired).toBe(780);expect(projectMonth(s).recommendedFollowupHires).toBe(7);
  expect(options(s).find(o=>o.id==='hire')!.action).toEqual({type:'hire',people:7});
  s=commitPlan(s,[{type:'hire',people:7}]);expect(projectMonth(s).recommendedFollowupHires).toBe(0);
  for(let i=0;i<12;i++){s=advanceMonth(s);expect(projectMonth(s).recommendedFollowupHires).toBe(0);}
 });
 it('staffing target ignores the blocked follow-up input but includes funded future trial participants',()=>{
  let s=ready();s.network.followupEmployees=3;
  expect(projectMonth(s).starts).toBe(0);expect(projectMonth(s).sustainedFollowupRequired).toBe(780);
  s=commitPlan(s,[{type:'start-study',productId:'immune-reset',mode:'codevelop'}]);
  expect(projectMonth(s).sustainedFollowupRequired).toBe(820);expect(projectMonth(s).recommendedFollowupHires).toBe(11);
 });
 it('staffing does not invent an unlicensed launch or an infinite eligible population',()=>{
  const s=createCampaign();expect(projectMonth(s).sustainedFollowupRequired).toBe(180);expect(projectMonth(s).recommendedFollowupHires).toBe(0);
  s.network.licensed=true;s.population.unassessed=0;s.population.waiting=3;s.population.pendingTests=[];s.population.ineligible=11817;
  expect(projectMonth(s).sustainedFollowupRequired).toBe(183);expect(projectMonth(s).recommendedFollowupHires).toBe(0);
 });

 it('reports actual insolvency, retained-control failure and timebox endings',()=>{
  const insolvent=months(createCampaign(),8);expect(insolvent.status).toBe('insolvent');expect(getView(insolvent).milestone.title).toBe('Cash exhausted');
  const lost=fund();lost.company.control='lost';expect(getView(advanceMonth(lost)).milestone.title).toBe('Company control lost');
  const timebox=months(commitPlan(createCampaign(),[{type:'raise',amount:75*M}]),24);expect(getView(timebox).milestone.title).toBe('24-month review reached');expect(getView(timebox).milestone.detail).toContain('no Phase 1 readout');
 });
 it('labels passed and failed observed clinical readouts distinctly',()=>{
  const success=months(commitPlan(ready(2027),[{type:'start-study',productId:'immune-reset',mode:'codevelop'}]),11);
  const failure=months(commitPlan(ready(1),[{type:'start-study',productId:'immune-reset',mode:'codevelop'}]),11);
  expect(success.products[1].studies[0].stage).toBe('passed');expect(getView(success).milestone.title).toBe('Phase 1 supports advancement');
  expect(failure.products[1].studies[0].stage).toBe('failed');expect(getView(failure).milestone.title).toBe('Phase 1 blocks advancement');
  expect(getView(success).milestone.detail).toContain('not commercially authorized');expect(getView(failure).milestone.detail).toContain('safety or response threshold');
 });

 it('replacement preview removes the obsolete readout and forecasts only the funded design milestone',()=>{
  const s=months(commitPlan(ready(),[{type:'start-study',productId:'immune-reset',mode:'own'}]),3);
  const action:Action={type:'update',productId:'immune-reset',choice:'replace'},p=previewPlan(s,[action]);
  expect(p.monthsToMilestone).toBe(1);expect(p.milestoneLabel).toContain('replacement ready');expect(p.milestoneLabel).toContain('new Phase 1 unfunded');expect(p.milestoneLabel).not.toContain('readout');
  expect(p.effects.join(' ')).toContain('new Phase 1 is not funded');
  const planned=commitPlan(s,[action]);expect(getView(planned).nextDecision.detail).toContain('old readout is no longer');
  const reached=runToNextDecision(planned);expect(reached.month).toBe(s.month+1);expect(reached.products[1].candidate.generation).toBe(1);expect(reached.products[1].studies[0].stage).toBe('stopped');expect(reached.products[1].studies).toHaveLength(1);expect(p.cashAtMilestone).toBe(reached.company.cash);
  expect(reached.events.some(e=>e.month===reached.month&&e.major&&e.title.includes('is ready for a study'))).toBe(true);
 });
 it('parallel design interrupts at availability while retaining the original study readout',()=>{
  const s=months(commitPlan(ready(),[{type:'start-study',productId:'immune-reset',mode:'own'}]),3);
  const action:Action={type:'update',productId:'immune-reset',choice:'parallel'},p=previewPlan(s,[action]);
  expect(p.monthsToMilestone).toBe(1);expect(p.milestoneLabel).toContain('candidate ready');expect(p.milestoneLabel).toContain('existing study continues');
  const reached=runToNextDecision(commitPlan(s,[action]));expect(reached.month).toBe(s.month+1);expect(reached.products[1].studies[0].stage).toBe('observation');expect(reached.products[1].studies[0].generation).toBe(0);expect(getView(reached).nextDecision.label).toContain('Phase 1 readout');
  expect(getView(reached).nextDecision.months).toBe(7);
 });

});
