import type {Candidate, CareLot, Health, Product, ProductId, Scenario, State, Study} from './types';

/** All biological values are fictional scenario assumptions, not clinical forecasts. */
const clamp=(n:number,a=0,b=1)=>Math.max(a,Math.min(b,n));
export function draw(seed:number,...keys:(string|number)[]):number {
 let h=(2166136261^seed)>>>0;
 for(const key of keys)for(const c of `${key}|`)h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
 h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;
 return(h>>>0)/4294967296;
}
const profiles:Record<ProductId,{response:number[];gain:number[];duration:number[];harm:number[]}>= {
 'partner-biologic':{response:[.66,.77,.87,.94],gain:[.22,.33,.45,.55],duration:[3,6,10,16],harm:[.018,.013,.008,.004]},
 'immune-reset':{response:[.45,.67,.83,.94],gain:[.40,.55,.70,.82],duration:[4,9,16,24],harm:[.075,.045,.022,.008]},
 'cancer-vaccine':{response:[.36,.61,.81,.94],gain:[.45,.60,.75,.88],duration:[3,8,15,24],harm:[.06,.036,.017,.006]},
};
export function candidateFor(id:ProductId,generation:number):Candidate{
 const p=profiles[id],g=Math.max(0,Math.min(3,Math.floor(generation)));
 return{generation:g,response:p.response[g],annualGain:p.gain[g],durability:p.duration[g],harm:p.harm[g],predictionConfidence:.36+g*.18};
}
export function initialProducts():Product[]{
 const product=(id:ProductId,name:string,kind:Product['kind'],description:string):Product=>({id,name,kind,description,available:id!=='cancer-vaccine',candidate:candidateFor(id,0),authorized:id==='partner-biologic'?candidateFor(id,0):null,rights:'none',studies:[],readoutGeneration:null,readoutPassed:false,validation:0});
 return[
  product('partner-biologic','Partner autoimmune biologic','fixed','An already authorized manufactured antibody for inflammatory disease. DB licenses local delivery rights, buys released doses, gives treatment and provides safety follow-up. It earns care fees, not ownership of the medicine.'),
  product('immune-reset','DB immune reset','fixed','An investigational medicine intended to remove disease-driving immune cells and sustain remission. One manufactured version can treat many people; a new AI design needs its own accepted evidence.'),
  product('cancer-vaccine','Personalized cancer vaccine','personalized','A patient-specific vaccine designed from tumor profiling. Each course requires sample analysis, an individual manufacturing batch and clinical follow-up. This slice demonstrates development only; oncology delivery awaits a separate patient pool.'),
 ];
}
export function releaseMonths(scenario:Scenario):number[]{return scenario==='fast'?[4,10,18]:[6,14,22];}
export function worldAt(month:number,scenario:Scenario):State['world']{
 const generation=releaseMonths(scenario).filter(t=>t<=month).length;
 const signals=['Models are searching for stronger fixed medicines and personalized targets.','Better predictions are generating more effective, longer-lasting candidate therapies.','Validated biology models may support narrower, platform-based evidence routes.','Highly predictive models support much stronger fixed and personalized candidates.'];
 return{generation,compute:[1,12,150,1800][generation],outsideAccess:clamp(.12+month*.006,0,.95),biology:[.12,.48,.95,1.5][generation],signal:signals[generation],rival:generation<1?'CommonCare is adding clinics; Frontier Atlas is testing new designs.':generation<2?'Frontier Atlas offers stronger designs; hospital partners compete for trial teams.':'CommonCare is preparing platform trials; Helix Foundry is reserving personalized production.'};
}
export function studyResult(study:Study,seed:number):{passed:boolean;response:number;harm:number}{
 if(study.enrolled<study.target||study.observed<study.observationMonths||study.analysisLeft>0)throw new Error('Study observation and analysis must finish before readout.');
 // Candidate identity, rather than click order, preview count or financing date, binds every outcome.
 const actualResponse=clamp(study.candidate.response+(draw(seed,study.productId,study.generation,'biology')-.5)*.12);
 const safetySignal=draw(seed,study.productId,study.generation,'safety')<.09;
 const actualHarm=clamp(study.candidate.harm+(safetySignal?.20:0));
 let responses=0,harms=0;
 for(let i=0;i<study.enrolled;i++){
  responses+=draw(seed,study.productId,study.generation,'response',i)<actualResponse?1:0;
  harms+=draw(seed,study.productId,study.generation,'harm',i)<actualHarm?1:0;
 }
 const response=responses/study.enrolled,harm=harms/study.enrolled;
 return{passed:response>=.20&&harm<=.15,response,harm};
}
const acuteHarm=2.5;
export const monthlySurvival=(age:number)=>Math.exp(-.0035*Math.exp((age+1/24-45)/10.5)/12);
const gain=(c:Candidate,elapsed:number)=>c.response*c.annualGain*Math.exp(-elapsed/Math.max(.25,c.durability));
function outsideCare(world:State['world'],yearsAhead:number,elapsed:number):{gain:number;access:number}{
 const biology=world.biology+(1.75-world.biology)*(1-Math.exp(-yearsAhead/12));
 const access=world.outsideAccess+(.96-world.outsideAccess)*(1-Math.exp(-yearsAhead/14));
 return{gain:clamp(.055+.28*biology),access:clamp(access*clamp(.18+elapsed/5))};
}
/** During the required course, an inferior DB treatment can have negative incremental value.
 * Afterwards only the independently accessible fraction can switch to the better alternative.
 * This explicit evaluator assumption does not reimburse acute harms or add new DB customers. */
function incrementalGain(lot:CareLot,world:State['world'],elapsed:number,yearsAhead:number,support:number):number{
 const db=gain(lot.candidate,elapsed)*support,outside=outsideCare(world,yearsAhead,elapsed);
 if(elapsed<lot.followupMonths/12)return db-outside.access*outside.gain;
 const accessibleGain=outside.access*Math.max(db,outside.gain);
 const withoutAccessGain=(1-outside.access)*db;
 return accessibleGain+withoutAccessGain-outside.access*outside.gain;
}

function estimate(lot:CareLot,month:number,world:State['world']):{remaining:number;tail:number}{
 let remaining=0,alive=lot.alive;
 const elapsed=Math.max(0,month-lot.startMonth)/12;
 const steps=Math.max(0,Math.ceil((120-lot.age-elapsed)*12));
 for(let i=0;i<steps;i++){
  const years=i/12,survival=monthlySurvival(lot.age+elapsed+years);
  const support=lot.continuity*Math.exp(-years*.012);
  const delta=incrementalGain(lot,world,elapsed+years+1/24,years+1/24,support);
  remaining+=alive*(1+survival)/2*delta/12;alive*=survival;
 }
 const survival=monthlySurvival(120);
 return{remaining,tail:alive/12/Math.max(1e-12,1-survival)};
}
export function makeCareLot(s:State,product:Product,count:number,trial:Study|null):CareLot{
 if(s.month>=288)throw new Error('Care may not begin after December 2050.');
 const candidate={...(trial?.candidate??product.authorized!)};
 if(!candidate||!Number.isFinite(candidate.response))throw new Error('Care requires an authorized medicine or a funded study.');
 const first=s.population.nextPerson;
 return{id:`people:${first}-${first+count}`,firstPerson:first,count,productId:product.id,generation:candidate.generation,startMonth:s.month,candidate,trialId:trial?.id??null,alive:count,experienced:-count*candidate.harm*acuteHarm,remaining:0,continuity:1,age:50+Math.floor(draw(s.seed,first,'age')*12),followupMonths:product.id==='partner-biologic'?6:12};
}
export function scoreCohorts(s:State):Health{
 const health:Health={expected:0,experienced:0,remaining:0,people:0,tailError:0},seen=new Set<string>();
 for(const lot of s.cohorts){
  if(seen.has(lot.id)||lot.startMonth>=288||lot.startMonth>s.month)continue;seen.add(lot.id);
  const {remaining,tail}=estimate(lot,s.month,s.world);
  health.experienced+=lot.experienced;health.remaining+=remaining;health.people+=lot.count;health.tailError+=tail;
 }
 health.expected=health.experienced+health.remaining;return health;
}
export function advanceHealth(s:State,support:number):void{
 for(const lot of s.cohorts){
  if(lot.startMonth>=288||lot.startMonth>s.month)continue;
  const elapsed=(s.month-lot.startMonth)/12,required=s.month-lot.startMonth<lot.followupMonths;
  const coverage=required?clamp(support):1;
  lot.continuity=clamp(lot.continuity*.9+coverage*.1);
  const survival=monthlySurvival(lot.age+elapsed);
  const delta=incrementalGain(lot,s.world,elapsed+1/24,1/24,lot.continuity);
  lot.experienced+=lot.alive*(1+survival)/2*delta/12;lot.alive*=survival;
 }
 // month in the caller denotes the just-finished service period until it increments.
 const after={...s,month:s.month+1};
 s.health=scoreCohorts(after);
 for(const lot of s.cohorts)lot.remaining=estimate(lot,after.month,s.world).remaining;
}
export function reconcileTrialEvidence(s:State,study:Study):void{
 if(study.response===null||study.harm===null)return;
 for(const lot of s.cohorts.filter(c=>c.trialId===study.id)){
  lot.experienced-=lot.count*(study.harm-lot.candidate.harm)*acuteHarm;
  lot.candidate={...lot.candidate,response:study.response,harm:study.harm,predictionConfidence:Math.max(.65,lot.candidate.predictionConfidence)};
 }
}
