import type {Action,ActionOption,Family,GameEvent,GameState,GameView,Mode,Preview,Program,Region,ScenarioId,StudyPackage,Validation} from './types';
import {REGIONS,PROGRAMS,RELEASES,DEALS,buildDuration,releasesForScenario,infrastructureCapacity,siteCount} from '../world/content';
import {quoteDeployment,committedDeploymentLevels} from '../world/deployment';
import {initialCompany,issueEquity,shareFraction,valueCompany,forecastCompany} from '../world/economy';
import {clamp,random} from './random';
import {semanticChecksum} from './canonical';
import {initiateCohort,ageCohorts,scoreHealth} from './health';
import {nextPhase,progressStudy,startStudy,studyCost,studySpecification,STUDY_PACKAGES} from './clinical';
export {random} from './random';
export {remainingLifetime,scoreHealth} from './health';
const FAMILIES:Family[]=['diagnostics','clinic','manufacturing','evidence','followup','network'];
const MILLION=100000000;
const clone=<T>(v:T):T=>structuredClone(v);
const money=(n:number)=>Math.round(n);
const scoreLabel=(n:number)=>n>=1e9?`${(n/1e9).toFixed(2)}B`:n>=1e6?`${(n/1e6).toFixed(1)}M`:Math.round(n).toLocaleString();
const cashLabel=(n:number)=>`$${(n/MILLION).toFixed(1)}M`;
function event(s:GameState,kind:GameEvent['kind'],title:string,detail:string,major=false):void {s.events.push({id:`event:${s.tick}:${s.events.length}`,quarter:s.quarter,year:s.year,kind,title,detail,major});}
function availableProgram(s:GameState,p:Program):boolean {return (PROGRAMS.find(d=>d.id===p.id)?.available??2027)<=s.year;}
function permission(s:GameState,r:Region):boolean {return r.jurisdiction===0||s.policy.recognition||s.policy.stage==='personal';}
function activeCapacity(s:GameState):number {return s.regions.filter(r=>r.unlocked&&permission(s,r)).reduce((n,r)=>n+r.capacity,0);}
function refreshRegions(s:GameState):void {
 for(const r of s.regions){r.siteCount=(r.levels.network>0||r.id===REGIONS[0]?.id)?siteCount(r.levels.network):0;r.capacity=Math.floor(infrastructureCapacity(r.levels,s.world.compute,s.world.biology));r.quality=clamp(.77+r.levels.evidence*.035+r.levels.followup*.02,.5,.99);r.unlocked=r.levels.network>0||r.id===REGIONS[0]?.id;}
}
export function createCampaign(scenario:ScenarioId='convergence',seed=2027,mode:Mode='campaign'):GameState {
 const regions:Region[]=REGIONS.map((r,i)=>({...r,unlocked:i===0,waiting:Math.round(r.population*.035),treated:0,levels:{diagnostics:i===0?1:0,clinic:i===0?1:0,manufacturing:i===0?1:0,evidence:i===0?1:0,followup:i===0?1:0,network:0},quality:.84,capacity:i===0?100:0,lastTreated:0,lastTrial:0,bottleneck:'clinic',utilization:0,siteCount:i===0?1:0}));
 const programs:Program[]=PROGRAMS.map(p=>({id:p.id,name:p.name,family:p.family,modality:p.modality,stage:p.initialStage,version:1,availableVersion:1,readiness:p.initialStage==='approved'?1:.15,evidence:p.initialStage==='approved'?.85:0,response:p.response,durability:p.durability,harm:p.harm,benefit:p.benefit,study:null,active:p.initialStage==='approved',licensed:p.initialStage==='approved',partnered:false,starts:0,lastResult:p.initialStage==='approved'?'Licensed care; deployment is limited by treatment capacity.':'CEO study package required.',platformScope:false}));
 const s:GameState={schemaVersion:1,engineVersion:'1.3.2',contentVersion:'1.3.0',id:`healthspan:${scenario}:${seed}`,seed:seed>>>0,scenario,mode,year:2027,quarter:1,tick:0,phase:'planning',status:'active',company:initialCompany(),regions,programs,projects:[],policy:{stage:'product',support:0,lobbyBudget:0,charter:null,implementation:0,recognition:false,qualified:false,window:0,scope:[],history:[]},world:{research:1,compute:1,biology:1,access:1,modelVersion:1,releases:[],rivals:[{id:'rival-lab',name:'Aster Laboratory',kind:'lab',capacity:18,capital:42*MILLION,share:.12,strategy:'Evidence first',lastAction:'Reserving trial appointments.'},{id:'rival-hospital',name:'Commonwell Health',kind:'hospital',capacity:35,capital:70*MILLION,share:.16,strategy:'Regional care network',lastAction:'Recruiting clinical sites.'},{id:'rival-pharma',name:'Vantage Therapeutics',kind:'pharma',capacity:22,capital:110*MILLION,share:.1,strategy:'Own the platform',lastAction:'Building product evidence.'}],counterfactualAccess:.08,counterfactualPolicy:0,lastShift:'Current licensed care is ready; a single clinic is the binding constraint.'},cohorts:[],score:{expected:0,experienced:0,remaining:0,outsideHarm:0,low:0,high:0,people:0,worldwide:regions.reduce((n,r)=>n+r.population,0),tailError:0},events:[],trace:[],history:[],committed:[],delegated:false,seenDecisions:[],outsideHarm:0,trialFollowup:{}};
 // Contract uses $12M opening cash regardless of offer availability.
 s.company.cash=12*MILLION;refreshRegions(s);
 event(s,'network','One clinic. A worldwide ambition.','Licensed autoimmune care can begin now. Diagnostics, manufacturing, trials and long-term follow-up draw on the same registered clinical network. Two annual commitments govern four resolving quarters.',true);
 event(s,'finance','Founder control is part of the objective','All prices and transaction terms are fictional. Cash exhaustion or loss of CEO, board, or strategic control ends the campaign.',false);
 s.history.push({year:2027,score:0,cash:s.company.cash,revenue:0,people:0,control:s.company.control});return s;
}
function networkTarget(s:GameState,r:Region):number{return Math.min(8,r.levels.network+(s.policy.stage==='personal'?2:1));}
function constructionQuote(s:GameState,r:Region,family:Family){const levels=committedDeploymentLevels(r.levels,s.projects.filter(p=>p.kind==='build'&&p.regionId===r.id));const target=family==='network'?networkTarget(s,r):Math.min(8,r.levels[family]+1);return target>levels[family]?quoteDeployment(levels,family,target):null;}
function constructionCost(s:GameState,r:Region,family:Family):number {return constructionQuote(s,r,family)?.totalCost??s.projects.find(p=>p.kind==='build'&&p.regionId===r.id&&p.family===family)?.cost??0;}
function constructionDuration(s:GameState,r:Region,family:Family):number{return family==='network'&&networkTarget(s,r)-r.levels.network>1?6:buildDuration(family);}
function actionCost(s:GameState,a:Action):number {
 if(a.type==='build'){const r=s.regions.find(r=>r.id===a.regionId);return r?constructionCost(s,r,a.family):0;}
 if(a.type==='program'){const p=s.programs.find(p=>p.id===a.programId);if(!p)return 0;if(a.operation==='start'||a.operation==='advance')return studyCost(p,a.package??'narrow',s)-Math.min(s.company.credits,Math.round(studyCost(p,a.package??'narrow',s)*.3));if(a.operation==='bridge')return (s.policy.stage==='personal'? .3:.8)*MILLION;if(a.operation==='readiness')return .35*MILLION;}
 if(a.type==='policy'){if(a.operation==='lobby')return a.budget??1.2*MILLION;if(a.operation==='charter')return 1.5*MILLION;if(a.operation==='platform')return s.policy.stage==='platform'?5*MILLION:2*MILLION;if(a.operation==='recognition')return 2.5*MILLION;}
 if(a.type==='deal'){const v=DEALS.find(d=>d.id===a.dealId)?.variants[a.variant];return v&&v.cash<0?-v.cash:0;}
 return 0;
}
function actionReason(s:GameState,a:Action):string|null {
 if(a.type==='wait'||a.type==='priority')return null;
 if(a.type==='build'){
  const r=s.regions.find(r=>r.id===a.regionId);if(!r)return 'Unknown region.';
  if(!FAMILIES.includes(a.family))return 'Unknown infrastructure family.';
  if(r.levels[a.family]>=8)return 'This infrastructure is fully scaled.';
  if(a.family!=='network'&&!r.unlocked)return 'Register a clinical network in this region first.';
  if(a.family==='network'&&!permission(s,r))return 'Cross-border recognition is required to register sites in this jurisdiction.';
  if(s.projects.some(p=>p.kind==='build'&&p.regionId===r.id&&p.family===a.family))return 'This infrastructure expansion is already under construction.';
 }
 if(a.type==='program'){
  const p=s.programs.find(p=>p.id===a.programId);if(!p)return 'Unknown program.';
  if(!availableProgram(s,p))return `The enabling science arrives in ${PROGRAMS.find(d=>d.id===p.id)?.available}.`;
  if(a.package&&!STUDY_PACKAGES[a.package])return 'Unknown study package.';
  if(a.operation==='start'||a.operation==='advance'){
   if(p.study)return 'A study is already active; complete, pause or stop it first.';
   if(p.stage==='approved'||p.stage==='platform')return 'Care is already authorized; bridge a newer model when available.';
   if(a.operation==='start'&&p.stage!=='preclinical')return 'Choose advance for the next clinical phase.';
   if(a.operation==='advance'&&p.stage==='preclinical')return 'Start phase 1 before advancing.';
   if(s.programs.filter(p=>p.study&&!p.study.paused).length>=maxPrograms(s))return 'Evidence staff are at their concurrent-study limit. Build evidence capacity.';
  }
  if(a.operation==='pause'&&(!p.study||p.study.paused))return 'No running study to pause.';
  if(a.operation==='resume'&&(!p.study||!p.study.paused))return 'No paused study to resume.';
  if(a.operation==='stop'&&!p.active&&!p.study)return 'The program is already inactive.';
  if(a.operation==='bridge'&&p.availableVersion<=p.version)return 'Already using the latest available AI model.';
  if(a.operation==='readiness'&&p.readiness>=1)return 'Site and assay readiness is complete.';
 }
 if(a.type==='deal'){
  const d=DEALS.find(d=>d.id===a.dealId);if(!d)return 'Unknown deal.';if(!Number.isInteger(a.variant)||!d.variants[a.variant])return 'Unknown offer variant.';
  if(d.availableYear>s.year)return `Offer opens in ${d.availableYear}.`;
  if(s.seenDecisions.includes(`deal:${d.id}`)){const chosen=s.trace.flatMap(t=>t.actions).find(a=>a.type==='deal'&&a.dealId===d.id);return chosen?.type==='deal'&&chosen.variant===a.variant?'This offer has already been signed.':'An alternative in this offer family was selected. These mutually exclusive terms are no longer available.';}
  if(a.regionId&&!s.regions.some(r=>r.id===a.regionId))return 'Unknown deal region.';
  if(a.programId&&!s.programs.some(p=>p.id===a.programId))return 'Unknown deal program.';
 }
 if(a.type==='policy'){
  if(a.operation==='lobby'&&a.budget!==undefined&&(!Number.isSafeInteger(a.budget)||a.budget<.3*MILLION||a.budget>5*MILLION))return 'Lobby budget must be $0.3M–$5M in whole cents.';
  if(a.operation==='charter'){
   if(!s.policy.qualified)return 'Complete a phase 1 study and initiate licensed care to establish a monitored-care demonstration.';
   if(s.policy.support<.5)return 'Build at least 50% policy support through lobbying and measured evidence.';
   if(s.policy.charter!==null)return 'A charter has already been selected.';
   if(a.variant!==undefined&&a.variant!==0&&a.variant!==1)return 'Choose an open charter or a stewarded charter.';
  }
  if(a.operation==='platform'){
   const restriction=s.company.contracts.find(c=>!c.portable&&c.end>s.tick);if(restriction)return `${restriction.name} restricts evidence portability until ${2027+Math.ceil(restriction.end/4)}; its affected evidence cannot enter an open platform.`;
   if(s.policy.stage==='platform') {if(s.world.biology<1.6||s.world.modelVersion<4)return 'Personalized pathways require validated biological tools and at least model version 4; faster computation alone is insufficient.';if(s.programs.reduce((n,p)=>n+p.evidence,0)<2.3)return 'Personalized pathways require broader observed evidence across programs.';}
   else if(s.policy.stage!=='offered')return 'Secure a charter offer before starting platform implementation.';
  }
  if(a.operation==='recognition'){
   if(s.policy.recognition)return 'Recognition is already active.';
   if(s.policy.stage!=='platform'&&s.policy.stage!=='personal')return 'A working platform charter is required for cross-border recognition.';
   if(s.projects.some(p=>p.kind==='recognition'))return 'Recognition is already being implemented.';
  }
 }
 if(actionCost(s,a)>Math.max(0,s.company.cash))return `Needs ${cashLabel(actionCost(s,a))}; available cash is ${cashLabel(s.company.cash)}.`;
 return null;
}
function applyAction(s:GameState,a:Action):void {
 const cost=money(actionCost(s,a));s.company.cash-=cost;s.company.totalSpend+=cost;
 if(a.type==='wait'){event(s,'network','Capacity held for the year','No additional commitment; existing studies, care and follow-up continue.');return;}
 if(a.type==='priority'){s.company.priority=a.priority;event(s,'network',`Queue priority: ${a.priority}`,'The priority changes the shared appointments allocated to care and research; follow-up remains a continuing obligation.');return;}
 if(a.type==='build'){
  const r=s.regions.find(r=>r.id===a.regionId)!;s.projects.push({id:`build:${s.tick}:${r.id}:${a.family}`,name:`${r.name} ${a.family}`,kind:'build',regionId:r.id,family:a.family,remaining:constructionDuration(s,r,a.family),cost,started:s.tick,targetLevel:a.family==='network'?networkTarget(s,r):r.levels[a.family]+1});s.company.capex+=cost;event(s,'network',`${r.name}: ${a.family} expansion`,`${cashLabel(cost)} committed; level ${a.family==='network'?networkTarget(s,r):r.levels[a.family]+1} commissions in ${constructionDuration(s,r,a.family)} quarters. ${a.family==='network'&&s.policy.stage==='personal'?'Reusable platform audits allow a two-level registration tranche; both infrastructure levels are fully paid. ':''}New sites create capacity only when commissioned.`,true);return;
 }
 if(a.type==='program'){
  const p=s.programs.find(p=>p.id===a.programId)!;
  if(a.operation==='start'||a.operation==='advance'){const grossBudget=studyCost(p,a.package??'narrow',s);s.company.credits-=Math.min(s.company.credits,Math.round(grossBudget*.3));startStudy(s,p,a.package??'narrow');event(s,'clinical',`${p.name}: ${p.study!.phase} commissioned`,`${a.package??'narrow'} package; ${p.study!.target} participants, ${p.study!.observationRequired} observation quarters after enrollment, then regulatory review. ${cashLabel(cost)} reserved.`,true);}
  if(a.operation==='pause'){p.study!.paused=true;event(s,'clinical',`${p.name} paused`,'Enrollment is paused. Existing participants retain follow-up obligations.');}
  if(a.operation==='resume'){p.study!.paused=false;event(s,'clinical',`${p.name} resumed`,'The program rejoins the shared diagnostic, manufacturing and evidence queues.');}
  if(a.operation==='stop'){p.study=null;p.active=false;p.lastResult='CEO stopped further initiation; existing cohorts remain in follow-up.';event(s,'clinical',`${p.name} stopped`,p.lastResult);}
  if(a.operation==='readiness'){p.readiness=clamp(p.readiness+.5);if(p.study)p.study.readiness=p.readiness;event(s,'clinical',`${p.name}: readiness investment`,'Assay validation, staff training and site activation advanced. Enrollment and observation requirements remain.');}
  if(a.operation==='bridge'){
   const old=p.version;p.version=p.availableVersion;p.response=clamp(p.response+.012*(p.version-old),0,.94);p.benefit*=1+.025*(p.version-old);p.readiness=Math.max(.35,p.readiness-.25);
   if(p.study){p.study.paused=false;p.study.version=p.version;p.study.readiness=p.readiness;p.study.enrolled=Math.floor(p.study.enrolled*.8);p.study.observation=0;p.study.review=0;}
   else if(p.stage==='approved'&&s.policy.stage!=='personal'){p.stage='phase1';p.active=false;p.lastResult='Version change requires a bridging phase 2 study before renewed initiation.';}
   event(s,'clinical',`${p.name}: model ${old} → ${p.version}`,s.policy.stage==='personal'?'The personalized charter removes a separate product reauthorization; registry surveillance and continued care remain.':'The improved model consumes revalidation work; an existing study restarts observation and retains 80% enrollment. Approved product changes require a bridging study.',true);
  }return;
 }
 if(a.type==='deal'){
  const d=DEALS.find(d=>d.id===a.dealId)!,v=d.variants[a.variant],resolvedProgramId=d.family==='therapy'?(a.programId??'immune-reset'):d.family==='payer'?(a.programId??'autoimmune-care'):a.programId;s.seenDecisions.push(`deal:${d.id}`);
  if(v.cash>0&&v.preMoney>0){s.company=issueEquity(s.company,{...v,id:d.id,name:`${d.name} · ${v.name}`},s.year);}
  else {if(v.cash>0)s.company.cash+=v.cash;s.company.credits+=v.credits;if(v.founderSeats<s.company.founderSeats)s.company.founderSeats=v.founderSeats;if(v.strategicControl)s.company.strategicControl=true;}
  if(v.annualCost||v.annualRevenue||v.capacity||v.royalty){s.company.contracts.push({id:d.id,family:d.family,name:`${d.name}: ${v.name}`,start:s.tick,end:s.tick+v.duration*4,annualCost:v.annualCost,annualRevenue:v.annualRevenue,royalty:v.royalty,capacity:v.capacity,exclusive:v.exclusive,portable:v.portable,regionId:a.regionId,programId:resolvedProgramId,restricted:v.exclusive,details:v.description});if(d.family!=='therapy')s.company.royalty=Math.min(.8,s.company.royalty+v.royalty);}
  if(d.family==='therapy'){const p=s.programs.find(p=>p.id===resolvedProgramId)!;p.partnered=true;p.readiness=clamp(p.readiness+.25);if(p.study)p.study.readiness=Math.max(p.study.readiness,p.readiness);p.lastResult=`Therapy rights licensed: readiness improved; future study budgets cost 20% less while the license is active. Existing evidence, phase and observation requirements are unchanged.`;event(s,'clinical',`${p.name}: therapy rights licensed`,`${p.lastResult} ${(v.royalty*100).toFixed(1)}% royalty applies only to this program.`,true);}
  event(s,'finance',`${d.name}: ${v.name}`,`${v.description} ${v.cash>0?`${cashLabel(v.cash)} funding received.`:''} ${v.preMoney>0?'An exact share class and financing round were recorded.':''}`,true);checkControl(s);return;
 }
 if(a.type==='policy'){
  if(a.operation==='lobby'){s.policy.lobbyBudget+=cost;s.policy.window=Math.max(s.policy.window,4);if(s.policy.stage==='product'||s.policy.stage==='demonstration')s.policy.stage='agenda';event(s,'policy','Policy coalition expanded',`A four-quarter political window is funded. Measured evidence, biological validation and rival opposition determine support; lobbying alone removes no clinical requirement.`,true);}
  if(a.operation==='charter'){s.policy.charter=a.variant??0;s.policy.stage='offered';s.policy.history.push(`${s.year}: ${a.variant===1?'stewarded':'open'} charter chosen`);event(s,'policy','A platform charter is offered',a.variant===1?'Stewarded charter: faster implementation with a 2% registry levy. An implementation commitment is still required.':'Open charter: portable evidence and shared registry standards. An implementation commitment is still required.',true);if(a.variant===1)s.company.royalty+=.02;}
  if(a.operation==='platform'){
   if(s.policy.stage==='platform'){s.policy.stage='personal';s.policy.history.push(`${s.year}: personalized pathways`);for(const p of s.programs)p.platformScope=s.policy.scope.includes(p.family);event(s,'policy','Personalized pathways authorized','Within validated platform scope, AI version changes no longer require separate product trials. Patient registry, minimum observation and continued-care obligations remain. Cross-border portability applies.',true);s.policy.recognition=true;}
   else {s.policy.stage='implementing';s.policy.implementation=s.policy.charter===1?4:6;s.projects.push({id:`platform:${s.tick}`,name:'Platform implementation',kind:'platform',remaining:s.policy.implementation,cost,started:s.tick});event(s,'policy','Platform implementation commissioned','Registry standards, monitoring and legal recognition are being installed. Current product requirements remain until commissioning.',true);}
  }
  if(a.operation==='recognition'){s.projects.push({id:`recognition:${s.tick}`,name:'Cross-border recognition',kind:'recognition',remaining:4,cost,started:s.tick});event(s,'policy','Cross-border recognition commissioned','Four quarters to register mutually recognized clinical sites and portable follow-up.',true);}
 }
}
export function validatePlan(state:GameState,actions:Action[]):Validation {
 const reasons:string[]=[];if(state.phase!=='planning'||state.status!=='active')reasons.push('Annual commitments are available only during active planning.');
 if(!Array.isArray(actions)||actions.length>2)return{valid:false,reasons:[...reasons,'Choose exactly two annual commitments; hold capacity is a valid commitment.'],cost:0};
 if(actions.length!==2)reasons.push('Choose exactly two annual commitments; hold capacity is a valid commitment.');
 const s=clone(state);let cost=0;
 actions.forEach((a,i)=>{const reason=actionReason(s,a);if(reason)reasons.push(`Commitment ${i+1}: ${reason}`);else{cost+=actionCost(s,a);applyAction(s,a);}});
 return{valid:reasons.length===0,reasons,cost:money(cost)};
}
/** Remaining legal choices after the visible, reversible pending commitments. */
export function plannedOptions(state:GameState,actions:Action[]):ActionOption[]{
 const draft=clone(state),selected=new Map<string,ActionOption>();
 const key=(action:Action):string=>action.type==='build'?`build:${action.regionId}:${action.family}`:action.type==='deal'?`deal:${action.dealId}:${action.variant}`:action.type==='program'?(action.operation==='start'||action.operation==='advance'?`study:${action.programId}:${action.package??'narrow'}`:`program:${action.programId}:${action.operation}`):action.type==='policy'?`policy:${action.operation}${action.operation==='charter'?`:${action.variant??0}`:''}`:action.type==='priority'?`priority:${action.priority}`:'wait';
 for(const action of actions){
  if(actionReason(draft,action))return availableOptions(state);
  const option=availableOptions(draft).find(o=>o.id===key(action));
  if(option&&action.type!=='wait')selected.set(option.id,{...option,action,cost:actionCost(draft,action),label:action.type==='policy'&&action.operation==='lobby'&&action.budget!==undefined?`${option.label} · ${cashLabel(action.budget)}`:option.label,available:false,reason:'Queued in this plan. Remove it to change this commitment.'});
  applyAction(draft,action);
 }
 return availableOptions(draft).map(option=>{
  const queued=selected.get(option.id);if(queued)return queued;
  if(draft.status!=='active'&&option.action.type==='wait')return{...option,available:true,reason:'Complete this plan; the pending control transfer ends play before care.'};
  if(actions.length&&!option.available&&option.reason!==(actionReason(state,option.action)??'Available'))return{...option,reason:`After your queued plan: ${option.reason}`};
  return option;
 });
}

export function previewPlan(state:GameState,actions:Action[]):Preview {
 const validation=validatePlan(state,actions);const s=clone(state);const summary:string[]=[];
 const previewable=state.phase==='planning'&&state.status==='active'&&actions.length<=2;
 if(previewable)for(const a of actions){if(actionReason(s,a))break;applyAction(s,a);summary.push(a.type==='build'?`${a.family} capacity commissions after ${constructionDuration(s,s.regions.find(r=>r.id===a.regionId)!,a.family)} quarters${a.family==='network'?` at network level ${networkTarget(s,s.regions.find(r=>r.id===a.regionId)!)}`:''}; no immediate treatment gain.`:a.type==='program'?`${a.operation} changes ${a.programId}; future study endpoints are unobserved.`:a.type==='policy'?`${a.operation} changes policy requirements only after qualification and implementation.`:a.type==='deal'?'Financing and contract terms apply immediately; funding does not itself create health years.':a.type==='priority'?`Shared queues prioritize ${a.priority}.`:'Existing commitments continue.');}
 const conditional=forecastCompany(s,'base',true)[0];
 if(conditional?.fundingGap>0)summary.push(`Current care permissions imply up to ${cashLabel(conditional.fundingGap)} of funding need over the next four quarters. New authorizations are not assumed; expansion and continuing care consume cash before later receipts.`);
 const lowCare=forecastCompany(s,'low',true)[0],highCare=forecastCompany(s,'high',true)[0];
 for(const contract of s.company.contracts.filter(c=>c.family==='payer'&&c.end>s.tick&&c.start<s.tick+4)){const target=contract.capacity*Math.max(0,Math.min(s.tick+4,contract.end)-Math.max(s.tick,contract.start))/4;summary.push(`${contract.name}: projected matching ${contract.programId??'all-program'} care ${scoreLabel(lowCare.contractStarts?.[contract.id]??0)}–${scoreLabel(highCare.contractStarts?.[contract.id]??0)} of ${scoreLabel(target)} promised starts over the next four quarters. Other therapy starts do not fulfill this agreement.`);}
 const approved=s.programs.some(p=>p.active&&(p.stage==='approved'||p.stage==='platform'));
 return{...validation,cashAfter:s.company.cash,summary,careLow:approved?Math.floor(lowCare?.starts??0):0,careHigh:approved?Math.ceil(highCare?.starts??0):0,control:s.company.control};
}
export function commitPlan(state:GameState,actions:Action[]):GameState {
 const v=validatePlan(state,actions);if(!v.valid)throw new Error(v.reasons.join(' '));const s=clone(state),cashBefore=s.company.cash,healthBefore=s.score.expected,firstEvent=s.events.length;
 s.committed=clone(actions);for(const a of actions)applyAction(s,a);
 s.phase=s.status==='active'?'resolving':'ended';s.trace.push({id:`trace:${s.tick}`,quarter:s.tick,actions:clone(actions),cashBefore,cashAfterCommit:s.company.cash,cashAfter:s.company.cash,healthBefore,healthAfter:s.score.expected,events:s.events.slice(firstEvent).map(e=>e.id),delegated:s.delegated,checksum:''});s.trace[s.trace.length-1].checksum=checksum(s);return s;
}
function checkControl(s:GameState):void {
 const founder=s.company.classes.find(c=>c.id==='founder'||c.name.toLowerCase().includes('founder'));
 const ownership=founder?shareFraction(s.company.classes,founder.id):1;
 if(!s.company.ceo||s.company.strategicControl||s.company.founderSeats<3){s.company.control='lost';s.status='control-loss';s.phase='ended';event(s,'ending','Founder control lost','The company can continue, but this campaign ends: CEO, board or strategic decision rights were surrendered. Expected health years remain recorded.',true);return;}
 s.company.control=ownership<.3?'at-risk':'retained';
 if(s.company.cash<0&&s.company.cureQuarter===null){s.company.cureQuarter=Math.ceil((s.tick+1)/4)*4+4;event(s,'warning','Cash covenant breach','Cash has fallen below zero. The company has until the annual funding decision and its following year to close funding or become insolvent. Care initiation is constrained by available cash.',true);}
 if(s.company.cash>=0)s.company.cureQuarter=null;
 if(s.company.cureQuarter!==null&&s.tick>=s.company.cureQuarter){s.status='insolvent';s.phase='ended';s.score=scoreHealth(s);event(s,'ending','Runway exhausted','The funding cure period expired. New initiation stops. Expected remaining benefit now assumes a 55% chance of portable continuing-care handoff; this fictional funding-loss adjustment preserves all health gains and harms already experienced.',true);}
}
function processProjects(s:GameState):void {
 for(const project of s.projects){project.remaining--;if(project.kind==='platform')s.policy.implementation=Math.max(0,project.remaining);if(project.remaining>0)continue;
  if(project.kind==='build'){const r=s.regions.find(r=>r.id===project.regionId)!;r.levels[project.family!]=project.targetLevel??r.levels[project.family!]+1;if(project.family==='network')for(const f of FAMILIES)if(f!=='network')r.levels[f]=Math.max(1,r.levels[f]);event(s,'network',`${project.name} commissioned`,project.family==='network'?`${siteCount(r.levels.network).toLocaleString()} registered sites now supply shared treatment, diagnostic, trial and follow-up queues.`:'Per-site capacity increased. The smallest remaining shared capacity remains the binding constraint.',true);}
  if(project.kind==='platform'){s.policy.stage='platform';s.policy.scope=[...new Set(s.programs.filter(p=>p.evidence>=.45).map(p=>p.family))];for(const p of s.programs)p.platformScope=s.policy.scope.includes(p.family);s.policy.history.push(`${s.year}: platform commissioned (${s.policy.scope.join(', ')})`);event(s,'policy','Platform framework is operational',`Validated scope: ${s.policy.scope.join(', ')}. Qualifying phase 2 evidence can replace a separate phase 3 product application; surveillance and follow-up remain.`,true);}
  if(project.kind==='recognition'){s.policy.recognition=true;s.policy.history.push(`${s.year}: cross-border recognition`);event(s,'policy','Three jurisdictions recognize the platform','Regional permission gates are removed. Register and commission local clinical networks before residents can receive care.',true);}
 }
 s.projects=s.projects.filter(p=>p.remaining>0);refreshRegions(s);
}
function processWorld(s:GameState):void {
 for(const release of releasesForScenario(s.scenario)){if(release.year>s.year||s.world.releases.includes(release.id))continue;s.world.releases.push(release.id);s.world.research*=release.research;s.world.compute*=release.compute;s.world.biology*=release.biology;s.world.access*=release.access;s.world.modelVersion=Math.max(s.world.modelVersion,release.version);for(const p of s.programs)p.availableVersion=Math.max(p.availableVersion,release.version);s.world.lastShift=release.detail;event(s,'world',release.title,`${release.detail} Existing product versions continue; bridging a version is a separate CEO choice.`,true);}
 // Rivals improve alternative care and compete for shared staff; they never contribute to company score.
 if(s.tick%4===0){for(const rival of s.world.rivals){const intensity=.09+random(s.seed,rival.id,s.year,'investment')*.09;rival.capacity=Math.round(rival.capacity*(1+intensity)+activeCapacity(s)*.008);rival.capital=money(rival.capital*1.06);rival.share=clamp(rival.share+(random(s.seed,rival.id,s.year,'share')-.4)*.008,.04,.28);rival.lastAction=rival.kind==='lab'?'Expanded trials and released evidence.':rival.kind==='hospital'?'Registered sites and expanded accessible alternative care.':'Launched a validated product and secured manufacturing.';event(s,'world',`${rival.name}: ${rival.strategy}`,`${rival.lastAction} Rival sites consume scarce appointments and improve the comparator.`,false);}s.world.counterfactualPolicy=clamp(s.world.counterfactualPolicy+.015);}
 s.world.counterfactualAccess=clamp(.08+(s.tick/96)*.48+s.world.counterfactualPolicy*.12,0,.75);refreshRegions(s);
}
function applyPlatformEvidence(s:GameState):void {
 if(s.policy.stage!=='platform'&&s.policy.stage!=='personal')return;
 for(const p of s.programs){if(p.evidence>=.45&&!s.policy.scope.includes(p.family))s.policy.scope.push(p.family);p.platformScope=s.policy.scope.includes(p.family);if(p.stage==='phase2'&&(!p.study||p.study.phase==='phase3')&&p.platformScope&&p.evidence>=.45){if(p.study){const refunded=Math.round(p.study.budget*Math.max(0,1-p.study.enrolled/p.study.target)*.35);s.company.cash+=refunded;s.company.totalSpend-=refunded;p.study=null;event(s,'clinical',`${p.name}: product study reservation released`,`${cashLabel(refunded)} unspent enrollment reservation returned. Observed phase 2 evidence and participant follow-up are retained.`);}p.stage='platform';p.active=true;p.lastResult='Platform qualification removes the separate phase 3 product requirement; registry monitoring remains.';event(s,'clinical',`${p.name}: platform care authorized`,p.lastResult,true);}}
}
function scopedProgramRoyalty(s:GameState,programId:string,regionId:string):number{return (s.programs.find(p=>p.id===programId)?.royalty??0)+s.company.contracts.filter(c=>c.family==='therapy'&&c.programId===programId&&(!c.regionId||c.regionId===regionId)&&c.start<=s.tick&&c.end>s.tick).reduce((n,c)=>n+c.royalty,0);}
function careRoyalty(s:GameState,programId:string,regionId:string):number {const expiredGlobal=s.company.contracts.filter(c=>c.family!=='therapy'&&c.end<=s.tick).reduce((n,c)=>n+c.royalty,0);return clamp(Math.max(0,s.company.royalty-expiredGlobal)+scopedProgramRoyalty(s,programId,regionId),0,.95);}
function processCareAndStudies(s:GameState):void {
 const studies=s.programs.filter(p=>p.study&&!p.study.paused);let trialBudget=0;let evidenceSites=0;const followup=new Map<string,number>();let revenue=0,variableCosts=0,totalStarts=0;
 const activeContracts=s.company.contracts.filter(c=>c.start<=s.tick&&c.end>s.tick);
 const payerDelivered=new Map<string,number>();
 for(const r of s.regions){r.lastTreated=0;r.lastTrial=0;r.utilization=0;if(!r.unlocked||!permission(s,r)){r.bottleneck='permission';followup.set(r.id,0);continue;}
  const localContracts=activeContracts.filter(c=>!c.regionId||c.regionId===r.id);
  const contractCapacity=(family:string)=>localContracts.filter(c=>c.family===family).reduce((n,c)=>n+c.capacity/(c.regionId?1:Math.max(1,s.regions.filter(r=>r.unlocked&&permission(s,r)).length)),0);
  // Hospital slots and manufacturing batches enlarge only their own resource; they cannot manufacture a complete care pathway.
  const diagnostics=r.levels.diagnostics>0?r.siteCount*160*(1+.35*(r.levels.diagnostics-1))*Math.pow(s.world.compute,.2):0;
  const clinical=(r.levels.clinic>0?r.siteCount*100*(1+.3*(r.levels.clinic-1)):0)+contractCapacity('hospital')+contractCapacity('therapy');
  const manufacturing=r.siteCount*140*(1+.4*(r.levels.manufacturing-1))*Math.pow(s.world.biology,.25)+contractCapacity('manufacturing')+contractCapacity('therapy');
  const longitudinal=r.levels.followup>0?r.siteCount*120*(1+.4*(r.levels.followup-1)):0;
  const gross=Math.floor(Math.min(diagnostics,clinical,manufacturing,longitudinal)/4);const rivalLoad=Math.min(.24,s.world.rivals.reduce((n,v)=>n+v.share,0)*.2);
  const slots=Math.floor(gross*(1-rivalLoad)),rivalSlots=gross-slots;const enrolledHere=s.cohorts.filter(c=>c.regionId===r.id).reduce((n,c)=>n+c.alive,0);
  // Each living resident needs one appointment a year. Those appointments are served before either new care or trial enrollment.
  const followupRequired=Math.ceil((enrolledHere+(s.trialFollowup?.[r.id]??0))/4),followupReserve=Math.min(slots,followupRequired);
  followup.set(r.id,followupRequired===0?1:followupReserve/followupRequired);
  const afterFollowup=Math.max(0,slots-followupReserve);const trialShare=s.company.priority==='research'?.3:s.company.priority==='care'?.04:.13;
  const trials=studies.length?Math.floor(Math.min(afterFollowup*trialShare,studies.reduce((n,p)=>n+Math.max(0,p.study!.target-p.study!.enrolled),0))):0;
  r.lastTrial=trials;trialBudget+=trials;evidenceSites+=r.siteCount*(1+r.levels.evidence*.15);
  let careSlots=Math.max(0,Math.floor(afterFollowup-trials));
  const eligible=s.programs.filter(p=>p.active&&availableProgram(s,p)&&(p.stage==='approved'||p.stage==='platform'));
  const untreated=Math.max(0,r.population-r.treated);r.waiting=Math.min(untreated,Math.round(untreated*(.12+s.world.access*.018)));
  if(!eligible.length){careSlots=0;r.bottleneck='permission';}
  if(r.waiting<careSlots){careSlots=r.waiting;r.bottleneck='demand';}else r.bottleneck=bottleneck(r,s);
  // Payer prepayment can fund only matching care, never buildings, payroll or research.
  // Earned receipts replace retail billing immediately; the allowance is not additional cash.
  const weights=eligible.map(p=>Math.max(.2,p.benefit*p.response));let remaining=careSlots;const sum=weights.reduce((a,b)=>a+b,0);
  eligible.forEach((p,i)=>{
   const desired=i===eligible.length-1?remaining:Math.floor(careSlots*weights[i]/sum);remaining-=desired;if(desired<=0)return;
   const d=PROGRAMS.find(d=>d.id===p.id)!,unitCost=d.cost/Math.pow(s.world.biology,.25);
   const payers=localContracts.filter(c=>c.annualRevenue>0&&(!c.programId||c.programId===p.id));
   let advance=0;for(const contract of payers){const unused=Math.max(0,contract.capacity/4-(payerDelivered.get(contract.id)??0));const unitReceipt=contract.annualRevenue/Math.max(1,contract.capacity);advance+=Math.min(desired,unused)*Math.min(unitCost,unitReceipt*(1-careRoyalty(s,p.id,r.id)));}
   const liquidity=Math.max(0,s.company.cash+revenue-variableCosts-.1*MILLION);
   const count=Math.min(desired,Math.max(0,Math.floor((liquidity+advance)/Math.max(1,unitCost))));
   if(count<desired)r.bottleneck='cash';if(count<=0)return;
   const cohort=initiateCohort(s,r,p,count);s.cohorts.push(cohort);r.treated+=count;p.starts+=count;r.lastTreated+=count;totalStarts+=count;
   let uncovered=count,receipts=0;for(const contract of payers){const covered=Math.min(uncovered,Math.max(0,contract.capacity/4-(payerDelivered.get(contract.id)??0)));payerDelivered.set(contract.id,(payerDelivered.get(contract.id)??0)+covered);uncovered-=covered;receipts+=covered*contract.annualRevenue/Math.max(1,contract.capacity);}
   revenue+=(receipts+uncovered*d.price)*(1-careRoyalty(s,p.id,r.id));variableCosts+=count*unitCost;
  });
  r.utilization=gross?clamp((r.lastTreated+trials+followupReserve+rivalSlots)/gross):0;r.queue={gross,rivals:rivalSlots,followupRequired,followup:followupReserve,trials,care:r.lastTreated,idle:Math.max(0,gross-rivalSlots-followupReserve-trials-r.lastTreated)};
  // Resource diversion can harm people outside company care and remains a debit.
  s.outsideHarm+=trials*.001+r.lastTreated*(1-r.quality)*.0007;
 }
 let seatsLeft=trialBudget;
 s.trialFollowup??={};for(const id of Object.keys(s.trialFollowup))s.trialFollowup[id]*=.998;
 for(let i=0;i<studies.length;i++){const p=studies[i],beforeEnrollment=p.study!.enrolled,seats=Math.floor(seatsLeft/(studies.length-i));seatsLeft-=seats;const result=progressStudy(s,p,seats,Math.min(.55,.12+Math.log2(1+evidenceSites)*.055)*Math.pow(s.world.research,.15));const newlyEnrolled=Math.max(0,(p.study?.enrolled??beforeEnrollment)-beforeEnrollment);if(newlyEnrolled&&trialBudget)for(const r of s.regions)s.trialFollowup[r.id]=(s.trialFollowup[r.id]??0)+newlyEnrolled*r.lastTrial/trialBudget;if(result)event(s,'clinical',result.title,result.detail,true);}
 const firstHuman=s.programs.some(p=>p.evidence>=.15&&!p.licensed);
 s.policy.qualified=firstHuman&&s.cohorts.length>0;
 if(s.policy.qualified&&s.policy.stage==='product'){s.policy.stage='demonstration';event(s,'policy','Monitored-care demonstration qualifies','Completed human evidence and an operating care registry now support a platform-policy proposal. Lobbying and charter implementation remain separate commitments.',true);}
 if(s.policy.window>0){const acceptance=s.policy.qualified?Math.min(1,s.world.biology/1.2):.15;const opposition=.007+s.world.rivals.filter(r=>r.kind==='pharma').reduce((n,r)=>n+r.share,0)*.018;const funded=Math.min(.18,.035+s.policy.lobbyBudget/(25*MILLION));s.policy.support=clamp(s.policy.support+funded*(1-s.policy.support)*acceptance-opposition);s.policy.window--;if(s.policy.window===0)event(s,'policy','Political window closes',`Support is ${Math.round(s.policy.support*100)}%; observed evidence and biological validation constrained acceptance. Additional lobbying has diminishing returns.`,true);}else if(firstHuman)s.policy.support=clamp(s.policy.support+.002);
 applyPlatformEvidence(s);ageCohorts(s,followup);
 const studyOps=studies.length*.022*MILLION;const siteOps=s.regions.reduce((n,r)=>n+(r.unlocked?r.siteCount*9500:0),0);
 const headquarters=(.12+.004*(s.year-2027))*MILLION;const followupOps=(s.cohorts.reduce((n,c)=>n+c.alive,0)+Object.values(s.trialFollowup??{}).reduce((a,b)=>a+b,0))*650;
 const contractExpense=activeContracts.reduce((n,c)=>n+c.annualCost/4,0);
 for(const contract of activeContracts.filter(c=>c.annualRevenue>0)){const required=Math.max(1,contract.capacity/4),delivered=payerDelivered.get(contract.id)??0;if(s.quarter===4&&delivered<required)event(s,'finance',`${contract.name}: delivery settlement`,`${delivered.toLocaleString()} of ${Math.round(required).toLocaleString()} quarterly contracted starts delivered. ${cashLabel(contract.annualRevenue/4*(1-delivered/required))} unearned care allowance was not retained. Fixed access obligations remain payable. Matching care is billed once, at its contracted price.`);}
 revenue=money(revenue);let expenses=money(variableCosts+studyOps+siteOps+headquarters+followupOps+contractExpense);
 const taxes=money(Math.max(0,revenue-expenses)*.2);expenses+=taxes;
 s.company.cash=money(s.company.cash+revenue-expenses);s.company.revenue+=revenue;s.company.expenses+=expenses;s.company.taxes+=taxes;s.company.totalRevenue+=revenue;s.company.totalSpend+=expenses;s.company.lastRevenue=revenue;s.company.lastExpenses=expenses;
 if(s.quarter===4||totalStarts>1000000)event(s,'patient',`${totalStarts.toLocaleString()} people began care this quarter`,`${scoreLabel(s.score.expected)} expected net healthy years at the previous close. Capacity is shared with ${trialBudget.toLocaleString()} trial appointments and continuing follow-up; alternative care continues improving.`,totalStarts>1000000);
}
function bottleneck(r:Region,s:GameState):Family {
 const values:[Family,number][]=[['diagnostics',160*(1+.35*(r.levels.diagnostics-1))*Math.pow(s.world.compute,.2)],['clinic',100*(1+.3*(r.levels.clinic-1))],['manufacturing',140*(1+.4*(r.levels.manufacturing-1))*Math.pow(s.world.biology,.25)],['followup',120*(1+.4*(r.levels.followup-1))]];
 return values.sort((a,b)=>a[1]-b[1])[0][0];
}
export function advanceQuarter(state:GameState):GameState {
 if(state.phase!=='resolving'||state.status!=='active')return clone(state);
 const s=clone(state);if(s.tick>=96){s.phase='ended';return s;}
 // Resolve the currently displayed quarter. At tick95 these are 2050 Q4 starts; tick96 permits none.
 checkControl(s);if(s.status!=='active')return s;processWorld(s);processProjects(s);processCareAndStudies(s);s.tick++;s.score=scoreHealth(s);checkControl(s);
 const t=s.trace[s.trace.length-1];if(t){t.cashAfter=s.company.cash;t.healthAfter=s.score.expected;t.events=s.events.filter(e=>e.year===s.year).map(e=>e.id);}
 if(s.tick>=96&&s.status==='active'){s.phase='ended';s.status=s.score.expected>=1e9?'victory':'partial';s.year=2050;s.quarter=4;event(s,'ending',s.status==='victory'?'One billion net healthy years':'The 2050 initiation window closes',`${scoreLabel(s.score.expected)} expected net lifetime healthy years from ${s.score.people.toLocaleString()} actual care initiations. ${scoreLabel(s.score.experienced)} experienced; ${scoreLabel(s.score.remaining)} projected, dependent on survival, durability, continued care and the improving comparator.`,true);}
 else if(s.status==='active'&&s.tick%4===0){s.history.push({year:s.year,score:s.score.expected,cash:s.company.cash,revenue:s.company.revenue,people:s.score.people,control:s.company.control});s.year=2027+Math.floor(s.tick/4);s.quarter=1;s.phase='planning';s.company.revenue=0;s.company.expenses=0;s.company.capex=0;s.company.taxes=0;s.committed=[];}
 else if(s.status==='active'){s.quarter=(s.tick%4)+1;}
 if(t)t.checksum=checksum(s);return s;
}
function maxPrograms(s:GameState):number{return Math.min(4,2+Math.floor(Math.max(...s.regions.map(r=>r.levels.evidence))/2)+(s.policy.stage==='personal'?2:0));}
export function availableOptions(s:GameState):ActionOption[] {
 const options:ActionOption[]=[];
 const add=(id:string,label:string,description:string,action:Action,category:string,duration:string,impact:string)=>{const reason=actionReason(s,action);options.push({...(action.type==='policy'&&action.operation==='lobby'?{budgetLimit:Math.min(5*MILLION,Math.max(0,s.company.cash))}:{}),id,label,description,action,cost:actionCost(s,action),duration,available:s.phase==='planning'&&s.status==='active'&&!reason,reason:s.status!=='active'?'Campaign complete; inspect the debrief or start a new campaign.':reason??(s.phase==='planning'?'Available':'Resolve this year before making a new commitment.'),category,impact});};
 for(const r of s.regions)for(const family of FAMILIES){
  const next={...r.levels,[family]:family==='network'?networkTarget(s,r):r.levels[family]+1};
  if(family==='network')for(const f of FAMILIES)if(f!=='network')next[f]=Math.max(1,next[f]);
  const currentCapacity=infrastructureCapacity(r.levels,s.world.compute,s.world.biology),nextCapacity=infrastructureCapacity(next,s.world.compute,s.world.biology);
  const impact=`Gross pathway capacity ${scoreLabel(currentCapacity)} → ${scoreLabel(nextCapacity)}/year after commissioning (${Math.floor(nextCapacity-currentCapacity).toLocaleString('en-US')} additional gross slots/year). Continuing care, trials and rival use come first.${constructionQuote(s,r,family)?.deploymentCost?' '+constructionQuote(s,r,family)!.detail:''}`;
  add(`build:${r.id}:${family}`,`${r.name} · ${family} ${next[family]}`,family==='network'?(s.policy.stage==='personal'?'Reusable platform audits commission two paid infrastructure levels in six quarters.':'Register and activate a larger network of qualified partner sites.')+' Each site supplies diagnostic, treatment, manufacturing and follow-up capacity.':'Expand per-site throughput in the shared clinical network.'+(constructionQuote(s,r,family)?.deploymentCost?' '+constructionQuote(s,r,family)!.detail:''),{type:'build',regionId:r.id,family},'Infrastructure',`${constructionDuration(s,r,family)} quarters`,impact);
 }

 for(const p of s.programs){
  for(const pkg of ['narrow','broad','partner'] as StudyPackage[])add(`study:${p.id}:${pkg}`,`${p.name} · ${nextPhase(p)} / ${pkg}`,STUDY_PACKAGES[pkg].label,{type:'program',programId:p.id,operation:p.stage==='preclinical'?'start':'advance',package:pkg},'Clinical',`${studySpecification(s,p,pkg).observation} observation quarters after enrollment + ${studySpecification(s,p,pkg).review} review quarters`,`${studySpecification(s,p,pkg).target} participants. Preparation and recruitment depend on readiness and shared slots; observation cannot be shortened by more sites.`);
  for(const operation of ['readiness','bridge','pause','resume','stop'] as const)add(`program:${p.id}:${operation}`,`${p.name} · ${operation}`,operation==='bridge'?'Adopt the latest available model; continue the current model by leaving this uncommitted.':'Manage this program and its evidence obligations.',{type:'program',programId:p.id,operation},'Clinical',operation==='bridge'?'Immediate decision; revalidation follows':'Immediate decision',operation==='bridge'?`Version ${p.version} → ${p.availableVersion}: modeled response ${(p.response*100).toFixed(1)}% → ${(Math.min(.94,p.response+.012*(p.availableVersion-p.version))*100).toFixed(1)}%; modeled annual benefit +${(2.5*(p.availableVersion-p.version)).toFixed(1)}%. These are assumptions, not new evidence. Site readiness ${Math.round(p.readiness*100)}% → ${Math.round(Math.max(.35,p.readiness-.25)*100)}%. ${p.study?'The study resumes with 80% enrollment retained; observation and review restart.':s.policy.stage==='personal'?'Personal authorization preserves compatible evidence and ongoing surveillance.':'Product revalidation is required.'}`:'Uses one of the two annual commitments');
 }
 for(const d of DEALS)d.variants.forEach((v,i)=>add(`deal:${d.id}:${i}`,`${d.name} · ${v.name}`,v.description,{type:'deal',dealId:d.id,variant:i},'Capital & partnerships',`${v.duration} years`,`${v.cash>0?cashLabel(v.cash)+' funding; ':''}${v.preMoney>0?'equity dilution; ':''}${!v.strategicControl?'strategic rights retained':'investor strategic consent rights'}`));
 add('policy:lobby','Build policy support','Fund a coalition around measured clinical evidence; this does not itself remove requirements.',{type:'policy',operation:'lobby'},'Policy','Annual commitment','Support enables a charter offer after a demonstration qualifies');
 add('policy:charter:0','Choose an open platform charter','Portable evidence and registry standards; six-quarter implementation.',{type:'policy',operation:'charter',variant:0},'Policy','Offer now; implementation separately','Open evidence and care portability');
 add('policy:charter:1','Choose a stewarded platform charter','Four-quarter implementation, with a 2% registry levy.',{type:'policy',operation:'charter',variant:1},'Policy','Offer now; implementation separately','Faster implementation, recurring economic cost');
 add('policy:platform',s.policy.stage==='platform'?'Enable personalized pathways':'Implement the platform charter',s.policy.stage==='platform'?'Personal AGI authorization within validated scope removes separate version reauthorization and includes cross-border portability. Reusable audits commission two paid network levels per commitment in six quarters.':'Make the offered legal framework operational through registry and monitoring systems.',{type:'policy',operation:'platform'},'Policy',s.policy.stage==='platform'?'Immediate with qualifying evidence':'4–6 quarters','Replaces scoped phase 3 product requirements; personal scope removes separate version reauthorization');
 add('policy:recognition','Cross-border recognition','Make the platform and continuing-care records portable across three jurisdictions.',{type:'policy',operation:'recognition'},'Policy','4 quarters','Removes regional permission gates; infrastructure is still needed');
 for(const priority of ['balanced','care','research'] as const)add(`priority:${priority}`,`${priority} queue priority`,'Allocate scarce diagnostic, clinical, manufacturing and evidence appointments.',{type:'priority',priority},'Operations','Until changed','More trial enrollment competes with current care');
 add('wait','Hold capacity','Keep resources available while studies, construction and care continue.',{type:'wait'},'Operations','One annual commitment','No new capital or clinical commitment');return options;
}
export function getView(s:GameState):GameView {
 const capacity=activeCapacity(s);const programs=s.programs.filter(p=>p.study&&!p.study.paused).length;
 const burn=Math.max(0,(s.company.lastExpenses-s.company.lastRevenue)*4);const runway=burn>0?Math.max(0,s.company.cash/burn):99;
 const shift=releasesForScenario(s.scenario).find(r=>r.year>s.year);
 let guidance='Expand registered sites, protect runway and complete human evidence. Two commitments resolve four quarters of care and research.';
 if(s.company.cash<2*MILLION)guidance='Cash is the binding constraint. Close a control-preserving financing before committing scarce capital.';
 else if(s.policy.qualified&&s.policy.charter===null&&s.policy.support<.5)guidance='Your monitored-care demonstration can support reform. Lobbying creates a charter opportunity; implementation must follow.';
 else if(s.policy.stage==='platform'&&!actionReason(s,{type:'policy',operation:'platform'}))guidance='Personalized pathways are now available in World: remove separate version reauthorization and commission two paid regional network levels per commitment. Compare that transformation with further expansion under current rules.';
 else if(s.policy.stage==='offered')guidance='The charter is only an offer. Implement it to replace product-level requirements within validated scope.';
 else if(s.policy.stage==='platform'&&!s.policy.recognition)guidance='The platform works locally. Cross-border recognition removes permission gates; each new region still needs commissioned sites.';
 else if(s.programs.some(p=>!p.study&&(p.stage==='phase1'||p.stage==='phase2')))guidance='A clinical study has completed. Choose the next package to move evidence forward; trials do not advance themselves.';
 else if(s.world.modelVersion>1&&s.programs.some(p=>p.study&&p.version<p.availableVersion))guidance='A better AI model is available. Bridge it with revalidation work, or retain the current version and finish observation.';
 if(s.phase==='ended')guidance=s.status==='partial'?`${scoreLabel(Math.max(0,1e9-s.score.expected))} expected healthy years short of the mission. Future benefit from care already begun remains included; no new care after 2050 is credited.`:s.status==='victory'?'The billion-year mission is achieved with founder control retained. Review the lifetime impact, company economics and pivotal decisions.':s.status==='control-loss'?'Founder decision rights were transferred. Play ended before subsequent care; existing health gains remain recorded.':'The funding cure period expired. Existing experienced gains remain, with future benefit adjusted for uncertain care handoff.';
 return{value:valueCompany(s),state:s,options:availableOptions(s),headline:s.phase==='ended'?`${s.status==='victory'?'Ambition achieved':s.status==='partial'?'2050 close':s.status==='control-loss'?'Control lost':'Runway exhausted'} · ${scoreLabel(s.score.expected)} net years`:`${s.year} · ${scoreLabel(s.score.expected)} / 1B expected healthy years`,guidance,capacity,waiting:s.regions.filter(r=>r.unlocked).reduce((n,r)=>n+r.waiting,0),runway,activePrograms:programs,maxPrograms:maxPrograms(s),nextShift:shift?`${shift.year}: ${shift.title}`:'All announced technology shifts have arrived'};
}
export function checksum(s:GameState):string {const {trace,...rest}=s;return semanticChecksum({...rest,trace:trace.map(({checksum,...t})=>t)});}
/** A transparent policy used by investor delegation and headless balance runs. All decisions use current public state. */
export function autoPlan(state:GameState):Action[] {
 if(state.phase!=='planning'||state.status!=='active')return[];
 if(state.tick===0)return[{type:'build',regionId:state.regions[0].id,family:'clinic'},{type:'program',programId:'immune-reset',operation:'start',package:'narrow'}];
 const s=clone(state);const actions:Action[]=[];
 const push=(a:Action):boolean=>{if(actions.length>=2||actionReason(s,a))return false;actions.push(a);applyAction(s,a);return true;};
 const financing=()=>DEALS.flatMap(d=>d.variants.map((v,i)=>({d,v,i}))).filter(({d,v})=>d.availableYear<=s.year&&!s.seenDecisions.includes(`deal:${d.id}`)&&v.cash>0&&!v.strategicControl&&v.founderSeats>=3).sort((a,b)=>b.v.cash-a.v.cash);
 const burn=Math.max(.8*MILLION,(s.company.lastExpenses-s.company.lastRevenue)*4);
 if(s.company.cash<Math.max(6*MILLION,burn*2.5)){const f=financing()[0];if(f)push({type:'deal',dealId:f.d.id,variant:f.i});}
 const advanced=s.programs.filter(p=>!p.licensed&&availableProgram(s,p));
 for(const p of advanced.filter(p=>p.study?.paused&&p.lastResult.includes('failed')&&p.availableVersion>p.version))push({type:'program',programId:p.id,operation:'bridge'});
 // Completing observed evidence takes precedence over speculative version upgrades.
 for(const p of advanced.filter(p=>!p.study&&(p.stage==='phase1'||p.stage==='phase2'))){if(p.stage==='phase2'&&(s.policy.stage==='platform'||s.policy.stage==='personal'))continue;push({type:'program',programId:p.id,operation:'advance',package:p.stage==='phase1'?'broad':'narrow'});if(actions.length===2)return actions;}
 const hasHuman=s.programs.some(p=>p.study||(!p.licensed&&p.evidence>0));
 if(!hasHuman&&s.year<=2041){const p=advanced.find(p=>p.stage==='preclinical');if(p)push({type:'program',programId:p.id,operation:'start',package:'narrow'});}
 if(s.policy.qualified&&s.policy.charter===null){if(s.policy.support<.5&&s.policy.window===0)push({type:'policy',operation:'lobby'});else push({type:'policy',operation:'charter',variant:0});}
 if(s.policy.stage==='offered')push({type:'policy',operation:'platform'});
 if(s.policy.stage==='platform'&&!s.policy.recognition&&!s.projects.some(p=>p.kind==='recognition'))push({type:'policy',operation:'recognition'});
 if(s.policy.stage==='platform'&&s.policy.recognition&&s.programs.reduce((n,p)=>n+p.evidence,0)>=2.3)push({type:'policy',operation:'platform'});
 // Preserve a practical working-capital reserve; network growth increases actual sites exponentially.
 while(actions.length<2){
  if(s.year>=2045&&s.policy.recognition){const empty=s.regions.find(r=>!r.unlocked&&!s.projects.some(p=>p.regionId===r.id&&p.family==='network'));if(empty&&push({type:'build',regionId:empty.id,family:'network'}))continue;}
  const permitted=s.regions.filter(r=>permission(s,r));
  const target=permitted.filter(r=>!s.projects.some(p=>p.kind==='build'&&p.regionId===r.id&&p.family==='network')&&r.levels.network<8&&r.treated<r.population*.85).sort((a,b)=>{
   const efficiency=(r:Region)=>{const next=infrastructureCapacity({...r.levels,diagnostics:Math.max(1,r.levels.diagnostics),clinic:Math.max(1,r.levels.clinic),manufacturing:Math.max(1,r.levels.manufacturing),followup:Math.max(1,r.levels.followup),network:networkTarget(s,r)},s.world.compute,s.world.biology);return Math.min(r.population-r.treated,next-r.capacity)*Math.sqrt(r.population)/Math.max(1,constructionCost(s,r,'network'));};return efficiency(b)-efficiency(a);
  }).find(r=>constructionCost(s,r,'network')<s.company.cash-Math.max(1.8*MILLION,burn));
  if(target&&push({type:'build',regionId:target.id,family:'network'}))continue;
  // Later products diversify genuine care benefit when deployment is already funded.
  const p=advanced.find(p=>p.stage==='preclinical'&&!p.study&&s.year<2042&&s.company.cash>12*MILLION);
  if(p&&push({type:'program',programId:p.id,operation:'start',package:'narrow'}))continue;
  const upgrades=s.regions.filter(r=>r.unlocked&&r.waiting>1000&&permission(s,r)).flatMap(r=>(['clinic','followup','diagnostics','manufacturing'] as Family[]).filter(f=>r.levels[f]<8&&!s.projects.some(p=>p.regionId===r.id&&p.family===f)).map(f=>({r,f,gain:infrastructureCapacity({...r.levels,[f]:r.levels[f]+1},s.world.compute,s.world.biology)-r.capacity,cost:constructionCost(s,r,f)}))).filter(x=>x.gain>0&&x.cost<s.company.cash-8*MILLION).sort((a,b)=>b.gain*Math.min(1,b.r.waiting/b.gain)/b.cost-a.gain*Math.min(1,a.r.waiting/a.gain)/a.cost);
  if(upgrades[0]&&push({type:'build',regionId:upgrades[0].r.id,family:upgrades[0].f}))continue;
  push({type:'wait'});
 }
 return actions;
}
/** Investor-mode operations stay inside CEO-approved clinical and infrastructure mandates. No funding, contract or policy rescue is delegated. */
export function delegatePlan(state:GameState):Action[] {
 if(state.phase!=='planning'||state.status!=='active')return[];
 const s=clone(state),actions:Action[]=[];
 const push=(a:Action)=>{if(actions.length<2&&!actionReason(s,a)){actions.push(a);applyAction(s,a);return true;}return false;};
 const burn=Math.max(.8*MILLION,(s.company.lastExpenses-s.company.lastRevenue)*4);
 if(s.company.control==='at-risk'||s.company.cash<burn*1.5)return[{type:'wait'},{type:'wait'}];
 // Continuity is the first operational duty; discretionary studies come afterward.
 const continuity=s.regions.filter(r=>r.unlocked&&permission(s,r)&&r.bottleneck==='followup'&&r.levels.followup<8&&!s.projects.some(p=>p.kind==='build'&&p.regionId===r.id&&p.family==='followup')).sort((a,b)=>(b.queue?.followupRequired??0)-(a.queue?.followupRequired??0));
 for(const r of continuity)if(constructionCost(s,r,'followup')<s.company.cash-burn*2)push({type:'build',regionId:r.id,family:'followup'});
 for(const p of s.programs.filter(p=>!p.licensed&&p.evidence>0&&!p.study&&(p.stage==='phase1'||p.stage==='phase2'))){if(p.stage==='phase2'&&p.evidence>=.45&&(s.policy.stage==='platform'||s.policy.stage==='personal'||s.projects.some(project=>project.kind==='platform')))continue;const a:Action={type:'program',programId:p.id,operation:'advance',package:p.partnered?'partner':'narrow'};if(actionCost(s,a)<s.company.cash-burn*2)push(a);}
 while(actions.length<2){
  const candidates=s.regions.filter(r=>r.unlocked&&permission(s,r)&&r.waiting>0&&!['demand','cash','permission'].includes(r.bottleneck)).flatMap(r=>(['network','clinic','followup','diagnostics','manufacturing'] as Family[]).filter(f=>r.levels[f]<8&&!s.projects.some(p=>p.kind==='build'&&p.regionId===r.id&&p.family===f)).map(f=>{const next={...r.levels,[f]:f==='network'?networkTarget(s,r):r.levels[f]+1};const gain=Math.max(0,infrastructureCapacity(next,s.world.compute,s.world.biology)-infrastructureCapacity(r.levels,s.world.compute,s.world.biology));return{r,f,gain:Math.min(r.waiting,gain),cost:constructionCost(s,r,f)};})).filter(c=>c.gain>0&&c.cost<s.company.cash-burn*2).sort((a,b)=>b.gain/Math.max(1,b.cost)-a.gain/Math.max(1,a.cost));
  const candidate=candidates[0];if(candidate&&push({type:'build',regionId:candidate.r.id,family:candidate.f}))continue;
  push({type:'wait'});
 }
 return actions;
}
