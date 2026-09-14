import type {Action,Event,Facility,Link,Option,Preview,Program,Projection,State,Validation,View} from './types';
import {M,initialFacilities,initialLinks,initialRegions,EMPTY_ACCOUNT,dateAt} from './content';
import {initialPrograms,worldAt,candidateFor,studySpec,studyResult,makeCohort,advanceHealth,scoreCohorts,quarterSurvival,populationAge,followupQuartersFor} from './science';
import {initialNetworkCompany,fundraiseQuote,financedCompany,operatingAccount,forecastNetwork,operatingRates} from './economy';
import {semanticChecksum} from '../core/canonical';
import {shareFraction} from '../world/economy';
const copy=<T>(v:T):T=>structuredClone(v);
const cents=(n:number)=>Math.round(n);
const cashText=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n/100);
const exactCashText=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n/100);
const STAFF_RECRUITMENT=1500000;
function event(s:State,kind:Event['kind'],title:string,detail:string,major=false){s.events.push({id:`${s.tick}:${s.events.length}`,tick:s.tick,kind,title,detail,major});}
export function createCampaign(scenario:State['scenario']='convergence',seed=2027):State{
 const s:State={version:'network-2.2',seed:seed>>>0,scenario,tick:0,status:'active',company:initialNetworkCompany(),facilities:initialFacilities(),links:initialLinks(),regions:initialRegions(),programs:initialPrograms(),world:worldAt(0,scenario,seed),policy:{support:0,stage:'product',campaignSpend:0,window:0,nextWindow:8,pendingStage:null,effectiveAt:0,recognized:false},cohorts:[],health:{expected:0,experienced:0,remaining:0,people:0,low:0,high:0,tailError:0},projects:[],events:[],account:copy(EMPTY_ACCOUNT),accounts:[],commands:[],historicalFollowup:240,creditsUsed:0,publicCompany:false,partnerships:[],cureUntil:null};
 event(s,'care','Forty people are waiting for a treatment place','Riverside can start 80 of 120 eligible people. Expand your clinic or connect a hospital partner. Existing medicines and testing are already supplied.',true);
 event(s,'finance','A working care business','The opening service earns $616k per quarter against $709k of costs, including the $150k research team. All prices, clinical estimates and investment terms are fictional.');
 const first=allocate(s);s.account=operatingAccount(s,first.starts,first.followup,trialQuarterCost(s));settleSiteAccounts(s,first);return s;
}
function clinicalSite(f:Facility){return f.kind==='clinic'||f.kind==='hospital';}
function running(f:Facility){return f.status==='operating'&&(f.owner==='db'||f.owner==='partner');}
/** Dedicated follow-up hires add support beyond the existing clinical team's capacity. */
export function supportCapacity(f:Facility){const followup=f.followupEmployees??0;return Math.max(f.capacity*3,(f.employees-followup)*60)+followup*60;}
function facility(s:State,id:string){const f=s.facilities.find(f=>f.id===id);if(!f)throw Error('That site does not exist.');return f;}
function program(s:State,id:string){const p=s.programs.find(p=>p.id===id);if(!p)throw Error('That therapy does not exist.');return p;}
function hasProject(s:State,id:string){return s.projects.some(p=>p.siteId===id&&p.kind!=='staff');}
function adoptionRoute(s:State,p:Program):{stage:Program['stage'];detail:string}{
 if(p.kind==='personalized'&&s.policy.stage==='personal'&&p.authorizedCandidate)return {stage:'approved',detail:'The accepted personalized platform permits this update. Existing people benefit only after a funded update consumes treatment, testing and production capacity.'};
 const safetyDone=p.stage!=='preclinical';
 const effectDone=p.stage==='phase2'||p.stage==='phase3'||p.stage==='approved';
 const stage=s.policy.stage!=='product'&&effectDone?'phase2':safetyDone?'phase1':'preclinical';
 return {stage,detail:`${p.study?'Stops the current study and releases its remaining budget. ':''}${safetyDone?'Retains completed safety work and 70% of compatible evidence. ':'Retains 70% of compatible evidence. '}The replacement needs ${stage==='preclinical'?'Phase 1 safety testing':stage==='phase1'?'a Phase 2 confirmation study':'a registration confirmation study under the accepted platform'}. ${p.authorizedCandidate?'The previous approved version remains available for care.':'This product is not yet approved for commercial care.'}`};
}
function installment(p:Program):number {const st=p.study;if(!st||st.paused)return 0;return Math.min(Math.max(0,st.cost-(st.spent??0)),cents(st.cost/(st.phase==='phase1'?6:st.phase==='phase2'?9:14)));}
function trialQuarterCost(s:State):number {const active=s.programs.filter(p=>p.study&&!p.study.paused);return active.length?active.reduce((n,p)=>n+installment(p),0):s.programs.some(p=>p.developmentSpend>0||p.study)?0:15000000;}
function quoteCost(s:State,a:Action):number {
 if(a.type==='expand')return facility(s,a.siteId).kind==='factory'?90000000:facility(s,a.siteId).kind==='lab'?30000000:60000000;
 if(a.type==='partner')return 22500000;
 if(a.type==='build')return ({factory:90000000,lab:40000000,clinic:90000000,hospital:140000000})[a.kind];
 if(a.type==='connect')return 1500000;
 if(a.type==='trial-team')return cents(15000000*Math.max(1,facility(s,a.siteId).units));
 if(a.type==='staff')return a.people*STAFF_RECRUITMENT;
 if(a.type==='study'){const spec=studySpec(program(s,a.programId),s.world,s.policy,a.package);return cents(spec.cost/(spec.phase==='phase1'?6:spec.phase==='phase2'?9:14));}
 if(a.type==='adopt')return Math.max(0,25000000-Math.min(s.company.credits,20000000));
 if(a.type==='upgrade')return cents(({local:30000000,home:50000000,wearable:90000000})[a.delivery]*Math.max(1,facility(s,a.siteId).units));
 if(a.type==='policy')return a.budget;
 if(a.type==='partnership')return a.kind==='frontier'?30000000:a.kind==='manufacturer'?20000000:10000000;
 if(a.type==='replicate')return cents(a.units*(22500000+({clinic:0,local:30000000,home:50000000,wearable:90000000})[facility(s,a.siteId).delivery]));
 if(a.type==='ipo')return 100000000;
 return 0;
}
function actionReason(s:State,a:Action):string|null{
 if(s.status!=='active'||s.tick>=96)return 'The campaign has ended.';
 if(!a||typeof a.type!=='string')return 'Unknown decision.';
 if(!['expand','partner','build','connect','trial-team','staff','study','adopt','pause','stop','treatment','upgrade','policy','raise','partnership','sell','replicate','ipo'].includes(a.type))return 'Unknown decision.';
 if((a.type==='raise'||a.type==='ipo')&&s.company.rounds.some(r=>r.id.startsWith(`network-round-${s.tick}-`)))return 'This quarter has one capital-market allocation. Edit the planned round amount instead of stacking another round; the next quote opens next quarter.';
 const siteId='siteId' in a?a.siteId:null;
 const f=siteId?s.facilities.find(f=>f.id===siteId):undefined;
 if(siteId&&!f)return 'Choose an existing site.';
 if(['expand','trial-team','upgrade','replicate'].includes(a.type)&&f&&(!running(f)||hasProject(s,f.id)))return 'The site must be operating with no unfinished construction.';
 if(a.type==='expand'&&f&&(!['clinic','hospital','factory','lab'].includes(f.kind)||f.owner!=='db'))return 'Expand an owned clinic, hospital, factory or lab.';
 if(a.type==='partner'&&f&&(f.owner!=='available'||!clinicalSite(f)))return 'Choose an available hospital or clinic partner.';
 if(a.type==='build'&&f&&(f.owner!=='available'||hasProject(s,f.id)))return 'This site is already committed.';
 if(a.type==='staff'){
  if(!f||!running(f)||!clinicalSite(f))return 'Hire follow-up staff at an operating owned or partner clinic or hospital.';
  if(!Number.isSafeInteger(a.people)||a.people<1||!Number.isSafeInteger(a.people*STAFF_RECRUITMENT)||!Number.isSafeInteger(a.people*operatingRates(f).staffQuarter)||f.employees+a.people>Number.MAX_SAFE_INTEGER)return 'Choose a positive whole number of follow-up staff with a supported recruitment and payroll cost.';
  if(s.projects.some(p=>p.siteId===f.id&&p.kind==='staff'))return 'Follow-up hiring is already underway here. Edit the planned headcount instead of adding another hiring project.';
 }
 if(a.type==='connect'){
  const from=s.facilities.find(f=>f.id===a.from),to=s.facilities.find(f=>f.id===a.to);if(!from||!to||from.id===to.id||!clinicalSite(to))return 'Connect a suitable supplier or community to a clinical site.';
  if(a.kind==='medicine'&&from.kind!=='factory'||a.kind==='tests'&&from.kind!=='lab'||a.kind==='patients'&&from.kind!=='community')return 'The source does not provide this service.';
  if(a.kind==='patients'&&from.region!==to.region)return 'Patient access must connect the population in this care site’s region.';
  if(a.kind==='medicine'&&to.delivery!=='clinic')return 'This site makes supported therapies locally. Finished-medicine shipping is no longer required.';
  if(to.owner==='available'&&!hasProject(s,to.id)||from.owner==='available'&&!hasProject(s,from.id))return 'Build or partner with these sites before connecting them.';
  if(s.links.some(l=>l.from===a.from&&l.to===a.to&&l.kind===a.kind&&l.active))return 'This connection is already active.';
 }
 if(a.type==='trial-team'&&f&&(!clinicalSite(f)||f.trialTeam))return 'Add a research team to a clinic or hospital that does not already have one.';
 if('programId' in a){const p=s.programs.find(p=>p.id===a.programId);if(!p||p.availableAt>s.tick)return 'This therapy is not available yet.';
  if(a.type==='study'){
   if(!f||!running(f)||!clinicalSite(f)||!f.trialTeam)return 'Choose an operating clinic with a trial team.';
   if(p.study)return 'Finish, pause or stop the existing study before a new one.';
   if(p.stage==='approved'&&p.authorizedGeneration===p.candidate.generation)return 'This version is already approved.';
   if(s.programs.filter(p=>p.study&&!p.study.paused).length>=(s.world.generation>=4?4:2))return 'All research teams are committed to active studies.';
   if(p.id==='aspis'&&!s.world.wearables)return 'Immune wearable prototypes are not yet technically ready. Track the hardware signal in World.';
   if(p.id==='cell-repair'&&f.kind!=='hospital')return 'Engineered cell studies require a specialist hospital with a trial team.';
  }
  if(a.type==='adopt'&&p.frontier.generation<=p.candidate.generation)return 'This program already uses the latest candidate.';
  if(a.type==='pause'&&!p.study)return 'There is no active study to pause.';
  if(a.type==='pause'&&p.study?.failed)return 'A failed study cannot resume. Stop it or adopt a better candidate before commissioning new evidence.';
  if(a.type==='stop'&&!p.study&&p.stage==='preclinical')return 'There is no study to stop.';
  if(a.type==='treatment'&&(!f||!running(f)||!clinicalSite(f)))return 'Select an operating clinical site.';
  if(a.type==='treatment'&&!p.authorizedCandidate)return 'This therapy needs clinical authorization before commercial treatment.';
  if(a.type==='treatment'&&p.id==='aspis'&&f?.delivery!=='wearable')return 'Install an immune wearable service first.';
  if(a.type==='treatment'&&p.id==='cell-repair'&&f?.kind!=='hospital'&&f?.delivery==='clinic')return 'Cell therapy needs a specialist hospital, or an accepted local or home delivery system.';
 }
 if(a.type==='upgrade'){
  if(f&&({clinic:0,local:1,home:2,wearable:3})[a.delivery]<=({clinic:0,local:1,home:2,wearable:3})[f.delivery])return 'This service already has an equal or more advanced delivery system.';
  if(!f||!clinicalSite(f))return 'Install this equipment at a clinical service.';
  if(f.delivery===a.delivery)return 'This service already has that equipment.';
  if(a.delivery==='local'&&!s.world.localMakers||a.delivery==='home'&&!s.world.homeMakers||a.delivery==='wearable'&&!s.world.wearables)return 'The required technology has not arrived.';
  if(a.delivery==='local'&&s.policy.stage==='product')return 'A local production platform must be accepted first.';
  if(a.delivery!=='local'&&s.policy.stage!=='personal')return 'Home production and wearable treatments need the personal authorization pathway.';
 }
 if(a.type==='policy'){
  if(!Number.isSafeInteger(a.budget)||a.budget<10000000||a.budget>500000000)return 'Choose $100k–$5m for policy engagement.';
  if(a.proposal==='personal'&&s.policy.stage==='product')return 'First build support for an accepted treatment platform.';
  if(a.proposal==='recognition'&&s.policy.recognized)return 'Cross-region recognition is already in force.';
 }
 if(a.type==='raise'){
  if(!['protected','growth','control'].includes(a.terms))return 'Select financing terms.';
  const q=fundraiseQuote(s);if(!Number.isSafeInteger(a.amount)||a.amount<10000000||a.amount>q.maxRaise)return `This round can raise $100k–${cashText(q.maxRaise)}.`;
 }
 if(a.type==='partnership'&&s.partnerships.includes(a.kind))return 'This partnership is already active.';
 if(a.type==='sell'&&f&&(f.owner!=='db'||f.basis<=0||!running(f)||hasProject(s,f.id)))return 'Sell an operating, owned facility with no construction pending.';
 if(a.type==='replicate'){
  if(!f||!clinicalSite(f)||f.lastStarts<=0)return 'First demonstrate an operating care service.';
  if(s.policy.stage==='product')return 'A recognized platform is required for replication.';
  if(!Number.isSafeInteger(a.units)||a.units<1||a.units>100000)return 'Choose 1–100,000 sites.';
  if(!s.regions[a.region])return 'Select a valid region.';
  if(a.region!==0&&!s.policy.recognized&&s.policy.stage!=='personal')return 'Cross-region recognition is needed.';
 }
 if(a.type==='ipo'&&s.publicCompany)return 'DB is already public. Use the adjustable capital round for additional financing.';
 if(a.type==='ipo'&&(s.tick<20||s.account.revenue<100000000))return 'An IPO requires 2032 or later and at least $1m quarterly revenue.';
 return null;
}
function applyAction(s:State,a:Action){
 const cost=quoteCost(s,a);
 // Study costs are paid in installments by the operating ledger, not charged twice here.
 if(a.type!=='study')s.company.cash-=cost;
 if(a.type==='staff'){
  const f=facility(s,a.siteId),name=`Hire ${a.people.toLocaleString()} follow-up staff at ${f.name}`;
  // Recruitment is a one-off cash commitment, not equipment or quarterly operations.
  // Leave site basis, units, the operating-spend ledger and its construction clock alone.
  s.projects.push({id:`project-${s.tick}-${s.projects.length}`,name,siteId:f.id,kind:'staff',readyAt:s.tick+1,cost,units:0,people:a.people});
  event(s,'build',name,`${exactCashText(cost)} recruitment paid upfront; ${a.people.toLocaleString()} staff start in 1 quarter. Additional payroll ${exactCashText(a.people*operatingRates(f).staffQuarter)} per quarter after hiring. Treatment capacity is unchanged.`);return;
 }
 if(['expand','partner','build','trial-team','upgrade','replicate'].includes(a.type)){
  const x=a as Extract<Action,{siteId:string}>,f=facility(s,x.siteId);
  const kind=a.type==='build'?a.kind:a.type==='trial-team'?'trial':a.type==='upgrade'?a.delivery:a.type;
  const duration=a.type==='partner'?1:a.type==='trial-team'?1:a.type==='expand'?2:a.type==='replicate'?4:a.type==='upgrade'?a.delivery==='wearable'?4:2:3;
  let target=f;
  if(a.type==='replicate'){
   const id=`network-${a.region}-${s.tick}-${s.facilities.length}`;
   const batch=s.facilities.filter(x=>x.region===a.region&&x.id.startsWith('network-')).length+1;
   target={...copy(f),id,name:`Network ${batch} · ${a.units.toLocaleString()} sites`,description:`${a.units.toLocaleString()} partner sites in ${s.regions[a.region].name}, following ${f.name}'s treatment and equipment blueprint. Select this batch to inspect or upgrade it independently.`,x:130+(a.region%3)*300,y:130+Math.floor(a.region/3)*290,region:a.region,status:'building',owner:'partner',units:a.units,capacity:Math.round(f.capacity/Math.max(1,f.units)*a.units),employees:a.units,basis:0,trialTeam:false,lastStarts:0,lastFollowup:0,lastRevenue:0,lastCosts:0};s.facilities.push(target);
   delete target.followupEmployees;
   // Replication buys a complete provider contract with finite regional testing and supply.
   // It never duplicates the capacity of the original supplier for free.
   target.x=650;target.y=300;
   const factoryId=`supply-${id}`,labId=`tests-${id}`,communityId=`people-${id}`;
   const source=(sourceId:string,name:string,kind:Facility['kind'],x:number,y:number,capacity:number):Facility=>({...copy(target),id:sourceId,name,kind,x,y,owner:'public',capacity,employees:0,trialTeam:false,programId:f.programId,description:kind==='factory'?'Contracted regional supply. Capacity, compatible inputs and product checks are included in provider fees.':kind==='lab'?'Contracted regional testing. Finite tests are shared by this operating care network.':'People in the covered regional population.'});
   s.facilities.push(source(factoryId,`Network ${batch} supply`,'factory',220,390,target.capacity*1.25),source(labId,`Network ${batch} testing`,'lab',240,150,target.capacity*1.25),source(communityId,`Network ${batch} community`,'community',820,160,0));
   for(const [from,kind] of [[factoryId,'medicine'],[labId,'tests'],[communityId,'patients']] as const)s.links.push({id:`${from}-${id}`,from,to:id,kind,active:true,lastFlow:0,capacity:kind==='patients'?1e9:target.capacity*1.25});
  }
  if(a.type==='partner'||a.type==='build'){f.owner=a.type==='partner'?'partner':'db';f.status='building';if(a.type==='build'){f.kind=a.kind;f.capacity=a.kind==='factory'?160:a.kind==='lab'?320:80;f.employees=a.kind==='factory'?4:a.kind==='lab'?3:6;f.name=`DB ${a.kind==='factory'?'Therapy Factory':a.kind==='lab'?'Testing Lab':a.kind==='hospital'?'Specialist Hospital':'Treatment Clinic'}`;f.description=a.kind==='factory'?'Makes treatment courses for connected clinics and trials. Owned production replaces some purchased medicine costs; staffing and product checks remain.':a.kind==='lab'?'Tests patient samples for connected treatment and trial sites. Testing capacity is shared across the network.':a.kind==='hospital'?'Delivers specialist treatment and supports complex cell therapy. Add a research team to join the clinical trial network.':'Administers authorized medicines and follows patients after treatment. Needs connected patient access, medicine and tests.';}}
  target.readyAt=s.tick+duration;target.basis+=cost;s.company.capex+=cost;
  s.projects.push({id:`project-${s.tick}-${s.projects.length}`,name:a.type==='upgrade'?`Install ${a.delivery==='local'?'clinic therapy maker':a.delivery==='home'?'home therapy systems':'Aspis immune wearables'}`:a.type==='trial-team'?'Prepare clinical trial team':`${a.type==='expand'?'Expand':a.type==='partner'?'Connect partner':a.type==='replicate'?'Replicate':'Build'} ${target.name}`,siteId:target.id,kind:kind as State['projects'][number]['kind'],readyAt:target.readyAt,cost,units:a.type==='replicate'?a.units:1});
  event(s,'build',s.projects.at(-1)!.name,`${cashText(cost)} committed; operating in ${duration} quarter${duration===1?'':'s'}.`);return;
 }
 if(a.type==='connect'){s.links.push({id:`${a.from}-${a.to}-${a.kind}`,from:a.from,to:a.to,kind:a.kind,active:true,lastFlow:0,capacity:facility(s,a.from).capacity||1e9});event(s,'build','A new service connection',`${facility(s,a.from).name} now supplies ${a.kind} to ${facility(s,a.to).name}.`);}
 if(a.type==='study'){
  const p=program(s,a.programId),spec=studySpec(p,s.world,s.policy,a.package);
  p.study={...spec,siteId:a.siteId,generation:p.candidate.generation,package:a.package,started:s.tick,enrolled:0,observed:0,paused:false,failed:false,response:null,harm:null};
  event(s,'clinical',`${p.name}: ${spec.phase} starts`,`${spec.target} participants; ${spec.preparation}Q preparation, recruitment, ${spec.observation}Q observation and ${spec.review}Q review. ${cashText(spec.cost)} planned study budget.`,true);
 }
 if(a.type==='adopt'){
  const p=program(s,a.programId),old=p.candidate.generation,route=adoptionRoute(s,p);p.candidate=copy(p.frontier);s.creditsUsed+=Math.min(s.company.credits,20000000);s.company.credits=Math.max(0,s.company.credits-20000000);
  p.study=null;p.evidence*=.7;p.stage=route.stage;
  if(p.kind==='personalized'&&s.policy.stage==='personal'&&p.authorizedCandidate){p.authorizedCandidate=copy(p.candidate);p.authorizedGeneration=p.candidate.generation;p.stage='approved';}
  p.lastResult=`Adopted design generation ${old} → ${p.candidate.generation}. ${route.detail} Existing participants retain their follow-up.`;event(s,'clinical',`${p.name}: a stronger candidate`,p.lastResult,true);
 }
 if(a.type==='pause'){const st=program(s,a.programId).study!;st.paused=!st.paused;}
 if(a.type==='stop'){const p=program(s,a.programId);p.study=null;p.stage=p.authorizedCandidate?'approved':'preclinical';event(s,'clinical','Study stopped','Unused study reservations are released. Existing participants remain in the care and follow-up ledger.');}
 if(a.type==='treatment'){facility(s,a.siteId).programId=a.programId;event(s,'care','Treatment offering changed',`${facility(s,a.siteId).name} will offer ${program(s,a.programId).name}. Its actual supplies and permission still limit starts.`);}
 if(a.type==='policy'){
  s.policy.campaignSpend+=cost;s.policy.support=Math.min(.99,s.policy.support+(1-s.policy.support)*(.1+.18*Math.sqrt(cost/M)));s.policy.window=4;
  if(a.proposal==='recognition'){s.policy.recognized=true;event(s,'policy','Recognition agreement signed','Operating platforms can expand into other regions; supply, equipment and staff are still required.',true);}
  else event(s,'policy',a.proposal==='personal'?'Personal authorization coalition':'Predictive-evidence coalition',`Support ${Math.round(s.policy.support*100)}%. Reform is considered at a political window; evidence and technical capability remain separate gates.`);
 }
 if(a.type==='raise'){s.company=financedCompany(s,a.amount,a.terms);event(s,'finance','Financing closed',`${cashText(a.amount)} raised at ${cashText(s.company.rounds.at(-1)!.preMoney)} pre-money. Ownership changes with the actual check and terms.`,true);}
 if(a.type==='partnership'){
  s.partnerships.push(a.kind);
  if(a.kind==='frontier'){s.company.credits+=200000000;s.company.royalty+=.04;event(s,'finance','Frontier model partnership','Restricted design credits pay up to $200k of each candidate adoption. The partner receives 4% of future service receipts. Credits do not pay salaries.');}
  if(a.kind==='manufacturer'){for(const f of s.facilities.filter(f=>f.kind==='factory'&&f.owner==='public'))f.capacity*=3;event(s,'build','Manufacturing slots reserved','The partner reserves study and commercial supply for the supported therapy families. Its finite factory capacity is shared across the network.');}
  if(a.kind==='payer'){for(const r of s.regions)r.arrivals*=2;event(s,'finance','Population service mandate','Covered patient demand doubles; the payer receives a 10% price discount. Delivering care remains necessary for revenue.');}
 }
 if(a.type==='sell'){const f=facility(s,a.siteId),proceeds=cents(f.basis*.65);s.company.cash+=proceeds;f.owner='partner';f.basis=0;f.employees=(clinicalSite(f)?f.units:0)+(f.followupEmployees??0);event(s,'finance',`${f.name}: sale with care handoff`,`${cashText(proceeds)} received. The buyer keeps care and supply running; DB retains service-fee economics and follow-up obligations.`,true);}
 if(a.type==='ipo'){s.publicCompany=true;s.company=financedCompany(s,Math.min(fundraiseQuote(s).maxRaise,Math.max(500000000,s.account.revenue*8)),'protected');event(s,'finance','Digital Biologics goes public','New public capital is raised with founder control retained. This is financing, not an exit payout to the illustrative investor.',true);}
}
export function validatePlan(state:State,actions:Action[]):Validation{
 const reasons:string[]=[];let cost=0,reserved=0;const s=copy(state);
 if(!Array.isArray(actions)||actions.length>500)return{valid:false,reasons:['Invalid plan.'],cost:0};
 for(const a of actions){try{const reason=actionReason(s,a);if(reason){reasons.push(reason);continue;}const due=quoteCost(s,a);cost+=due;if(a.type!=='raise'&&a.type!=='sell'&&s.company.cash-reserved<due){reasons.push(`Insufficient cash: ${cashText(due)} needed after the other commitments.`);continue;}applyAction(s,a);if(a.type==='study')reserved+=due;}catch(e){reasons.push(e instanceof Error?e.message:'Invalid decision.');}}
 return {valid:reasons.length===0,reasons:[...new Set(reasons)],cost};
}
/** The same current workload drives allocation, warnings and the site inspector. */
export function continuingCare(s:State):Record<string,{required:number;capacity:number;delivered:number}>{
 return Object.fromEntries(s.facilities.filter(f=>running(f)&&clinicalSite(f)).map(f=>{
  const required=Math.ceil(s.cohorts.filter(c=>c.siteId===f.id).reduce((n,c)=>n+(c.followupRemaining>0?c.count*.25:f.delivery==='home'||f.delivery==='wearable'?c.alive*.1:0),0)+(f.id==='riverside'?s.historicalFollowup:0));
  const capacity=supportCapacity(f);return [f.id,{required,capacity,delivered:Math.min(required,capacity)}];
 }));
}
interface Allocation {starts:Record<string,number>;followup:Record<string,number>;trials:Record<string,number>;trialSites:Record<string,Record<string,number>>;continuity:Record<string,number>;limiting:Record<string,string>;flows:Record<string,number>;updates:string[];updateCost:number}
function allocate(s:State,startCaps?:Record<string,number>):Allocation{
 const starts:Record<string,number>={},followup:Record<string,number>={},trials:Record<string,number>={},trialSites:Record<string,Record<string,number>>={},continuity:Record<string,number>={},limiting:Record<string,string>={},flows:Record<string,number>={},updates:string[]=[];let updateCost=0;
 const supplies=new Map(s.facilities.filter(f=>f.status==='operating').map(f=>[f.id,Math.floor(f.capacity*(f.owner==='public'?Math.max(.5,1-s.world.rivals.reduce((n,r)=>n+r.share,0)*.25):1))]));
 const demand=new Map(s.regions.map(r=>[r.id,Math.max(0,Math.min(r.population-r.treated,r.waiting))]));
 const incoming=(f:Facility,kind:Link['kind'],p:Program)=>s.links.filter(l=>{if(!l.active||l.to!==f.id||l.kind!==kind)return false;const source=s.facilities.find(x=>x.id===l.from);return source?.status==='operating'&&!(kind==='medicine'&&source.owner==='public'&&p.id!=='standard-autoimmune'&&source.programId!==p.id&&!s.partnerships.includes('manufacturer'));});
 const available=(f:Facility,kind:Link['kind'],p:Program)=>kind==='medicine'&&f.delivery!=='clinic'?f.capacity:incoming(f,kind,p).reduce((n,l)=>n+Math.min(supplies.get(l.from)??0,l.capacity-(flows[l.id]??0)),0);
 function consume(f:Facility,kind:Link['kind'],amount:number,p:Program){if(kind==='medicine'&&f.delivery!=='clinic')return;let left=amount;for(const l of incoming(f,kind,p)){const use=Math.min(left,supplies.get(l.from)??0,Math.max(0,l.capacity-(flows[l.id]??0)));supplies.set(l.from,(supplies.get(l.from)??0)-use);flows[l.id]=(flows[l.id]??0)+use;left-=use;if(left<=0)break;}}
 const capacity=new Map<string,number>(),care=continuingCare(s);
 // Existing support is protected before studies or new starts anywhere in the network.
 for(const f of s.facilities.filter(f=>running(f)&&clinicalSite(f))){const {required,capacity:support}=care[f.id];followup[f.id]=Math.min(required,support);continuity[f.id]=required?followup[f.id]/required:1;capacity.set(f.id,Math.max(0,Math.floor(f.capacity-Math.max(0,required-support)/3)));}
 // Updating an existing personalized course requires real capacity and a paid product update.
 for(const f of s.facilities.filter(f=>running(f)&&clinicalSite(f))){const p=program(s,f.programId);if(p.kind!=='personalized'||s.policy.stage!=='personal'||!p.authorizedCandidate||continuity[f.id]<1)continue;for(const c of s.cohorts.filter(c=>c.siteId===f.id&&c.programId===p.id&&c.start<s.tick&&c.generation<p.authorizedGeneration&&(c.followupRemaining>0||f.delivery==='home'||f.delivery==='wearable'))){const count=Math.ceil(c.alive),cost=count*50000;if((capacity.get(f.id)??0)<count||available(f,'medicine',p)<count||available(f,'tests',p)<count||s.company.cash-updateCost<cost)continue;consume(f,'medicine',count,p);consume(f,'tests',count,p);capacity.set(f.id,capacity.get(f.id)!-count);updates.push(c.id);updateCost+=cost;}}
 // Trials consume the same medicine, tests, patient population and clinical appointments.
 for(const p of s.programs.filter(p=>p.study&&!p.study.paused&&p.study.preparation===0&&p.study.enrolled<p.study.target)){
  const st=p.study!;trialSites[p.id]={};trials[p.id]=0;
  const sites=s.facilities.filter(f=>running(f)&&f.trialTeam&&clinicalSite(f)&&(p.id!=='cell-repair'||f.kind==='hospital')&&(f.region===0||s.policy.recognized||s.policy.stage==='personal')).sort((a,b)=>Number(b.id===st.siteId)-Number(a.id===st.siteId)||a.id.localeCompare(b.id));
  for(const f of sites){if(!s.links.some(l=>l.active&&l.kind==='patients'&&l.to===f.id))continue;const wanted=Math.min(st.target-st.enrolled-trials[p.id],Math.max(24,Math.ceil(f.capacity*.5)),capacity.get(f.id)??0,demand.get(f.region)??0);const n=Math.max(0,Math.floor(Math.min(wanted,available(f,'medicine',p),available(f,'tests',p))));trialSites[p.id][f.id]=n;trials[p.id]+=n;consume(f,'medicine',n,p);consume(f,'tests',n,p);capacity.set(f.id,(capacity.get(f.id)??0)-n);demand.set(f.region,(demand.get(f.region)??0)-n);}
 }
 for(const f of s.facilities.filter(f=>running(f)&&clinicalSite(f))){const p=program(s,f.programId),cap=capacity.get(f.id)??0;
  if(!p.authorizedCandidate){starts[f.id]=0;limiting[f.id]='Treatment needs clinical authorization';continue;}
  if(f.region!==0&&!s.policy.recognized&&s.policy.stage!=='personal'){starts[f.id]=0;limiting[f.id]='Cross-region treatment permission';continue;}
  if(!s.links.some(l=>l.active&&l.to===f.id&&l.kind==='patients')){starts[f.id]=0;limiting[f.id]='Connect a community for patient access';continue;}
  const wanted=Math.min(cap,demand.get(f.region)??0),med=available(f,'medicine',p),tests=available(f,'tests',p);const n=Math.max(0,Math.floor(Math.min(wanted,med,tests,startCaps?.[f.id]??Infinity)));consume(f,'medicine',n,p);consume(f,'tests',n,p);starts[f.id]=n;demand.set(f.region,(demand.get(f.region)??0)-n);
  limiting[f.id]=n<wanted?(med<wanted?'Medicine supply: connect a compatible factory':'Testing capacity: connect or expand a lab'):wanted<cap?'Eligible patients with coverage':Object.values(trials).some(n=>n>0)?'Trial appointments share treatment capacity':'Treatment capacity';
 }
 for(const f of s.facilities.filter(f=>running(f)&&clinicalSite(f))){let count=(starts[f.id]??0)+Object.values(trialSites).reduce((n,sites)=>n+(sites[f.id]??0),0);for(const l of s.links.filter(l=>l.active&&l.to===f.id&&l.kind==='patients')){const use=Math.min(count,l.capacity);flows[l.id]=use;count-=use;}}
 return {starts,followup,trials,trialSites,continuity,limiting,flows,updates,updateCost};
}
function withFlows(s:State,a:Allocation):State{return {...s,links:s.links.map(l=>({...l,lastFlow:a.flows[l.id]??0}))};}
function careAccount(s:State,a:Allocation,starts=a.starts){const account=operatingAccount(withFlows(s,a),starts,a.followup,trialQuarterCost(s));account.supplies+=a.updateCost;account.costs+=a.updateCost;account.cashFlow-=a.updateCost;return account;}
function settleSiteAccounts(s:State,a:Allocation){
 const baseline=operatingAccount(s,{},{});
 for(const f of s.facilities){f.lastStarts=a.starts[f.id]??0;f.lastFollowup=a.followup[f.id]??0;f.limiting=a.limiting[f.id]??'';f.lastRevenue=0;f.lastCosts=0;if(!running(f))continue;
  const local=operatingAccount(s,{[f.id]:f.lastStarts},{[f.id]:f.lastFollowup});const rates=operatingRates(f);const fixed=clinicalSite(f)?f.employees*rates.staffQuarter+f.units*rates.siteQuarter:f.employees*3000000+f.units*(f.kind==='factory'?6000000:2500000);
  f.lastRevenue=local.revenue;f.lastCosts=cents(local.costs-baseline.costs+fixed+s.cohorts.filter(c=>c.siteId===f.id&&a.updates.includes(c.id)).reduce((n,c)=>n+Math.ceil(c.alive)*50000,0));
 }
}
export function projectOperations(s:State):Projection{
 const a=allocate(s),account=careAccount(s,a);return {starts:account.starts,revenue:account.revenue,costs:account.costs,cashFlow:account.cashFlow,employees:account.employees,partnerEmployees:account.partnerEmployees,limiting:[...new Set(Object.values(a.limiting))]};
}
/** Forecast known operations only. No future AI release, trial result or rescue financing. */
export function forecastOperations(state:State):import('./economy').NetworkForecastProjection[]{
 const s=copy(state),result:import('./economy').NetworkForecastProjection[]=[];
 const addPeople=(siteId:string,p:Program,count:number,trial=false)=>{if(count<=0)return;const f=facility(s,siteId),r=s.regions[f.region];const actual=Math.max(0,Math.min(count,r.population-r.treated));if(!actual)return;
  // Forecast customers after2050 inform economics only, never the healthspan ledger.
  s.cohorts.push({id:`forecast-${s.tick}-${s.cohorts.length}`,region:f.region,programId:p.id,siteId,count:actual,start:s.tick,generation:trial?p.candidate.generation:p.authorizedGeneration,candidate:copy(trial?p.candidate:p.authorizedCandidate!),experienced:0,remaining:0,alive:actual,age:populationAge(s.seed,f.region),continuity:1,followupQuarters:followupQuartersFor(p.id),followupRemaining:followupQuartersFor(p.id),delivery:f.delivery,baselineDelay:0});
  r.treated+=actual;r.waiting=Math.max(0,r.waiting-actual);
 };
 for(let q=0;q<20;q++){
  for(const p of s.projects.filter(p=>p.readyAt<=s.tick))finishProject(s,p);s.projects=s.projects.filter(p=>p.readyAt>s.tick);
  const a=allocate(s),research=trialQuarterCost(s),account=careAccount(s,a);
  const maintenance=state.projects.some(p=>p.kind==='staff')?{maintenanceBasis:cents(s.facilities.filter(f=>f.owner==='db'&&f.status==='operating').reduce((n,f)=>n+Math.max(0,f.basis-s.projects.filter(p=>p.siteId===f.id&&p.kind!=='staff').reduce((sum,p)=>sum+p.cost,0)),0))}:{};
  result.push({starts:account.starts,revenue:account.revenue,costs:account.costs,cashFlow:account.cashFlow,employees:account.employees,partnerEmployees:account.partnerEmployees,limiting:[...new Set(Object.values(a.limiting))],research,...maintenance});
  for(const p of s.programs){const st=p.study;if(!st||st.paused)continue;const paid=installment(p);st.spent=(st.spent??0)+paid;p.developmentSpend+=paid;
   if(st.preparation>0)st.preparation--;else if(st.enrolled<st.target){for(const [id,n] of Object.entries(a.trialSites[p.id]??{})){addPeople(id,p,n,true);st.enrolled+=n;}}else if(st.observed<st.observation)st.observed++;else if(--st.review<=0)p.study=null;
  }
  for(const [id,n] of Object.entries(a.starts))addPeople(id,program(s,facility(s,id).programId),n);
  for(const c of s.cohorts){if(a.updates.includes(c.id)){const p=program(s,c.programId);c.generation=p.authorizedGeneration;c.candidate=copy(p.authorizedCandidate!);}c.alive*=quarterSurvival(c.age+Math.max(0,s.tick-c.start)/4);c.followupRemaining=Math.max(0,c.followupRemaining-1);}
  s.company.cash+=account.cashFlow;s.historicalFollowup=Math.max(0,s.historicalFollowup-20);
  for(const r of s.regions){const units=s.facilities.filter(f=>f.region===r.id&&running(f)&&clinicalSite(f)).reduce((n,f)=>n+f.units,0);r.waiting=Math.max(0,Math.min(r.population-r.treated,r.waiting+Math.ceil(r.arrivals*Math.max(r.id===0?1:0,units))));}
  s.tick++;
 }
 return result;
}
function finishProject(s:State,p:State['projects'][number]){
 const f=facility(s,p.siteId);
 if(p.kind==='staff'){
  const before=supportCapacity(f),people=p.people??0;f.employees+=people;f.followupEmployees=(f.followupEmployees??0)+people;
  event(s,'build',`${p.name}: now operating`,`${people.toLocaleString()} follow-up staff hired. Supported follow-ups ${before.toLocaleString()} → ${supportCapacity(f).toLocaleString()} per quarter (+${(supportCapacity(f)-before).toLocaleString()}). Additional payroll ${exactCashText(people*operatingRates(f).staffQuarter)} per quarter; treatment capacity remains ${f.capacity.toLocaleString()}.`,true);return;
 }
 f.status='operating';f.readyAt=0;
 if(p.kind==='replicate')for(const source of s.facilities.filter(x=>['supply-','tests-','people-'].some(prefix=>x.id===prefix+f.id))){source.status='operating';source.readyAt=0;}
 if(p.kind==='expand'){f.capacity+=f.kind==='factory'?160:f.kind==='lab'?320:40;f.units+=f.kind==='factory'||f.kind==='lab'?1:.5;f.employees+=f.kind==='factory'?4:f.kind==='lab'?3:4;}
 if(p.kind==='trial'){f.trialTeam=true;f.employees+=2*Math.max(1,f.units);}
 if(['local','home','wearable'].includes(p.kind)){
  const old=f.delivery;const multipliers={clinic:1,local:2,home:4,wearable:8};f.delivery=p.kind as Facility['delivery'];f.capacity=Math.round(f.capacity*multipliers[f.delivery]/multipliers[old]);
  const followup=f.followupEmployees??0;f.employees=Math.max(f.units,Math.ceil((f.employees-followup)*(f.delivery==='local'?.9:.45)))+followup;
  for(const l of s.links.filter(l=>l.to===f.id&&l.kind==='medicine')){l.active=false;l.lastFlow=0;}
 }
 event(s,'build',`${p.name}: now operating`,`${f.capacity.toLocaleString()} starts or service units per quarter. ${p.kind==='local'||p.kind==='home'||p.kind==='wearable'?'Finished-medicine shipments are replaced by compatible inputs and local product checks.':'Connect missing services to use this capacity.'}`,true);
}
export function previewPlan(state:State,actions:Action[]):Preview{
 const v=validatePlan(state,actions),s=copy(state);if(v.valid)for(const a of actions)applyAction(s,a);
 const current=projectOperations(state),next=projectOperations(s),readyState=copy(s);for(const p of readyState.projects)finishProject(readyState,p);readyState.projects=[];
 const ready=projectOperations(readyState),trialCount=(state:State)=>Object.values(allocate(state).trials).reduce((n,v)=>n+v,0),newTrialAppointments=ready.starts<current.starts?trialCount(readyState)-trialCount(state):0;
 const explanation=ready.starts<current.starts?(newTrialAppointments>0?`Studies can enroll ${newTrialAppointments.toLocaleString()} more participants per quarter in the planned network. They use shared appointments, medicines and tests before new commercial care; displayed treatment starts can fall temporarily.`:`Fewer new starts are projected: ${ready.limiting.join('; ')}. Inspect the affected places before committing.`):`Now: ${cashText(current.revenue)} receipts / ${cashText(current.costs)} costs per quarter.`;
 return {...v,cashAfter:s.company.cash,current,next,ready,summary:[explanation,`When committed construction opens: up to ${ready.starts.toLocaleString()} starts and ${cashText(ready.cashFlow)} operating cash per quarter at today's demand and permissions.`,`Next constraint: ${ready.limiting.join('; ')}. No future study success or unreleased AI advance is assumed.`],dilution:Math.max(0,shareFraction(state.company.classes,'founders')-shareFraction(s.company.classes,'founders'))};
}
function advanceStudies(s:State,a:Allocation){
 for(const p of s.programs){const st=p.study;if(!st||st.paused)continue;
  const paid=installment(p);p.developmentSpend+=paid;st.spent=(st.spent??0)+paid;
  if(st.preparation>0){st.preparation--;continue;}
  if(st.enrolled<st.target){
   const n=a.trials[p.id]??0;
   for(const [siteId,count] of Object.entries(a.trialSites[p.id]??{})){if(count<=0)continue;const f=facility(s,siteId),c=makeCohort(s,f,{...p,authorizedCandidate:p.candidate,authorizedGeneration:p.candidate.generation},count);c.id+=`:trial:${p.id}`;s.cohorts.push(c);st.enrolled+=c.count;s.regions[f.region].treated+=c.count;s.regions[f.region].waiting=Math.max(0,s.regions[f.region].waiting-c.count);}
   p.lastResult=n>0?`${st.enrolled}/${st.target} participants enrolled across prepared trial sites. Observation begins after recruitment.`:'Recruitment is waiting for compatible medicine, testing or clinical appointments. Connect a therapy factory or reserve manufacturing supply.';continue;
  }
  if(st.observed<st.observation){st.observed++;continue;}
  if(st.review>0)st.review--;if(st.review>0)continue;
  const r=studyResult(p,st,s.seed);st.response=r.response;st.harm=r.harm;
  // Measured study harms revise the assessment of the same enrolled people once.
  // A failed readout must not leave its attributable harm at the optimistic design prior.
  for(const c of s.cohorts.filter(c=>c.programId===p.id&&c.id.includes(`:trial:${p.id}`)&&c.generation===st.generation&&c.start>=st.started)){
   c.experienced-=c.count*(r.harm-c.candidate.harm)*2.5;c.candidate={...c.candidate,response:r.response,harm:r.harm};
  }
  if(!r.passes){st.failed=true;st.paused=true;p.lastResult=r.detail;event(s,'clinical',`${p.name}: study failed`,r.detail,true);continue;}
  p.evidence=Math.min(1,p.evidence+r.evidence);p.candidate.response=r.response;p.candidate.harm=r.harm;p.stage=st.phase==='phase3'?'approved':st.phase;p.study=null;
  if(p.stage==='approved'){p.authorizedCandidate=copy(p.candidate);p.authorizedGeneration=p.candidate.generation;}
  p.lastResult=r.detail;event(s,'clinical',`${p.name}: ${st.phase} readout`,`${r.detail} ${p.stage==='approved'?'This candidate is now authorized.':'Choose whether to advance, improve the candidate or wait.'}`,true);
 }
}
function worldAndPolicy(s:State){
 const old=s.world;s.world=worldAt(s.tick,s.scenario,s.seed);
 if(s.world.generation!==old.generation){for(const p of s.programs)p.frontier=candidateFor(p.id,s.world.generation);event(s,'world','AI opens a stronger generation of medicines',`Generation ${s.world.generation} improves predicted response, durability and benefit for new fixed and personalized candidates. Existing authorized fixed products retain their original performance.`,true);}
 if(s.policy.pendingStage&&s.tick>=s.policy.effectiveAt){s.policy.stage=s.policy.pendingStage;s.policy.pendingStage=null;s.policy.support*=.4;event(s,'policy',s.policy.stage==='platform'?'Evidence-based treatment platform accepted':'Personal AGI authorization begins',s.policy.stage==='platform'?'After Phase 2 evidence, selected registration observation can be replaced by accepted predictive evidence. Clinic-based manufacturing becomes possible.':'Personalized updates can use the accepted platform; home manufacturing and immune wearables remain subject to equipment and product scope.',true);
  for(const p of s.programs){const st=p.study;if(!st||st.failed)continue;const spec=studySpec({...p,stage:st.phase==='phase1'?'preclinical':st.phase==='phase2'?'phase1':'phase2'},s.world,s.policy,st.package);if(spec.cost>=st.cost)continue;
   const released=st.cost-Math.max(st.spent??0,spec.cost);st.target=Math.max(st.enrolled,Math.min(st.target,spec.target));st.observation=Math.max(st.observed,Math.min(st.observation,spec.observation));st.preparation=Math.min(st.preparation,spec.preparation);st.review=Math.min(st.review,spec.review);st.cost=Math.max(st.spent??0,spec.cost);
   event(s,'clinical',`${p.name}: accepted evidence shortens the route`,`${st.enrolled} enrolled participants and collected evidence retained. New requirement: ${st.target} people, ${st.observation} observation quarters. ${cashText(released)} of unspent study commitments released; participant follow-up continues.`,true);
  }
 }
 if(s.tick>=s.policy.nextWindow){
  const evidence=Math.max(...s.programs.filter(p=>p.id!=='standard-autoimmune').map(p=>p.evidence));const threshold=s.policy.stage==='product'?.42:.6;
  const ready=s.world.generation>=(s.policy.stage==='product'?2:4)&&evidence>=(s.policy.stage==='product'?.2:.45);
  if(ready&&s.policy.support>=threshold&&s.policy.stage!=='personal'&&!s.policy.pendingStage){s.policy.pendingStage=s.policy.stage==='product'?'platform':'personal';s.policy.effectiveAt=s.tick+2;event(s,'policy','Reform passed; implementation begins','The rules change in two quarters. Prepare the equipment and care network now.',true);}
  else event(s,'policy','A policy window closes',`Support ${Math.round(s.policy.support*100)}%; ${ready?'the coalition needs broader support.':'observed clinical evidence and technical readiness are still needed.'} Next window in eight quarters.`,true);
  s.policy.nextWindow=s.tick+8;
 }
 s.policy.support=Math.min(.99,s.policy.support+.003);if(s.policy.window>0)s.policy.window--;
}
export function commitPlan(state:State,actions:Action[]=[]):State{
 const v=validatePlan(state,actions);if(!v.valid)throw Error(v.reasons.join(' '));const s=copy(state),oldHealth=s.health.expected;
 for(const a of actions)applyAction(s,a);
 if(s.company.strategicControl||s.company.founderSeats<2||!s.company.ceo){s.status='control-loss';s.company.control='lost';event(s,'warning','Company control lost','The financing transferred strategic authority. Delivery and new healthspan stop before the next operating quarter.',true);s.commands.push({tick:s.tick,actions:copy(actions),checksum:''});s.commands.at(-1)!.checksum=checksum(s);return s;}
 worldAndPolicy(s);
 const completed=s.projects.filter(p=>p.readyAt<=s.tick);for(const p of completed)finishProject(s,p);s.projects=s.projects.filter(p=>p.readyAt>s.tick);
 let a=allocate(s);for(const l of s.links)l.lastFlow=a.flows[l.id]??0;const account=careAccount(s,a);
 // Care is scaled to available operating cash; continuing support and fixed obligations precede new starts.
 if(account.costs>s.company.cash+account.revenue){const fixed=careAccount(s,a,{}),newCareCash=account.cashFlow-fixed.cashFlow;if(newCareCash<0){const fraction=Math.min(1,Math.max(0,s.company.cash+fixed.cashFlow)/-newCareCash);a=allocate(s,Object.fromEntries(Object.entries(a.starts).map(([id,n])=>[id,Math.floor(n*fraction)])));for(const l of s.links)l.lastFlow=a.flows[l.id]??0;}}
 const actual=careAccount(s,a);
 settleSiteAccounts(s,a);
 for(const l of s.links)l.lastFlow=a.flows[l.id]??0;
 advanceStudies(s,a);
 for(const f of s.facilities.filter(f=>running(f)&&clinicalSite(f))){const count=a.starts[f.id]??0,p=program(s,f.programId);if(count>0){const c=makeCohort(s,f,p,count);s.cohorts.push(c);s.regions[f.region].treated+=c.count;s.regions[f.region].waiting=Math.max(0,s.regions[f.region].waiting-c.count);p.starts+=c.count;}
  for(const c of s.cohorts.filter(c=>c.siteId===f.id&&a.updates.includes(c.id))){c.experienced-=c.alive*p.authorizedCandidate!.harm*2.5;c.candidate=copy(p.authorizedCandidate!);c.generation=p.authorizedGeneration;}
 }
 const h=advanceHealth(s,a.continuity);s.cohorts=h.cohorts;s.health=h.health;
 s.company.cash+=actual.cashFlow;s.company.lastRevenue=actual.revenue;s.company.lastExpenses=actual.costs;s.company.revenue=actual.revenue;s.company.expenses=actual.costs;s.company.totalRevenue+=actual.revenue;s.company.totalSpend+=actual.costs;
 actual.healthAdded=s.health.expected-oldHealth;s.account=actual;s.accounts.push(actual);s.historicalFollowup=Math.max(0,s.historicalFollowup-20);
 event(s,'care',`${actual.starts.toLocaleString()} people began care`,`${cashText(actual.revenue)} service revenue; ${cashText(actual.costs)} operating costs. Expected additional healthspan ${Math.round(actual.healthAdded).toLocaleString()} years this quarter, including revised future benefit.`);
 if(s.company.cash<0){if(s.cureUntil===null){s.cureUntil=s.tick+1;event(s,'warning','Emergency funding window','Cash is exhausted. Raise capital or sell an owned asset before the next quarter; existing care commitments remain.',true);}else if(s.tick>=s.cureUntil){s.status='insolvent';for(const c of s.cohorts)c.continuity*=.55;s.health=scoreCohorts({...s,tick:s.tick+1});}}
 else s.cureUntil=null;
 for(const r of s.regions){const units=s.facilities.filter(f=>f.region===r.id&&running(f)&&clinicalSite(f)).reduce((n,f)=>n+f.units,0);r.waiting=Math.min(r.population-r.treated,r.waiting+Math.ceil(r.arrivals*Math.max(r.id===0?1:0,units)));}
 s.tick++;
 if(s.tick<96&&s.status==='active'){for(const p of s.projects.filter(p=>p.readyAt<=s.tick))finishProject(s,p);s.projects=s.projects.filter(p=>p.readyAt>s.tick);}
 if(s.tick>=96&&s.status==='active')s.status=s.health.expected>=1e9?'victory':'partial';
 s.commands.push({tick:state.tick,actions:copy(actions),checksum:''});s.commands.at(-1)!.checksum=checksum(s);return s;
}
export const advanceQuarter=(s:State)=>commitPlan(s,[]);
export function checksum(s:State):string{return semanticChecksum({...s,commands:s.commands.map(({checksum,...c})=>c)});}
export function options(s:State):Option[]{
 const out:Option[]=[];const add=(label:string,detail:string,action:Action,duration:number,effect:string,category:Option['category'])=>{let reason:string|null;let cost=0;try{reason=actionReason(s,action);cost=quoteCost(s,action);}catch(e){reason=String(e);}out.push({id:JSON.stringify(action),label,detail,action,cost,duration,effect,category,available:!reason,reason:reason??'Available'});};
 const care=continuingCare(s);
 for(const f of s.facilities){
  if(running(f)&&clinicalSite(f)){
   const {required,capacity}=care[f.id],buffered=Math.max(1,Math.ceil((required*1.25-capacity)/60)),essential=Math.ceil((required-capacity)/60);
   const hire=(people:number,essentialOnly:boolean)=>{
    const supported=supportCapacity({...f,employees:f.employees+people,followupEmployees:(f.followupEmployees??0)+people});
    const packageName=essentialOnly?' · essential coverage':required*1.25>capacity?' · 25% buffer':'';
    add(`Hire ${people.toLocaleString()} follow-up staff at ${f.name}${packageName}`,`${exactCashText(STAFF_RECRUITMENT)} recruitment per person; ${exactCashText(people*STAFF_RECRUITMENT)} paid upfront. Hiring takes 1 quarter and can proceed alongside construction. ${essentialOnly?'Covers today’s follow-up shortfall at the lowest recruitment and payroll cost; future demand may require more staff.':required*1.25>capacity?'Covers today’s follow-up needs with at least 25% spare support.':'Adds 60 supported follow-ups per quarter.'}`,{type:'staff',siteId:f.id,people},1,`Supported follow-ups ${capacity.toLocaleString()} → ${supported.toLocaleString()} per quarter (+${(supported-capacity).toLocaleString()}); ${required.toLocaleString()} currently needed. Additional payroll ${exactCashText(people*operatingRates(f).staffQuarter)} per quarter. Treatment capacity remains ${f.capacity.toLocaleString()} starts per quarter; hiring itself adds no healthspan.`,'network');
   };
   if(essential>0&&essential<buffered)hire(essential,true);
   hire(buffered,false);
  }
  if(f.owner==='db'&&running(f))add(`Expand ${f.name}`,'Add equipment and the staff to operate it.',{type:'expand',siteId:f.id},2,clinicalSite(f)?'+40 new starts per quarter; follow-up and staff costs also grow.':`More ${f.kind==='factory'?'manufactured therapies':'sample tests'} shared by connected sites.`,'network');
  if(f.owner==='available'&&clinicalSite(f))add(`Partner with ${f.name}`,'Use an existing care team. The provider retains its clinical revenue; DB earns service fees.',{type:'partner',siteId:f.id},1,'80 additional starts/quarter after connecting patient access, tests and medicines.','network');
  if(f.owner==='available')for(const kind of ['factory','lab','clinic','hospital'] as const)add(`Build ${kind==='factory'?'a therapy factory':kind==='lab'?'a testing lab':`a ${kind}`} at ${f.name}`,'An owned site needs equipment, staff and preparation before it can operate.',{type:'build',siteId:f.id,kind},3,'The building gains a concrete role; connect the services it needs.','network');
  if(clinicalSite(f)&&(f.owner!=='available'||hasProject(s,f.id))){
   for(const source of s.facilities.filter(source=>source.id!==f.id&&['factory','lab','community'].includes(source.kind)&&(source.kind!=='community'||source.region===f.region)&&(source.kind!=='factory'||f.delivery==='clinic')&&(source.owner!=='available'||hasProject(s,source.id)))){const kind:Link['kind']=source.kind==='factory'?'medicine':source.kind==='lab'?'tests':'patients';if(!s.links.some(l=>l.active&&l.from===source.id&&l.to===f.id&&l.kind===kind))add(`Connect ${source.name}` ,`Supply ${kind} to ${f.name}${source.region!==f.region?` from ${s.regions[source.region].name}`:''}. Shared capacity is divided among all connected services.`,{type:'connect',from:source.id,to:f.id,kind},0,`Removes a missing ${kind} connection when capacity is available.`,'network');}
   if(!f.trialTeam)add(`Add trial team at ${f.name}`,`Prepare study procedures and medicine handling, adding ${(2*Math.max(1,f.units)).toLocaleString()} research staff. Setup cost scales with the network’s size. Trials share treatment and test capacity.`,{type:'trial-team',siteId:f.id},1,'Joins the trial network. Prepared sites share enrollment; trials use up to half of each site’s appointments before new care.','clinical');
   for(const p of s.programs.filter(p=>p.availableAt<=s.tick&&p.authorizedCandidate&&p.id!==f.programId))add(`Offer ${p.name} at ${f.name}`,p.description,{type:'treatment',siteId:f.id,programId:p.id},0,'Future starts use the authorized therapy; existing people keep their care history.','network');
   for(const delivery of ['local','home','wearable'] as const)if(f.delivery!==delivery)add(`Install ${delivery==='local'?'clinic therapy maker':delivery==='home'?'home therapy systems':'Aspis immune wearables'}`,`${delivery==='local'?'Makes selected therapies at the clinic.':delivery==='home'?'Makes selected therapies in homes.':'Makes selected adaptive immune therapies while worn.'} The displayed total equips the entire selected service and scales with its installed size.`,{type:'upgrade',siteId:f.id,delivery},delivery==='wearable'?4:2,`Capacity ${f.capacity.toLocaleString()} → ${Math.round(f.capacity*({local:2,home:4,wearable:8})[delivery]/({clinic:1,local:2,home:4,wearable:8})[f.delivery]).toLocaleString()} per quarter. Clinical staffing adapts after installation. Finished-medicine shipping is replaced for compatible products; testing, inputs, permission and follow-up still limit actual care.`,'network');
   if(f.owner==='db')add(`Sell ${f.name}`,'Sell to a provider with a continuing-care handoff. DB retains a service agreement.',{type:'sell',siteId:f.id},0,`${cashText(f.basis*.65)} cash; future service margin and staffing change.`,'finance');
   if(f.lastStarts>0)for(const region of s.regions)for(const units of [2,10,100,1000,10000])if(region.id!==f.region||units===2)add(`Replicate ${units.toLocaleString()} sites in ${region.name}`,'Fund provider onboarding, reserved site capacity and the blueprint’s production equipment at every site, with a scheduled ramp.',{type:'replicate',siteId:f.id,region:region.id,units},4,`${Math.round(f.capacity/Math.max(1,f.units)*units).toLocaleString()} quarterly treatment capacity, plus contracted tests and supply; real demand still constrains starts.`,'network');
  }
 }
 for(const p of s.programs.filter(p=>p.availableAt<=s.tick)){
  if(p.frontier.generation>p.candidate.generation)add(`Adopt better design for ${p.name}`,adoptionRoute(s,p).detail,{type:'adopt',programId:p.id},0,`Design ${p.candidate.generation} → ${p.frontier.generation}; no healthspan until care is actually delivered.`,'clinical');
  if(!p.study&&!(p.stage==='approved'&&p.authorizedGeneration===p.candidate.generation))for(const f of s.facilities.filter(f=>running(f)&&f.trialTeam))for(const pkg of ['focused','broad'] as const){const spec=studySpec(p,s.world,s.policy,pkg),planned:State={...s,programs:s.programs.map(x=>x.id===p.id?{...x,study:{...spec,siteId:f.id,generation:p.candidate.generation,package:pkg,started:s.tick,preparation:0,enrolled:0,observed:0,paused:false,failed:false,response:null,harm:null}}:x)};const enrollment=allocate(planned).trials[p.id]??0;const duration=enrollment>0?spec.preparation+Math.ceil(spec.target/enrollment)+spec.observation+spec.review:0;add(`Start ${spec.phase.replace('phase','Phase ')} · ${p.name} · ${pkg}`,`${f.name} leads the prepared trial network: ${spec.target} participants. ${pkg==='focused'?'Narrower question, lower cost.':'Broader evidence, more participants and cost.'} ${spec.observation} observation quarters cannot be erased by faster recruitment.`,{type:'study',programId:p.id,siteId:f.id,package:pkg},duration,`${cashText(spec.cost)} total budget. ${enrollment>0?`About ${duration} quarters with ${enrollment} enrollments/quarter at today's shared capacity; later demand or competing work can change this.`:'RECRUITMENT BLOCKED: secure compatible medicine, tests and patient access before enrollment. Preparation may start now, but completion has no date.'} All prepared trial sites can help enroll. Faster recruitment cannot erase observation.`,'clinical');}
  if(p.study){add(`${p.study.paused?'Resume':'Pause'} ${p.name}`,'Participant follow-up continues while new study work pauses.',{type:'pause',programId:p.id},0,'Changes future research spending and enrollment.','clinical');add(`Stop study · ${p.name}`,'Release unused reservations; preserve participant care and compatible evidence.',{type:'stop',programId:p.id},0,'No refund for completed work.','clinical');}
 }
 for(const proposal of ['evidence','personal','recognition'] as const)add(proposal==='evidence'?'Support predictive-evidence approval':proposal==='personal'?'Support personal AGI authorization':'Negotiate cross-region recognition',proposal==='evidence'?'Seek acceptance of predictive evidence for supported treatment platforms.':proposal==='personal'?'Let personal AGI regulators authorize customized treatments within accepted platforms.':'Let this operating platform serve other jurisdictions.',{type:'policy',proposal,budget:50000000},0,'Changes acceptance and access, not the biological efficacy of a candidate.','policy');
 for(const kind of ['frontier','manufacturer','payer'] as const)add(kind==='frontier'?'Partner with a frontier lab':kind==='manufacturer'?'Reserve manufacturing supply':'Sign a population service mandate',kind==='frontier'?'$2m restricted design credits; 4% service royalty.':kind==='manufacturer'?'Reserve study and commercial production for the supported therapy families; triple external factory capacity.':'More covered people; 10% lower receipts per treatment.',{type:'partnership',kind},0,'Contract terms change costs, rights or reach.','finance');
 add('Prepare an IPO','Raise primary capital on public markets while retaining founder voting control.',{type:'ipo'},0,'Financing changes ownership; it does not cash out the illustrative investor.','finance');
 return out;
}
export function getView(s:State):View{
 const projection=projectOperations(s);const value=forecastNetwork(s,projection,forecastOperations(s));const waiting=s.regions.reduce((n,r)=>n+r.waiting,0);const allocation=allocate(s),care=continuingCare(s);
 const siteLimiters={...allocation.limiting};for(const f of s.facilities){if(care[f.id]?.delivered<care[f.id]?.required)siteLimiters[f.id]=`Continuing care: ${care[f.id].required.toLocaleString()} visits needed; ${care[f.id].delivered.toLocaleString()} supported. Expand the clinical team.`;else if(siteLimiters[f.id]==='Trial appointments share treatment capacity'&&!Object.values(allocation.trialSites).some(sites=>(sites[f.id]??0)>0))siteLimiters[f.id]='Treatment capacity';}
 return {state:s,options:options(s),projection,value,fundraise:fundraiseQuote(s),date:dateAt(s.tick),siteLimiters,continuingCare:care,headline:s.status!=='active'?s.status==='victory'?'One billion additional healthy years.':s.status==='control-loss'?'The company changed hands.':s.status==='insolvent'?'The network ran out of funding.':'2050: the network you built.':`${waiting.toLocaleString()} people waiting · ${projection.starts.toLocaleString()} can start this quarter`,guidance:s.tick===0?'Start with Riverside Clinic: expand treatment capacity, or connect a hospital partner.':s.cureUntil!==null?'Cash is exhausted. Raise capital or sell an owned asset before advancing.':projection.cashFlow<0&&s.company.cash<-projection.cashFlow*4?'Less than one year of operating runway. Compare financing, care revenue and asset sales.':s.events.filter(e=>e.major).at(-1)?.detail??'Select a site to see what it does, what it needs and what changes if you invest.'};
}
