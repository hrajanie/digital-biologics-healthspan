import type {Action, Option, Preview, ProductId, Projection, State, Study, View} from './types';
import {FLOW_VERSION} from './types';
import {initialCompany, quoteCompany, raiseCompany, operatingAccount, valueCompany, COSTS} from './economy';
import {advanceHealth, candidateFor, initialProducts, makeCareLot, reconcileTrialEvidence, releaseMonths, scoreCohorts, studyResult, worldAt} from './science';
const usd=(n:number)=>Math.round(n*100);
const clone=<T>(v:T):T=>structuredClone(v);
const active=(x:Study)=>!['passed','failed','stopped'].includes(x.stage);
const product=(s:State,id:ProductId)=>s.products.find(p=>p.id===id)!;
const studies=(s:State)=>s.products.flatMap(p=>p.studies).filter(active).sort((a,b)=>a.started-b.started||a.id.localeCompare(b.id));
const reserved=(s:State)=>studies(s).reduce((n,x)=>n+x.dbBudget-x.paid,0);
const money=(n:number)=>`$${(n/100/1e6).toFixed(2)}M`;
function emit(s:State,kind:State['events'][number]['kind'],title:string,detail:string,consequence:string,action:string,major=true,node?:State['events'][number]['node']){
 s.events.push({id:`event-${s.month}-${s.events.length}`,month:s.month,kind,title,detail,consequence,action,major,node});
}
export function createCampaign(scenario:State['scenario']='fast',seed=2027):State{
 if(!Number.isSafeInteger(seed))throw new Error('Campaign seed must be an integer.');
 return{version:FLOW_VERSION,seed,scenario,month:0,status:'active',company:initialCompany(),population:{total:12000,unassessed:11400,ineligible:100,waiting:320,baselineCare:180,nextPerson:180,pendingTests:[]},cohorts:[],products:initialProducts(),network:{licensed:false,supply:100,clinic:120,tests:200,followupEmployees:6,trialTeam:false},projects:[],world:worldAt(0,scenario),policy:{funded:false,accepted:false},labDeal:false,creditsUsed:0,events:[{id:'opening',month:0,kind:'world',title:'A medicine exists. The delivery route does not.',detail:'320 eligible people are waiting. License an authorized partner biologic to connect 100 released doses/month to your clinic.',consequence:'The corporate platform starts with $5M cash and an illustrative $250M pre-money premise. A financing price is not cash.',action:'Raise a round and license the partner treatment.',major:true,node:'factory'}],accounts:[],commands:[],health:{expected:0,experienced:0,remaining:0,people:0,tailError:0},lastStop:'opening',firstDeliveryReported:false,capacityNotice:'',roundMonth:null};
}
/** Conservative staffing envelope, not a promise of uptake. Keep today's other inputs fixed,
 * reserve the remaining enrollment of already funded studies, and sustain today's eligible
 * commercial start ceiling through six months of follow-up. Existing lots expire on their
 * actual clocks. No unapproved medicine, new territory, future AI or future financing enters. */
function followupStaffing(s:State):{required:number;hires:number}{
 const futureTrial=studies(s).reduce((n,t)=>n+Math.max(0,t.target-t.enrolled),0);
 const potential=s.population.waiting+s.population.pendingTests.reduce((n,p)=>n+p.eligible,0)+Math.floor(s.population.unassessed*.75);
 let remaining=Math.max(0,potential-futureTrial);
 // Ignore only the follow-up bottleneck. Do not invent a license, doses, tests or appointments.
 const rate=s.network.licensed?Math.max(0,Math.min(s.network.clinic,s.network.tests,s.network.supply,s.population.waiting)):0;
 const futureCommercial:{at:number;count:number}[]=[];
 let peak=s.population.baselineCare;
 for(let month=0;month<18;month++){
  const count=Math.min(rate,remaining);remaining-=count;futureCommercial.push({at:month,count});
  const existing=s.cohorts.filter(c=>s.month+month-c.startMonth<c.followupMonths).reduce((n,c)=>n+c.count,0);
  const commercial=futureCommercial.filter(c=>month-c.at<6).reduce((n,c)=>n+c.count,0);
  // Reserve these funded participants together for a conservative upper bound; actual recruitment
  // and its shared resource use are still resolved by the ordinary monthly allocator.
  const trial=month<12?Math.min(futureTrial,potential):0;
  peak=Math.max(peak,s.population.baselineCare+existing+commercial+trial);
 }
 const committed=s.projects.filter(p=>p.kind==='staff').reduce((n,p)=>n+p.quantity,0);
 return{required:peak,hires:Math.max(0,Math.ceil(peak/60)-s.network.followupEmployees-committed)};
}
/** One physical ledger. Existing follow-up first, enrolled studies next, then new commercial care. */
export function projectMonth(s:State):Projection{
 const supported=s.network.followupEmployees*60,staffing=followupStaffing(s);
 const continuing=s.population.baselineCare+s.cohorts.filter(c=>s.month-c.startMonth<c.followupMonths).reduce((n,c)=>n+c.count,0);
 let appointments=s.network.clinic,testsLeft=s.network.tests,doses=s.network.supply,room=Math.max(0,supported-continuing),trialStarts=0,sponsoredTrialStarts=0;
 for(const study of studies(s).filter(x=>x.stage==='recruitment')){
  const n=Math.max(0,Math.min(20,study.target-study.enrolled,appointments,testsLeft,doses,room,s.population.waiting-trialStarts));
  appointments-=n;testsLeft-=n;doses-=n;room-=n;trialStarts+=n;if(study.mode==='sponsored')sponsoredTrialStarts+=n;
 }
 const starts=s.network.licensed?Math.max(0,Math.min(appointments,testsLeft,doses,room,s.population.waiting-trialStarts)):0;
 appointments-=starts;testsLeft-=starts;doses-=starts;
 const screening=Math.max(0,Math.min(testsLeft,s.population.unassessed));
 const followupRequired=continuing+trialStarts+starts;
 const sponsorObservation=followupRequired<=supported?studies(s).filter(x=>x.mode==='sponsored'&&x.stage==='observation'&&x.observed<x.observationMonths).reduce((n,x)=>n+x.enrolled,0):0;
 const commercialNeed=s.population.baselineCare+s.cohorts.filter(c=>c.trialId===null&&s.month-c.startMonth<c.followupMonths).reduce((n,c)=>n+c.count,0)+starts;
 const commercialFollowups=Math.floor(commercialNeed*Math.min(1,supported/Math.max(1,followupRequired)));
 const resourceLimits:[Projection['limiter'],number,string][]=[['factory',s.network.licensed?s.network.supply:0,s.network.licensed?'Released medicine doses are the limiting input.':'License the partner medicine before its factory may supply your clinic.'],['clinic',s.network.clinic,'Treatment appointments are the limiting input.'],['lab',s.network.tests,'Patient safety tests are the limiting input.'],['followup',Math.max(0,supported-continuing),'The clinic needs more follow-up staff before accepting additional people.'],['people',s.population.waiting,'The ready-to-treat queue is limiting; eligibility tests return next month.']];
 resourceLimits.sort((a,b)=>a[1]-b[1]);
 const [limiter,,reason]=resourceLimits[0];
 const projection:Projection={sustainedFollowupRequired:staffing.required,recommendedFollowupHires:staffing.hires,eligibilityTests:screening,safetyTests:starts+trialStarts,commercialFollowups,starts,trialStarts,tests:screening+trialStarts+starts,testResults:s.population.pendingTests.filter(p=>p.readyAt<=s.month+1).reduce((n,p)=>n+p.eligible,0),medicine:starts+trialStarts,followupRequired,followupCapacity:supported,followupDelivered:Math.min(followupRequired,supported),clinicUsed:starts+trialStarts,clinicCapacity:s.network.clinic,testingCapacity:s.network.tests,supplyCapacity:s.network.supply,limiter,reason,receipts:0,costs:0,cashFlow:0,payroll:0,corporate:0,research:0,employees:Math.ceil(s.network.clinic/120)*10+s.network.followupEmployees+(s.network.trialTeam?4:0),partnerEmployees:8,sponsoredTrialStarts,sponsoredObservation:sponsorObservation};
 const a=operatingAccount(s,projection);
 return{...projection,receipts:a.receipts,costs:a.costs,cashFlow:a.cashFlow,payroll:a.payroll,corporate:a.corporate,research:a.research};
}
function actionCost(s:State,a:Action):number{
 switch(a.type){
 case'raise':return 0;
 case'license':return COSTS.license;
 case'expand':return COSTS[a.resource];
 case'hire':return COSTS.staff*a.people;
 case'trial-team':return COSTS.trialTeam;
 case'start-study':return Math.ceil((a.mode==='own'?COSTS.ownedStudy:a.mode==='codevelop'?COSTS.codevelopStudy:COSTS.sponsoredStudy)/11);
 case'update':return COSTS.design-Math.min(s.company.credits,usd(.75e6));
 case'validate-model':return COSTS.validation-Math.min(s.company.credits,usd(.5e6));
 case'lab-partnership':return COSTS.labPartnership;
 case'policy':return COSTS.policy;
 }
}
function problems(s:State,a:Action):string[]{
 if(s.status!=='active')return['The short slice has ended. Start another strategy to compare.'];
 switch(a.type){
 case'raise':{
  const q=quoteCompany(s,projectMonth(s)),min=s.month===0&&s.company.rounds.length===0?usd(25e6):usd(5e6);
  return!Number.isSafeInteger(a.amount)||a.amount<min||a.amount>q.maxRaise?[`Raise ${money(min)}–${money(q.maxRaise)} within this offer.`]:s.roundMonth===s.month?['This month’s financing offer has already closed.']:[];
 }
 case'license':return s.network.licensed||s.projects.some(p=>p.kind==='license')?['Partner delivery rights are already licensed or commissioning.']:[];
 case'expand':return['clinic','tests','supply'].includes(a.resource)?[]:['Unknown resource.'];
 case'hire':return!Number.isInteger(a.people)||a.people<1||a.people>100?['Choose 1–100 follow-up staff per hiring package.']:[];
 case'trial-team':return s.network.trialTeam||s.projects.some(p=>p.kind==='trial-team')?['A trial team is already ready or recruiting.']:[];
 case'lab-partnership':return s.labDeal?['The design-credit partnership is already signed.']:[];
 case'policy':return s.policy.funded?['The platform evidence program is already funded.']:[];
 case'start-study':{
  if(!['own','codevelop','sponsored'].includes(a.mode))return['Choose an owned, co-development or sponsored Phase 1.'];
  const p=product(s,a.productId);
  if(!p)return['Unknown treatment.'];
  if(p.id!=='immune-reset')return[p.id==='cancer-vaccine'?'This opening slice contains an autoimmune population. Cancer development needs a separate oncology population in the next build.':'This partner product is already authorized; DB has delivery rights, not a new sponsor study.'];
  if(!s.network.trialTeam)return['Recruit a trial team first (one month).'];
  if(p.studies.some(t=>t.generation===p.candidate.generation))return['This candidate already has a study. Preserve it or commission a newer candidate.'];
  if(studies(s).length>=2)return['Both trial-team study slots are committed. Finish a study before adding another.'];
  return[];
 }
 case'update':{
  if(!['replace','parallel'].includes(a.choice))return['Explicitly keep or replace the existing study.'];
  const p=product(s,a.productId);
  return!p?['Unknown treatment.']:s.world.generation<=p.candidate.generation?['No stronger AI candidate is available yet.']:s.projects.some(x=>x.kind==='design'&&x.productId===p.id)?['This candidate-design project is already running.']:[];
 }
 case'validate-model':{
  const p=product(s,a.productId);
  return!p?['Unknown treatment.']:s.world.generation<1?['The first stronger biology model must arrive before validation.']:p.validation>=s.world.generation||s.projects.some(x=>x.kind==='validation'&&x.productId===p.id)?['This model is already validated or being evaluated.']:[];
 }
 }
}
const rank:Record<Action['type'],number>={raise:0,'lab-partnership':1,license:2,expand:3,hire:4,'trial-team':5,'start-study':6,update:7,'validate-model':8,policy:9};
const ordered=(actions:Action[])=>[...actions].sort((a,b)=>rank[a.type]-rank[b.type]||JSON.stringify(a).localeCompare(JSON.stringify(b)));
function applyAction(s:State,a:Action,preMoney:number){
 const cost=actionCost(s,a);
 if(a.type==='raise'){
  s.company=raiseCompany(s,a.amount,preMoney);s.roundMonth=s.month;
  emit(s,'finance','The round closes',`${money(a.amount)} raised at ${money(preMoney)} pre-money.`,`${money(s.company.cash)} cash is now available. Founder governance remains protected.`,'Fund a complete route and the next evidence milestone.');return;
 }
 s.company.cash-=cost;
 if(a.type==='expand'||a.type==='trial-team')s.company.capex+=cost;else s.company.totalSpend+=cost;
 const add=(kind:State['projects'][number]['kind'],name:string,quantity=1,months=1,extra:Partial<State['projects'][number]>={})=>s.projects.push({id:`project-${s.month}-${s.projects.length}-${s.commands.length}`,kind,name,readyAt:s.month+months,cost,quantity,...extra});
 switch(a.type){
 case'license':add('license','Partner biologic delivery rights');break;
 case'expand':add(a.resource,a.resource==='clinic'?'120 additional treatment appointments':a.resource==='tests'?'100 additional eligibility/safety tests':'100 additional released medicine doses',a.resource==='clinic'?120:100,a.resource==='clinic'?2:1);break;
 case'hire':add('staff',`${a.people} follow-up staff`,a.people);break;
 case'trial-team':add('trial-team','Dedicated clinical trial team');break;
 case'start-study':{
  const p=product(s,a.productId),dbBudget=usd(a.mode==='own'?12e6:a.mode==='codevelop'?3e6:.5e6);
  p.rights=a.mode==='own'?'owned':a.mode==='codevelop'?'shared':'sponsor-service';
  p.studies.push({id:`study-${p.id}-v${p.candidate.generation}`,productId:p.id,generation:p.candidate.generation,mode:a.mode,started:s.month,stage:'preparation',preparationLeft:2,target:40,enrolled:0,observationMonths:6,observed:0,analysisLeft:1,totalBudget:usd(12e6),dbBudget,paid:cost,installments:11,response:null,harm:null,candidate:{...p.candidate}});
  emit(s,'clinical',`${p.name} Phase 1 funded`,`${a.mode==='own'?'DB owns the asset':a.mode==='codevelop'?'DB shares asset rights; partner funds 75%':'DB provides trial services; sponsor owns the asset'}. Total sponsor package $12M; DB commitment ${money(dbBudget)}; ${money(cost)} paid now.`,`${money(dbBudget-cost)} reserved in future installments. Two preparation months, enrollment, six observation months, then analysis.`,'Keep this study running, or explicitly compare a replacement when a better design arrives.',true,'clinic');break;
 }
 case'update':{
  const credits=Math.min(s.company.credits,usd(.75e6));s.company.credits-=credits;s.creditsUsed+=credits;
  add('design',`${product(s,a.productId).name} v${s.world.generation} design`,1,1,{productId:a.productId,generation:s.world.generation,choice:a.choice,credits});break;
 }
 case'validate-model':{
  const credits=Math.min(s.company.credits,usd(.5e6));s.company.credits-=credits;s.creditsUsed+=credits;
  add('validation',`${product(s,a.productId).name} response-model validation`,1,2,{productId:a.productId,generation:s.world.generation,credits});break;
 }
 case'lab-partnership':s.labDeal=true;s.company.credits+=usd(2e6);emit(s,'finance','Design and validation credits secured','A $300K fixed-fee research partnership supplies $2M of restricted project credits.','Design uses up to $750K credits plus $250K cash; validation uses up to $500K credits plus $500K cash. No ongoing royalty in this slice.','Commission named projects. Credits cannot pay staff, trials or buildings.',true,'lab');break;
 case'policy':s.policy.funded=true;emit(s,'policy','Platform evidence work funded','A $2M assurance and policy program prepares a scoped platform application.','Acceptance still requires a successful observed trial, a second-generation model and completed model validation. Lobbying does not improve biology.','Build the evidence before seeking acceptance.',true,'lab');break;
 }
}
export function validatePlan(s:State,actions:Action[]):{valid:boolean;reasons:string[]}{
 const next=clone(s),reasons:string[]=[];
 if(!Array.isArray(actions)||actions.some(a=>!a||typeof a!=='object'||!(a.type in rank)))return{valid:false,reasons:['The plan contains an unknown instruction.']};
 if(actions.length>100)return{valid:false,reasons:['A plan may contain at most 100 project instructions.']};
 const preMoney=quoteCompany(s,projectMonth(s)).preMoney;
 for(const a of ordered(actions)){
  const why=problems(next,a);if(why.length){reasons.push(...why);continue;}
  try{applyAction(next,a,preMoney);}catch(e){reasons.push(e instanceof Error?e.message:'The financing terms are not available.');}
 }
 if(next.company.cash<0)reasons.push(`This combined plan is short ${money(-next.company.cash)} in available cash.`);
 else if(next.company.cash<reserved(next))reasons.push(`Reserve the remaining ${money(reserved(next))} of signed study commitments before adding this plan.`);
 return{valid:reasons.length===0,reasons:[...new Set(reasons)]};
}
export function commitPlan(s:State,actions:Action[]):State{
 const validation=validatePlan(s,actions);if(!validation.valid)throw new Error(validation.reasons.join(' '));
 const next=clone(s),preMoney=quoteCompany(s,projectMonth(s)).preMoney;
 for(const a of ordered(actions))applyAction(next,a,preMoney);
 next.commands.push({kind:'plan',month:s.month,actions:clone(ordered(actions))});return next;
}
function commission(s:State){
 for(const p of s.projects.filter(x=>x.readyAt<=s.month)){
  switch(p.kind){
  case'license':s.network.licensed=true;product(s,'partner-biologic').rights='delivery';break;
  case'clinic':s.network.clinic+=p.quantity;break;
  case'tests':s.network.tests+=p.quantity;break;
  case'supply':s.network.supply+=p.quantity;break;
  case'staff':s.network.followupEmployees+=p.quantity;break;
  case'trial-team':s.network.trialTeam=true;break;
  case'design':{
   const prod=product(s,p.productId!);
   if(p.choice==='replace')for(const old of prod.studies.filter(active)){
    old.stage='stopped';emit(s,'clinical',`Version ${old.generation} study stopped by your instruction`,`${old.enrolled} participants retain follow-up. ${money(old.paid)} spent is not refunded.`,`${money(old.dbBudget-old.paid)} in unspent research commitments is released; no readout is invented.`,'Start a new Phase 1 for the replacement candidate when ready.',true,'clinic');
   }
   prod.candidate=candidateFor(prod.id,p.generation!);
   emit(s,'clinical',`${prod.name} v${p.generation} is ready for a study`,`Predicted response ${Math.round(prod.candidate.response*100)}%; expected durability ${prod.candidate.durability} years. These remain model predictions.`,p.choice==='parallel'?'Existing studies and authorized products continue unchanged.':'Only the explicitly replaced development study was stopped. Authorized care continues.','Start the new candidate’s study, or finish the existing one first.',true,'lab');break;
  }
  case'validation':product(s,p.productId!).validation=Math.max(product(s,p.productId!).validation,p.generation!);break;
  }
  if(p.kind!=='design')emit(s,'capacity',`${p.name} ready`,'The funded project is now operating.',p.kind==='staff'?`${p.quantity*60} additional follow-up visits/month; payroll increases when the team starts.`:'The next monthly allocation uses this capability.','Inspect the route to see which input is now limiting.',false,p.kind==='staff'?'followup':p.kind==='tests'?'lab':p.kind==='supply'?'factory':'clinic');
 }
 s.projects=s.projects.filter(p=>p.readyAt>s.month);
}
function advanceOne(source:State,record:boolean):State{
 if(source.status!=='active')return clone(source);
 const s=clone(source),oldGeneration=s.world.generation;
 s.month++;
 s.world=worldAt(s.month,s.scenario);
 if(s.world.generation!==oldGeneration){
  product(s,'cancer-vaccine').available=true;
  emit(s,'world',`AI generation ${s.world.generation}: stronger medicine designs`,s.world.signal,`Both fixed and personalized candidates improve. Existing authorized medicines and active-study versions stay unchanged. Compute index ${s.world.compute}×.`,'Compare continuing your study with a new design; waiting earns no patient benefit by itself.',true,'lab');
 }
 commission(s);
 for(const result of s.population.pendingTests.filter(p=>p.readyAt<=s.month)){
  s.population.waiting+=result.eligible;s.population.ineligible+=result.count-result.eligible;
 }
 s.population.pendingTests=s.population.pendingTests.filter(p=>p.readyAt>s.month);
 if(s.company.control==='lost'||s.company.strategicControl||!s.company.ceo){s.status='control-loss';return s;}
 const p=projectMonth(s),beforeHealth=s.health.expected;
 const account=operatingAccount(s,p);
 // Pay the fixed budget installment once; the same installment is already included in the account.
 for(const t of studies(s))t.paid=Math.min(t.dbBudget,t.paid+Math.ceil(t.dbBudget/t.installments));
 const activeStudies=studies(s);let left=p.trialStarts;
 for(const t of activeStudies.filter(t=>t.stage==='recruitment')){
  const n=Math.min(20,t.target-t.enrolled,left);left-=n;
  if(n>0){const lot=makeCareLot({...s,month:s.month-1},product(s,t.productId),n,t);s.cohorts.push(lot);s.population.nextPerson+=n;s.population.waiting-=n;t.enrolled+=n;}
 }
 if(p.starts>0){const lot=makeCareLot({...s,month:s.month-1},product(s,'partner-biologic'),p.starts,null);s.cohorts.push(lot);s.population.nextPerson+=p.starts;s.population.waiting-=p.starts;}
 const screening=p.tests-p.starts-p.trialStarts;
 if(screening>0){s.population.unassessed-=screening;s.population.pendingTests.push({count:screening,eligible:Math.floor(screening*.75),readyAt:s.month+1});}
 // Eligibility batches have a full month turnaround. All study clocks are distinct from capacity.
 for(const t of activeStudies){
  if(t.stage==='preparation'){t.preparationLeft--;if(t.preparationLeft<=0)t.stage='recruitment';}
  else if(t.stage==='recruitment'&&t.enrolled>=t.target)t.stage='observation';
  else if(t.stage==='observation'&&p.followupDelivered>=p.followupRequired){t.observed++;if(t.observed>=t.observationMonths)t.stage='analysis';}
  else if(t.stage==='analysis'){
   t.analysisLeft--;
   if(t.analysisLeft<=0){const result=studyResult(t,s.seed);t.response=result.response;t.harm=result.harm;t.stage=result.passed?'passed':'failed';const prod=product(s,t.productId);prod.readoutGeneration=t.generation;prod.readoutPassed=result.passed;reconcileTrialEvidence(s,t);
    emit(s,'clinical',result.passed?'Phase 1 readout: advance supported':'Phase 1 readout: advancement blocked',`${t.enrolled} participants; ${Math.round(result.response*100)}% observed response; ${Math.round(result.harm*100)}% attributable serious harms. These are simulated outcomes.`,result.passed?'The next development decision is supported. The therapy is not commercially authorized.':'A safety or response result blocks advancement. Completion itself creates no healthspan.','Review the trade-off you made and compare a fresh strategy.',true,'clinic');
   }
  }
 }
 const support=p.followupRequired?Math.min(1,p.followupDelivered/p.followupRequired):1;
 // The period ends at this boundary. Health advances one monthly interval without advancing the business clock twice.
 const healthState={...s,month:s.month-1};
 // Care lots already carry the start of this service period, preserving the December 2050 cutoff.
 advanceHealth(healthState,support);s.cohorts=healthState.cohorts;s.health=scoreCohorts(s);
 s.company.cash+=account.cashFlow;s.company.revenue=account.receipts;s.company.expenses=account.costs;s.company.lastRevenue=account.receipts;s.company.lastExpenses=account.costs;s.company.totalRevenue+=account.receipts;s.company.totalSpend+=account.costs;
 account.healthAdded=s.health.expected-beforeHealth;s.accounts.push(account);
 if(p.starts>0&&!s.firstDeliveryReported){s.firstDeliveryReported=true;emit(s,'delivery','The first people begin partner treatment',`${p.starts} people received released medicine, a safety test, an appointment and funded follow-up.`,`${money(account.receipts)} monthly receipts; ${money(account.costs)} total monthly costs. Patient outcomes now contribute expected net healthspan.`,'Inspect which part of the route limits the next group.',true,'clinic');}
 const nextP=projectMonth(s),notice=nextP.limiter;
 if(s.firstDeliveryReported&&notice!==s.capacityNotice){s.capacityNotice=notice;emit(s,'capacity',`Next bottleneck: ${notice==='factory'?'medicine supply':notice==='lab'?'patient testing':notice==='clinic'?'treatment appointments':notice==='followup'?'follow-up staff':'eligible people'}`,nextP.reason,`${nextP.starts} commercial starts/month at current capacity; ${s.population.waiting} ready people are waiting.`,'Compare an expansion with saving cash for your trial.',true,notice);}
 if(s.policy.funded&&!s.policy.accepted&&s.world.generation>=2&&s.products.some(p=>p.readoutPassed&&p.validation>=2)){
  s.policy.accepted=true;emit(s,'policy','Scoped platform evidence accepted','An observed safety readout and validated model support a specific platform evidence route.','Future compatible studies may use this evidence; no therapy is automatically authorized and no biological result changes.','Review the next development stage in the expanded campaign.',true,'lab');
 }
 if(s.company.cash<0){s.status='insolvent';emit(s,'ending','The company runs out of cash','Signed obligations and operating costs exceeded cash.','No later delivery is simulated. Your financing quote was not spendable cash.','Restart and fund the whole milestone, or compare the saved earlier plan.');}
 else if(s.products.some(p=>p.studies.some(t=>t.stage==='passed'||t.stage==='failed'))||s.month>=24){s.status='slice-complete';emit(s,'ending','Five-minute slice complete','You have reached the first Phase 1 readout or the 24-month review boundary.','This is the human review gate, not the end of a simulated 2050 campaign.','Review what the route, cash and AI choices taught you.');}
 if(s.status==='active'&&!fundingRisk(source)&&fundingRisk(s))emit(s,'warning','Cash is approaching the milestone buffer','The forecast crossed the three-month operating buffer after signed commitments.',`${money(s.company.cash)} cash remains.`,'Review financing before the next clinical or AI decision.');
 s.lastStop=s.events.slice(source.events.length).filter(e=>e.major).at(-1)?.id??s.lastStop;
 if(record)s.commands.push({kind:'advance',month:source.month,months:1});
 return s;
}
export function advanceMonth(s:State):State{return advanceOne(s,true);}
function fundingRisk(s:State):boolean{const p=projectMonth(s);return p.cashFlow<0&&s.company.cash+3*p.cashFlow<reserved(s);}
export function runToNextDecision(source:State):State{
 if(source.status!=='active')return clone(source);
 let s=clone(source);const oldEvents=s.events.length,wasRisk=fundingRisk(s);
 for(let i=0;i<24&&s.status==='active';i++){
  s=advanceMonth(s);
  const fresh=s.events.slice(oldEvents).filter(e=>e.major);
  if(fresh.length||(!wasRisk&&fundingRisk(s)))break;
 }
 return s;
}

function nearestDecision(s:State):View['nextDecision']{
 const activeStudies=studies(s);
 const rows:{months:number;label:string;detail:string}[]=[];
 if(!s.firstDeliveryReported&&s.network.licensed)rows.push({months:1,label:'First partner treatments',detail:'The next monthly allocation connects released medicine to eligible people.'});
 if(!s.firstDeliveryReported&&s.projects.some(p=>p.kind==='license'))rows.push({months:Math.max(1,s.projects.find(p=>p.kind==='license')!.readyAt-s.month),label:'First partner treatments',detail:'Delivery begins when rights are ready and every required input is available.'});
 const designs=s.projects.filter(p=>p.kind==='design');
 for(const design of designs){
  const name=product(s,design.productId!).name,hasStudy=activeStudies.some(t=>t.productId===design.productId);
  rows.push({months:Math.max(1,design.readyAt-s.month),label:design.choice==='replace'?`${name} replacement ready · new Phase 1 unfunded`:hasStudy?`${name} candidate ready · existing study continues`:`${name} candidate ready · new study unfunded`,detail:design.choice==='replace'?`${hasStudy?'The replacement project stops the existing study when it completes. Its old readout is no longer a planned milestone.':'There is no active study to stop.'} The new candidate still needs a separately funded Phase 1; its budget is excluded from this cash forecast.`:hasStudy?'The new candidate becomes available for a separately funded study. The current study keeps its candidate, enrollment and observation clock; its readout remains planned.':'The new candidate becomes available. No study is funded automatically; this forecast includes the design project only.'});
 }
 for(const t of activeStudies){
  if(designs.some(p=>p.productId===t.productId&&p.choice==='replace'))continue;
  const months=t.preparationLeft+Math.ceil((t.target-t.enrolled)/20)+(t.observationMonths-t.observed)+t.analysisLeft;
  rows.push({months:Math.max(1,months),label:`${product(s,t.productId).name} Phase 1 readout`,detail:'Best-case timing at funded capacity. Recruitment can slip; six observation months remain biological time.'});
 }
 rows.push({months:Math.max(1,24-s.month),label:'Opening-slice review',detail:'The prototype ends at the first Phase 1 readout or month 24.'});
 rows.sort((a,b)=>a.months-b.months);return rows[0];
}
export function previewPlan(s:State,actions:Action[]):Preview{
 const validation=validatePlan(s,actions),before=projectMonth(s),next=validation.valid?commitPlan(s,actions):clone(s);
 const immediateCash=next.company.cash,upfront=s.company.cash+actions.filter(a=>a.type==='raise').reduce((n,a)=>n+a.amount,0)-immediateCash;
 // Capacity preview is the commissioned plan; cash horizon includes actual monthly project and trial clocks below.
 const commissioned=clone(next);commissioned.month=Math.max(commissioned.month,...commissioned.projects.map(p=>p.readyAt));commission(commissioned);
 const after=projectMonth(commissioned),milestone=nearestDecision(next);
 let projected=clone(next);
 for(let i=0;i<milestone.months&&projected.status==='active';i++)projected=advanceOne(projected,false);
 const raise=actions.find(a=>a.type==='raise'),q=quoteCompany(s,before);
 return{...validation,cashNow:s.company.cash,cashAfter:immediateCash,upfront,remainingCommitments:reserved(next),cashAtMilestone:projected.company.cash,monthsToMilestone:milestone.months,milestoneLabel:milestone.label,before,after,effects:actions.map(a=>a.type==='update'&&a.choice==='replace'?`Replacement design finishes in one month. ${studies(s).some(t=>t.productId===a.productId)?'The active study stops and its old readout is cancelled.':'There is no active study to stop.'} A new Phase 1 is not funded and is excluded from this milestone cash forecast.`:options(s).find(o=>JSON.stringify(o.action)===JSON.stringify(a))?.effect??(a.type==='hire'?`${a.people*60} follow-up visits/month after one month.`:a.type==='raise'?`${money(a.amount)} financing closes without advancing time.`:'The selected project changes the funded route.')),dilution:raise?raise.amount/(q.preMoney+raise.amount):0};
}
export function options(s:State):Option[]{
 const make=(id:string,title:string,description:string,action:Action,total:number,duration:number,effect:string,node?:Option['node']):Option=>{const why=problems(s,action);return{id,title,description,action,cost:actionCost(s,action),totalCommitment:total,duration,effect,available:why.length===0,reason:why.join(' '),node};};
 const quote=quoteCompany(s,projectMonth(s)),defaultRaise=Math.min(usd(50e6),quote.maxRaise),p=projectMonth(s),staff=Math.max(1,p.recommendedFollowupHires??0);
 const list:Option[]=[
 make('raise','Raise a financing round','Choose the check size. The offer explains its evidence, rights and operating assumptions.',{type:'raise',amount:defaultRaise},0,0,`${money(defaultRaise)} cash; exact dilution at the quoted pre-money.`),
 make('license','License partner biologic','Already authorized autoimmune medicine. $1M buys local delivery rights, not ownership of the product.',{type:'license'},usd(1e6),1,'100 released doses/month can feed the clinic. Each care start earns $12K and consumes $6K medicine plus site services.','factory'),
 make('clinic','Add 120 treatment appointments','Expand treatment bays and the clinical team. Follow-up is a separate staffing requirement at this same clinic.',{type:'expand',resource:'clinic'},usd(2e6),2,'+120 appointments/month; +10 clinic employees after commissioning.','clinic'),
 make('tests','Add 100 patient tests','Eligibility/safety tests select who can be treated; results return one month later. They do not manufacture medicine.',{type:'expand',resource:'tests'},usd(.5e6),1,'+100 eligibility/safety tests/month; clinical safety tests are allocated first.','lab'),
 make('supply','Reserve 100 more medicine doses','Buy capacity at an existing manufacturer. Each dose is already quality-released; you still need therapy delivery rights.',{type:'expand',resource:'supply'},usd(.5e6),1,'+100 released doses/month shared by trials and commercial care.','factory'),
 make('hire','Hire follow-up staff','Set one team size for sustained delivery. Each person adds 60 monthly visits and $12K monthly payroll; recruitment costs $15K/person.',{type:'hire',people:staff},usd(staff*15000),1,`${p.recommendedFollowupHires?`${p.recommendedFollowupHires} hires cover`:'Current and committed staff cover'} a planning target of ${p.sustainedFollowupRequired} visits/month if today’s other capacities sustain this start rate. Includes six months of commercial follow-up and funded trial commitments; no future approvals.`,'followup'),
 make('trial-team','Recruit a clinical trial team','Four research staff run studies at this clinic. Trials share appointments, tests, medicine capacity and follow-up.',{type:'trial-team'},usd(.5e6),1,'One-month setup; +$48K/month payroll. Study sponsor budgets are separate.','clinic'),
 make('lab-partnership','Buy a research credit partnership','$300K fixed fee for $2M of restricted design/validation credits. No ongoing royalty in this slice.',{type:'lab-partnership'},usd(.3e6),0,'Credits fund named projects; never buildings, clinical staff or trials.','lab'),
 make('policy','Prepare a platform evidence application','A $2M assurance and policy effort. Acceptance also requires observed safety, model validation and sufficiently capable AI.',{type:'policy'},usd(2e6),0,'Institutional acceptance may change future evidence requirements. It cannot improve biological efficacy.','lab'),
 ];
 for(const mode of ['own','codevelop','sponsored'] as const){const budget=usd(mode==='own'?12e6:mode==='codevelop'?3e6:.5e6);list.push(make(`study-${mode}`,mode==='own'?'Start Phase 1 · own the asset':mode==='codevelop'?'Start Phase 1 · co-develop':'Run the sponsor’s Phase 1',mode==='own'?'DB funds the complete $12M sponsor package: CMC, regulatory preparation and study coordination. Site delivery, testing and payroll are additional.':mode==='codevelop'?'The sponsor package is $12M. DB funds $3M (25%); a partner funds $9M in exchange for shared rights. Site delivery costs remain visible.':'DB commits $500K to site services and can earn up to $1.96M from actual enrollment and observations. The sponsor owns the asset and funds central R&D/CMC.',{type:'start-study',productId:'immune-reset',mode},budget,11,`${money(budget)} total DB commitment; ${money(Math.ceil(budget/11))} now. 2 months preparation, 40 participants, 6 months observation, 1 month analysis.`,'clinic'));}
 for(const prod of s.products.filter(p=>p.id!=='partner-biologic')){
  const frontier=candidateFor(prod.id,s.world.generation),study=prod.studies.find(active);
  for(const choice of ['parallel','replace'] as const)list.push(make(`update-${prod.id}-${choice}`,choice==='parallel'?`Design ${prod.name} v${s.world.generation} · keep current study`:`Design ${prod.name} v${s.world.generation} · replace study`,choice==='parallel'?'The active study keeps its original candidate and observation clock. The new candidate needs a separately funded study.':`Explicitly stops the active study when design finishes. ${study?`${study.enrolled} participants retain follow-up; ${money(study.paid)} already spent is not refunded.`:'There is no active study to stop.'}`,{type:'update',productId:prod.id,choice},usd(1e6),1,`Model-predicted response ${Math.round(frontier.response*100)}%, durability ${frontier.durability} years. $1M project, up to $750K credits; cash copay visible. No automatic authorization.`,'lab'));
  list.push(make(`validate-${prod.id}`,`Validate ${prod.name} response model`,'Compare model predictions with independent experimental evidence. This is a defined job, not an efficacy upgrade.',{type:'validate-model',productId:prod.id},usd(1e6),2,'$1M project, up to $500K credits. Supports a later scoped platform application.','lab'));
 }
 return list;
}
export function getView(s:State):View{
 const projection=projectMonth(s),nextDecision=nearestDecision(s),anyStudy=studies(s).length>0;
 const readouts=s.products.flatMap(p=>p.studies).filter(t=>t.stage==='passed'||t.stage==='failed');
 let milestone:View['milestone']={title:'First Phase 1 decision',complete:false,detail:'End this slice at the first safety readout or month 24; this is not a 2050 campaign.'};
 if(s.status==='insolvent')milestone={title:'Cash exhausted',complete:false,detail:'Operating costs and signed commitments exceeded available cash. Delivery has stopped. A financing valuation is not cash; compare a plan funded through its next clinical milestone.'};
 else if(s.status==='control-loss')milestone={title:'Company control lost',complete:false,detail:'The company no longer meets the retained-control requirement. Delivery stopped before the next allocation; this is a campaign failure, not a completed clinical milestone.'};
 else if(s.status==='slice-complete'){
  const passed=readouts.filter(t=>t.stage==='passed').length;
  if(readouts.length>1)milestone={title:`${passed} of ${readouts.length} Phase 1 readouts support advancement`,complete:true,detail:'Human review gate: the completed studies produced separate safety and response decisions. Inspect each candidate’s readout; no investigational medicine is automatically authorized.'};
  else if(readouts[0]?.stage==='passed')milestone={title:'Phase 1 supports advancement',complete:true,detail:'Human review gate: the observed safety and response results support the next development decision. The investigational medicine is not commercially authorized. Compare the route, financing and AI choices before extending the game.'};
  else if(readouts[0]?.stage==='failed')milestone={title:'Phase 1 blocks advancement',complete:true,detail:'Human review gate: the observed study did not meet its safety or response threshold. Follow-up remains part of patient care; completing a failed study does not earn a clinical success. Compare a stronger candidate or a different strategy.'};
  else milestone={title:'24-month review reached',complete:true,detail:'Human review gate: no Phase 1 readout completed within this opening slice. Review what delayed the milestone and what your route delivered before extending the game.'};
 }

 const guidance=!s.company.rounds.length?{title:'Fund the next milestone',detail:'The $250M pre-money premise is a financing offer, not cash. Raise a $25–75M round, then connect the partner treatment route.',node:'factory' as const}:!s.network.licensed&&!s.projects.some(p=>p.kind==='license')?{title:'Connect a real medicine to the clinic',detail:'License the partner biologic. A supplier reservation alone does not grant delivery rights.',node:'factory' as const}:!s.network.trialTeam?{title:'Deliver today or build evidence for tomorrow',detail:'More delivery capacity earns care revenue. A clinical trial team opens the immune-reset development decision.',node:'clinic' as const}:!anyStudy?{title:'Choose who pays for Phase 1',detail:'Own the asset for $12M, co-develop for $3M, or earn sponsored-study fees for a $500K site commitment.',node:'clinic' as const}:{title:projection.reason,detail:`${projection.starts} commercial starts/month; ${s.population.waiting} eligible people waiting. Running to a decision preserves actual trial observation time.`,node:projection.limiter};
 return{state:s,date:new Date(Date.UTC(2027,s.month,1)).toLocaleDateString('en-US',{month:'short',year:'numeric',timeZone:'UTC'}),projection,options:options(s),quote:quoteCompany(s,projection),value:valueCompany(s,projection),nextDecision,guidance,lastAccount:s.accounts.at(-1)??null,milestone};
}
