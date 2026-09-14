import type {BenefitEstimate,Candidate,Cohort,Facility,Health,Policy,Program,ScenarioId,State,Study,World} from './types';

/** Authored, fictional scenario parameters, not forecasts of clinical efficacy. */
const PROFILES = {
  'standard-autoimmune': {name:'Established autoimmune care',family:'autoimmune',kind:'fixed',modality:'Established manufactured biologic',availableAt:0,response:[.66,.92],gain:[.16,.43],durability:[3,10],harm:[.016,.002],description:'A manufactured biologic given by a clinical team to control inflammatory disease. Clinics earn treatment and follow-up fees; repeat treatment and monitoring remain necessary.'},
  'immune-reset': {name:'Immune reset',family:'autoimmune',kind:'fixed',modality:'Fixed immune-reset biologic',availableAt:0,response:[.44,.95],gain:[.38,.80],durability:[4,22],harm:[.07,.004],description:'A defined medicine designed to remove disease-driving immune cells and rebuild healthier immune function. Better AI candidates can reach more patients, reduce harm and prolong remission; each version needs accepted evidence.'},
  'cancer-vaccine': {name:'Personalized cancer vaccine',family:'oncology',kind:'personalized',modality:'Patient-specific vaccine',availableAt:4,response:[.35,.96],gain:[.42,.88],durability:[3,24],harm:[.045,.003],description:'A vaccine designed from an individual tumor sample. A testing laboratory identifies targets; a factory or compatible local maker produces that patient’s vaccine; the clinical team administers and follows treatment.'},
  'neural-repair': {name:'Neural repair',family:'neuro',kind:'fixed',modality:'Fixed neural-repair medicine',availableAt:10,response:[.18,.89],gain:[.30,.82],durability:[2,20],harm:[.05,.004],description:'An investigational manufactured medicine intended to slow neurological decline and restore function. Improved fixed candidates can produce much larger gains, but functional outcomes still take time to observe.'},
  'cell-repair': {name:'Personalized cell therapy',family:'autoimmune',kind:'personalized',modality:'Engineered cell therapy',availableAt:8,response:[.35,.95],gain:[.45,.87],durability:[4,25],harm:[.08,.004],description:'Collected cells are engineered for an individual, checked and returned for specialist treatment. The route needs suitable collection, manufacturing and clinical support; better models can change both efficacy and delivery requirements.'},
  aspis: {name:'Aspis immune wearable',family:'autoimmune',kind:'personalized',modality:'Wearable immune-treatment maker',availableAt:28,response:[.42,.98],gain:[.38,.94],durability:[3,27],harm:[.06,.002],description:'A speculative Darkome-inspired device that makes and delivers supported personalized immune treatments while worn. It needs authorized treatment designs, compatible inputs and continuing clinical support. Hardware installation alone produces no healthspan.'},
} as const;
type ProgramId = keyof typeof PROFILES;
const clamp = (x:number,min=0,max=1) => Math.max(min,Math.min(max,x));
const usd = (x:number) => Math.round(x*100);
function profile(id:string) { const p=PROFILES[id as ProgramId]; if(!p) throw new Error(`Unknown program: ${id}`); return p; }
function draw(seed:number,...parts:(string|number)[]) {
  let h=(2166136261^seed)>>>0;
  for(const part of parts) for(const c of `${part}|`) h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;
  h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;
  return (h>>>0)/4294967296;
}

export function candidateFor(programId:string,generation:number):Candidate {
  const p=profile(programId),g=Math.floor(clamp(generation,0,8)),f=Math.pow(g/8,.85);
  const interpolate=(range:readonly [number,number])=>range[0]+(range[1]-range[0])*f;
  return {generation:g,response:interpolate(p.response),annualGain:interpolate(p.gain),durability:interpolate(p.durability),harm:interpolate(p.harm),predictionConfidence:.34+.60*f};
}

export function initialPrograms():Program[] {
  return Object.entries(PROFILES).map(([id,p])=>({id,name:p.name,description:p.description,family:p.family,kind:p.kind,modality:p.modality,availableAt:p.availableAt,stage:id==='standard-autoimmune'?'approved':'preclinical',candidate:candidateFor(id,0),frontier:candidateFor(id,0),study:null,evidence:id==='standard-autoimmune'?.85:0,authorizedGeneration:id==='standard-autoimmune'?0:-1,authorizedCandidate:id==='standard-autoimmune'?candidateFor(id,0):null,lastResult:id==='standard-autoimmune'?'Established care is authorized. New fixed versions still require evidence and explicit adoption.':'No human study has started.',starts:0,developmentSpend:0,platformEligible:p.kind==='personalized'}));
}

const RELEASES = [
  'Better fixed medicines and patient-specific targets',
  'Predictive biology produces stronger, safer candidates',
  'Compact production brings selected therapies to clinics',
  'Faster model validation supports wider home treatment',
  'Longer remissions and repair become credible study targets',
  'Home makers can produce selected personalized therapies',
  'Aspis-style immune treatment becomes technically possible',
  'Adaptive therapy design brings large gains within reach',
];
const COMPUTE=[1,4,18,90,350,1500,6000,18000,50000];
const BIOLOGY=[.12,.27,.43,.62,.80,.99,1.19,1.39,1.60];
/** The schedule is private to resolution; the returned World never exposes future dates. */
function releaseTicks(scenario:ScenarioId,seed:number) {
  const nominal=scenario==='convergence'?[4,10,18,27,36,48,64,80]:[6,15,25,38,50,62,75,88];
  return nominal.map((t,i)=>t+Math.floor(draw(seed,'world-release',scenario,i)*5)-2);
}
export function worldAt(tick:number,scenario:ScenarioId,seed:number):World {
  const t=Math.max(0,Math.floor(tick)),generation=releaseTicks(scenario,seed).filter(q=>q<=t).length;
  const matureYears=Math.max(0,t-80)/4;
  const counterfactualAccess=clamp(.09+.0072*t+(scenario==='convergence'?.018:0),0,.96);
  const rivals=[
    {name:'Frontier Atlas',share:clamp(.035+generation*.013,0,.20),action:generation<3?'Testing model-designed therapy candidates':generation<6?'Licensing stronger fixed and personalized products':'Offering portable models and selected home-treatment systems'},
    {name:'CommonCare Hospitals',share:clamp(.065+t*.0010,0,.22),action:generation<3?'Expanding existing clinical services':generation<6?'Opening treatment and trial partnerships':'Converting selected care to supported home delivery'},
    {name:'Helix Foundry',share:clamp(.035+generation*.011,0,.18),action:generation<3?'Reserving therapy manufacturing capacity':generation<6?'Offering compact factory equipment':'Supplying maker inputs and maintaining distributed production'},
  ];
  return {generation,compute:COMPUTE[generation]*Math.pow(1.12,matureYears),biology:BIOLOGY[generation]+(1.75-BIOLOGY[generation])*(1-Math.exp(-matureYears/15)),counterfactualAccess,releases:RELEASES.slice(0,generation),nextSignal:generation===8?'Further improvements are expected; biological validation and adoption remain uncertain.':`Research signal: ${RELEASES[generation].toLowerCase()}. Timing and validation remain uncertain; this is a forecast, not a scheduled unlock.`,localMakers:generation>=3,homeCare:generation>=3,homeMakers:generation>=6,wearables:generation>=7,rivals};
}

export function studySpec(program:Program,world:World,policy:Policy,pkg:Study['package']):Pick<Study,'phase'|'target'|'preparation'|'observation'|'review'|'cost'> {
  const phase:Study['phase']=program.stage==='preclinical'?'phase1':program.stage==='phase1'?'phase2':'phase3';
  const broad=pkg==='broad';
  const base=phase==='phase1'?{target:broad?48:24,preparation:1,observation:3,review:1,cost:usd(broad?1350000:900000)}:phase==='phase2'?{target:broad?240:120,preparation:1,observation:5,review:1,cost:usd(broad?4800000:3200000)}:{target:broad?1200:600,preparation:2,observation:7,review:2,cost:usd(broad?12500000:8000000)};
  // A model improves the candidate independently of whether an institution accepts its predictions.
  const predictiveAccepted=policy.stage!=='product' && world.generation>=3 && program.candidate.predictionConfidence>=.60;
  if(predictiveAccepted && phase!=='phase1') {
    const personal=policy.stage==='personal' && world.generation>=6 && program.platformEligible;
    base.target=Math.ceil(base.target*(personal?.30:.60));
    base.observation=personal?2:Math.max(3,base.observation-2);
    base.preparation=1; base.review=1;
    base.cost=Math.round(base.cost*(personal?.45:.72));
  }
  return {phase,...base};
}

export function studyResult(program:Program,study:Study,seed:number):{passes:boolean;response:number;harm:number;evidence:number;detail:string} {
  if(study.paused||study.failed||study.preparation>0||study.enrolled<study.target||study.observed<study.observation||study.review>0) throw new Error('Study readout is not ready');
  const candidate=candidateFor(program.id,study.generation);
  const trueResponse=clamp(candidate.response+(draw(seed,program.id,study.generation,'biological-response')-.5)*.12);
  const biologicalHarm=clamp(candidate.harm*(.70+draw(seed,program.id,study.generation,'biological-harm')*.60));
  const keys=[program.id,study.phase,study.started,study.generation,study.package];
  const safetySignal=draw(seed,...keys,'unexpected-safety')<.035;
  const trueHarm=clamp(biologicalHarm+(safetySignal?.14:0));
  let responses=0,harms=0;
  for(let i=0;i<study.enrolled;i++) {
    responses+=draw(seed,...keys,'participant-response',i)<trueResponse?1:0;
    harms+=draw(seed,...keys,'participant-harm',i)<trueHarm?1:0;
  }
  const response=responses/study.enrolled,harm=harms/study.enrolled;
  const responseFloor=study.phase==='phase1'?.12:study.phase==='phase2'?.28:.43;
  const harmCeiling=study.phase==='phase1'?.17:study.phase==='phase2'?.13:.10;
  const passes=response>=responseFloor&&harm<=harmCeiling;
  const evidence=(study.phase==='phase1'?.22:study.phase==='phase2'?.32:.46)*(study.package==='broad'?1.10:1)*(passes?1:.35);
  const result=passes?'The study supports the next development decision.':harm>harmCeiling?'A safety signal blocks advancement of this study package.':'The response signal did not clear the study’s advancement threshold.';
  return {passes,response,harm,evidence,detail:`${responses} of ${study.enrolled} participants met the response outcome; ${harms} had an attributable serious adverse outcome. ${result} Completion itself adds no healthspan.`};
}

const MAX_AGE=120;
const ACUTE_HARM_YEARS=2.5;
const mortalityHazard=(age:number)=>.0035*Math.exp((age-45)/10.5);
export const quarterSurvival=(age:number)=>Math.exp(-mortalityHazard(age+.125)/4);
export const populationAge=(seed:number,region:number)=>50+Math.floor(draw(seed,region,'population-age')*12);
export const followupQuartersFor=(programId:string)=>programId==='standard-autoimmune'?12:programId==='neural-repair'?24:programId==='aspis'?20:16;
const gainAt=(c:Candidate,years:number)=>clamp(c.response)*clamp(c.annualGain)*Math.exp(-Math.max(0,years)/Math.max(.25,c.durability));
function projectedWorld(world:World,years:number) {
  return {biology:world.biology+(1.75-world.biology)*(1-Math.exp(-years/12)),counterfactualAccess:world.counterfactualAccess+(.96-world.counterfactualAccess)*(1-Math.exp(-years/16))};
}
function alternativeGain(world:Pick<World,'biology'|'counterfactualAccess'>,elapsedYears:number,baselineDelay:number) {
  const uptake=clamp(.18+elapsedYears/Math.max(.5,baselineDelay));
  return clamp(.055+.28*world.biology)*clamp(world.counterfactualAccess)*uptake;
}
function nextGain(c:Cohort,tick:number,world:Pick<World,'biology'|'counterfactualAccess'>,support:number) {
  const elapsed=Math.max(0,tick-c.start)/4;
  const db=gainAt(c.candidate,elapsed+.125)*clamp(support);
  const alternative=alternativeGain(world,elapsed+.125,c.baselineDelay);
  // Both worlds retain outside care. Once a better alternative is available, an obsolete DB product earns no continuing advantage.
  return Math.max(0,db-alternative);
}
function estimateRemaining(c:Cohort,tick:number,world:World):{remaining:number;tail:number} {
  let alive=Math.max(0,c.alive),remaining=0;
  const elapsed=Math.max(0,tick-c.start)/4;
  const steps=Math.max(0,Math.ceil((MAX_AGE-c.age-elapsed)*4));
  for(let q=0;q<steps;q++) {
    const years=q/4,age=c.age+elapsed+years;
    const survival=quarterSurvival(age);
    // Completing observation is not a cure; continuing access and relapse remain in the projection.
    const support=clamp(c.continuity)*Math.exp(-years*.012);
    const gain=nextGain(c,tick+q,projectedWorld(world,years+.125),support);
    remaining+=alive*(1+survival)/2*gain/4;
    alive*=survival;
  }
  // Discrete-quarter model: no quadrature approximation. Bound all omitted future healthy years by persistent mortality at the final age.
  const lastAge=c.age+elapsed+steps/4,tailSurvival=quarterSurvival(lastAge);
  const tail=alive*.25/Math.max(1e-12,1-tailSurvival);
  if(tick<=c.start)remaining-=c.count*c.candidate.harm*ACUTE_HARM_YEARS;
  return {remaining,tail};
}
function zeroHealth():Health {return {expected:0,experienced:0,remaining:0,people:0,low:0,high:0,tailError:0};}
function addAssessment(health:Health,c:Cohort,remaining:number,tail:number){
  health.experienced+=c.experienced;health.remaining+=remaining;health.people+=c.count;health.tailError+=tail;
  const uncertainty=.12+.24*(1-clamp(c.candidate.predictionConfidence));
  health.low+=c.experienced+remaining-Math.abs(remaining)*uncertainty;
  health.high+=c.experienced+remaining+Math.abs(remaining)*uncertainty;
}
function finishAssessment(health:Health):Health{
  health.expected=health.experienced+health.remaining;
  health.tailError+=Number.EPSILON*(Math.abs(health.experienced)+Math.abs(health.remaining))*1024;
  return health;
}
function uniqueCohorts(cohorts:Cohort[]) {
  const seen=new Set<string>();
  return cohorts.filter(c=>{if(seen.has(c.id))return false;seen.add(c.id);return true;});
}
export function scoreCohorts(state:State):Health {
  const health=zeroHealth();
  for(const c of uniqueCohorts(state.cohorts)) {
    if(c.start>95||c.start>state.tick||c.count<=0) continue;
    const {remaining,tail}=estimateRemaining(c,state.tick,state.world);
    addAssessment(health,c,remaining,tail);
  }
  return finishAssessment(health);
}

export function makeCohort(state:State,site:Facility,program:Program,count:number):Cohort {
  const region=state.regions.find(r=>r.id===site.region);
  if(!region) throw new Error('Treatment site has no population region');
  if(!program.authorizedCandidate) throw new Error('Commercial treatment requires an authorized candidate');
  if(state.tick>95) throw new Error('New care cannot begin after 2050');
  const prior=uniqueCohorts(state.cohorts).filter(c=>c.region===region.id).reduce((n,c)=>n+c.count,0);
  const first=Math.max(region.treated,prior),n=Math.min(Math.max(0,Math.floor(count)),Math.max(0,region.population-first));
  const id=`residents:${region.id}:${first}:${first+n}`;
  const age=populationAge(state.seed,region.id);
  const candidate={...program.authorizedCandidate};
  const followupQuarters=followupQuartersFor(program.id);
  const c:Cohort={id,region:region.id,programId:program.id,siteId:site.id,count:n,start:state.tick,generation:candidate.generation,candidate,experienced:0,remaining:0,alive:n,age,continuity:1,followupQuarters,followupRemaining:followupQuarters,delivery:site.delivery,baselineDelay:1.5+8*(1-clamp(region.access))};
  c.remaining=estimateRemaining(c,state.tick,state.world).remaining;
  return c;
}

export function advanceHealth(state:State,continuityBySite:Record<string,number>):{cohorts:Cohort[];health:Health} {
  const health=zeroHealth();
  const cohorts=uniqueCohorts(state.cohorts).map(original=>{
    const c={...original,candidate:{...original.candidate}};
    if(c.start>95||c.start>state.tick||c.count<=0) return c;
    const supplied=continuityBySite[c.siteId];
    const currentSupport=supplied===undefined?(c.followupRemaining>0?0:c.continuity):clamp(supplied);
    // A missed quarter can lower continuing access. Later funded care can recover service, but never refund already lost benefit.
    c.continuity=clamp(c.continuity*.82+currentSupport*.18);
    const age=c.age+Math.max(0,state.tick-c.start)/4;
    const survival=quarterSurvival(age);
    c.experienced+=c.alive*(1+survival)/2*nextGain(c,state.tick,state.world,c.continuity)/4;
    if(state.tick===c.start)c.experienced-=c.count*c.candidate.harm*ACUTE_HARM_YEARS;
    c.alive*=survival;
    c.followupRemaining=Math.max(0,c.followupRemaining-1);
    const assessment=estimateRemaining(c,state.tick+1,state.world);
    c.remaining=assessment.remaining;addAssessment(health,c,assessment.remaining,assessment.tail);
    return c;
  });
  return {cohorts,health:finishAssessment(health)};
}

export function benefitEstimate(candidate:Candidate,world:World,age=55):BenefitEstimate {
  const c:Cohort={id:'illustration',region:0,programId:'illustration',siteId:'illustration',count:1,start:0,generation:candidate.generation,candidate:{...candidate},experienced:0,remaining:0,alive:1,age,continuity:1,followupQuarters:16,followupRemaining:16,delivery:'clinic',baselineDelay:5};
  let gross=0,alive=1;
  for(let q=0;q<Math.ceil((MAX_AGE-age)*4);q++) {
    const survival=quarterSurvival(age+q/4);
    gross+=alive*(1+survival)/2*gainAt(candidate,q/4+.125)*Math.exp(-q/4*.012)/4;
    alive*=survival;
  }
  const harm=candidate.harm*ACUTE_HARM_YEARS;
  const incremental=estimateRemaining(c,0,world).remaining;
  const uncertainty=.12+.24*(1-clamp(candidate.predictionConfidence));
  return {gross:gross-harm,incremental,low:incremental-Math.abs(incremental)*uncertainty,high:incremental+Math.abs(incremental)*uncertainty,response:candidate.response,harm:candidate.harm,durability:candidate.durability};
}
