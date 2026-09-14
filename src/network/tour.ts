import type {Action,State} from './types';
import {commitPlan,previewPlan,projectOperations,validatePlan,continuingCare} from './engine';

export const TOUR_SEED=2027;
export const TOUR_SCENARIO='convergence' as const;
export const TOUR_POLICY_VERSION='conservative-2';
export const TOUR_STAGES=[
 {id:'foundation',tick:0,title:'Make a working care network',detail:'Expand the opening treatment bottleneck. Compare owning a clinic with using a partner, then inspect what the network earns and spends.'},
 {id:'capital',tick:12,title:'Buy time and preserve options',detail:'Compare the current financing price with the cash-flow valuation. Choose a check size in Business and see what dilution does to that stake.'},
 {id:'clinical',tick:28,title:'Launch now or wait for better medicine',detail:'Compare an available product with a stronger AI-designed candidate. Starting a study, changing the candidate and waiting all carry visible costs.'},
 {id:'platform',tick:48,title:'Prepare for a different delivery system',detail:'Choose whether to build evidence, influence platform approval or expand conventional care. Rule changes and manufacturing equipment are separate requirements.'},
 {id:'scale',tick:72,title:'Reach people at population scale',detail:'Inspect the supply and testing needed for regional expansion. Local production, home treatment and immune wearables may create new routes if technology and permissions are ready.'},
 {id:'stewardship',tick:96,title:'What did the network make possible?',detail:'Compare added healthspan, the company’s operating economics, retained control and hypothetical investor proceeds. Both a successful network and a failed strategy are valid outcomes.'},
] as const;
export const TOUR_DELEGATION='Between stops, ordinary quarterly operations and funded studies continue. Delegation may expand an already connected owned clinic when the preview improves both care capacity and operating cash flow and retains a cash reserve. It never raises money, sells assets, signs deals, starts another study phase, changes a therapy, adopts AI designs, buys new technology or spends on policy. New AI generations, clinical results, reform and funding risks return control to you.';

export interface TourStopReason {kind:'stage'|'risk'|'clinical'|'world'|'policy'|'ended'|'blocked';title:string;detail:string;tick:number}
export interface DelegatedQuarter {tick:number;actions:Action[];rationale:string;observed:{cashChange:number;starts:number;revenue:number;costs:number;healthspanChange:number;eventIds:string[]}}
export interface TourResult {state:State;stopReason:TourStopReason;delegatedActions:DelegatedQuarter[];policyVersion:typeof TOUR_POLICY_VERSION}
export function tourStageAt(tick:number){return [...TOUR_STAGES].reverse().find(stage=>stage.tick<=tick)??TOUR_STAGES[0];}

/** Calendar chapters remain stable; their advice acknowledges achieved milestones. */
export function tourBrief(state:State):{title:string;detail:string}{
 const stage=tourStageAt(state.tick);
 if(stage.id==='foundation'&&state.facilities.filter(f=>(f.kind==='clinic'||f.kind==='hospital')&&f.status==='operating'&&(f.owner==='db'||f.owner==='partner')).reduce((n,f)=>n+f.capacity,0)>80)return {title:'Your care network is taking shape',detail:'Compare receipts, costs and remaining bottlenecks. You can prepare a trial, preserve cash or expand before the next calendar chapter.'};
 if(stage.id==='capital'&&state.company.rounds.length)return {title:'Make the capital last',detail:'Your financing is in place. Watch the next clinical milestone, operating runway and dilution before deciding whether to raise again.'};
 if(stage.id==='clinical'&&state.programs.some(p=>p.id!=='standard-autoimmune'&&p.authorizedCandidate))return {title:'Turn authorized medicine into access',detail:'An advanced treatment is available. Compare expanding its delivery with funding a stronger candidate; authorization alone adds no healthspan.'};
 if(stage.id==='platform'&&state.policy.stage==='personal')return {title:'The rules have changed. Adapt the network.',detail:'Personal authorization is operating. Compare the equipment, qualified therapies and continuing-care capacity needed for local or home delivery; more lobbying alone cannot supply them.'};
 if(stage.id==='platform'&&state.policy.stage==='platform')return {title:'Use the approved platform',detail:'Platform approval is in place. Deploy a compatible service, prepare stronger evidence or seek personal authorization. Each still needs a funded delivery network.'};
 return stage;
}

function risk(state:State):TourStopReason|null{
 const reason=(title:string,detail:string):TourStopReason=>({kind:'risk',title,detail,tick:state.tick});
 if(state.cureUntil!==null||state.company.cash<0)return reason('Funding needs your decision','The company is in its funding cure period. Delegation cannot raise money or sell an asset for you.');
 const p=projectOperations(state),burn=Math.max(0,-p.cashFlow);
 if(burn>0&&state.company.cash<burn*4)return reason('Less than one year of operating runway','The current care network is spending more than it earns. Review financing, revenue, commitments or asset sales before delegating again.');
 const gaps=Object.entries(continuingCare(state)).filter(([,care])=>care.delivered<care.required);
 if(gaps.length)return reason('Continuing care needs attention',gaps.map(([id,care])=>`${state.facilities.find(f=>f.id===id)?.name}: ${care.required.toLocaleString()} follow-up visits needed, ${care.delivered.toLocaleString()} supported.`).join(' ')+' Hire follow-up staff at the affected clinical site. Historical harm remains in the score, but delegation can resume once current support is restored.');
 const failed=state.programs.find(p=>p.study?.failed);
 if(failed)return {kind:'clinical',title:`${failed.name}: study decision required`,detail:'The study failed. Review the result and decide whether to stop or change the candidate; delegation cannot make that choice.',tick:state.tick};
 return null;
}

/** No new architecture or product is selected. A known, connected service may grow. */
function routineActions(state:State):{actions:Action[];rationale:string}{
 const current=projectOperations(state);
 const remainingStudies=state.programs.reduce((sum,p)=>sum+(p.study&&!p.study.paused?Math.max(0,p.study.cost-(p.study.spent??0)):0),0);
 const reserve=Math.max(current.costs,Math.max(0,-current.cashFlow)*4)+remainingStudies;
 const sites=state.facilities.filter(f=>f.owner==='db'&&f.status==='operating'&&(f.kind==='clinic'||f.kind==='hospital')&&f.lastStarts>0&&!state.projects.some(p=>p.siteId===f.id)).sort((a,b)=>a.id.localeCompare(b.id));
 for(const site of sites){
  if(!(['medicine','tests','patients'] as const).every(kind=>state.links.some(l=>l.active&&l.to===site.id&&l.kind===kind)))continue;
  const action:Action={type:'expand',siteId:site.id};
  if(!validatePlan(state,[action]).valid)continue;
  const preview=previewPlan(state,[action]);
  if(preview.cashAfter<reserve||preview.ready.starts<=current.starts||preview.ready.cashFlow<=current.cashFlow)continue;
  return {actions:[action],rationale:`Expand ${site.name}: the connected network can treat more people and improve quarterly operating cash flow, while retaining the disclosed cash reserve. No new treatment or delivery technology is selected.`};
 }
 return {actions:[],rationale:'Continue ordinary care, follow-up, funded construction and any study already approved by the player. No additional investment meets the conservative expansion rule.'};
}

/** Pure bounded delegation. Every resolved quarter is an ordinary replayable engine command. */
export function advanceTour(input:State):TourResult{
 let state=structuredClone(input);
 const delegatedActions:DelegatedQuarter[]=[];
 const finish=(stopReason:TourStopReason):TourResult=>({state,stopReason,delegatedActions,policyVersion:TOUR_POLICY_VERSION});
 const ended=()=>finish({kind:'ended',title:state.status==='victory'?'The healthspan target was reached':state.status==='partial'?'The campaign reached 2050':'The campaign has ended',detail:'Review the actual healthspan, finances, ownership and decisions. Delegation does not guarantee success.',tick:state.tick});
 if(state.status!=='active'||state.tick>=96)return ended();
 const target=TOUR_STAGES.find(stage=>stage.tick>state.tick)??TOUR_STAGES[5];
 // The absolute bound is intentional even if a future engine change stops advancing time.
 for(let i=0;i<96;i++){
  const warning=risk(state);if(warning)return finish(warning);
  const before=state,plan=routineActions(before),check=validatePlan(before,plan.actions);
  if(!check.valid)return finish({kind:'blocked',title:'Delegation needs a review',detail:check.reasons.join(' '),tick:state.tick});
  state=commitPlan(before,plan.actions);
  const events=state.events.slice(before.events.length);
  delegatedActions.push({tick:before.tick,actions:structuredClone(plan.actions),rationale:plan.rationale,observed:{cashChange:state.company.cash-before.company.cash,starts:state.account.starts,revenue:state.account.revenue,costs:state.account.costs,healthspanChange:state.health.expected-before.health.expected,eventIds:events.map(e=>e.id)}});
  if(state.status!=='active'||state.tick>=96)return ended();
  if(state.tick<=before.tick)return finish({kind:'blocked',title:'The quarter did not advance',detail:'No further decisions were delegated. Return to the full campaign to inspect this state.',tick:state.tick});
  const afterRisk=risk(state);if(afterRisk)return finish(afterRisk);
  const clinical=events.find(e=>e.major&&e.kind==='clinical');
  if(clinical)return finish({kind:'clinical',title:clinical.title,detail:clinical.detail,tick:state.tick});
  if(state.policy.stage!==before.policy.stage||state.policy.pendingStage!==before.policy.pendingStage){const change=events.find(e=>e.major&&e.kind==='policy');return finish({kind:'policy',title:change?.title??'The treatment rules are changing',detail:change?.detail??'Review delivery and clinical-development choices under the new rules.',tick:state.tick});}
  if(state.world.generation!==before.world.generation)return finish({kind:'world',title:'Stronger AI-designed medicines are available',detail:'Compare the new fixed and personalized candidates before choosing whether to keep the current product, wait or fund evidence for an update.',tick:state.tick});
  if(state.tick>=target.tick)return finish({kind:'stage',title:target.title,detail:target.detail,tick:state.tick});
 }
 return finish({kind:'blocked',title:'Delegation reached its safety bound',detail:'No more than 96 quarters may resolve in one tour advance.',tick:state.tick});
}
