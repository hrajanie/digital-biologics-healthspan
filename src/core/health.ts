import type {Cohort,GameState,HealthScore,Program,Region} from './types';
import {clamp,random} from './random';
/** Fictional expected probability that an unfunded cohort obtains a portable continuing-care handoff. */
export const INSOLVENCY_HANDOFF_CONTINUATION=.55;
/** Permanent intervals identify disjoint residents. Projected access is never credited as company care. */
export function initiateCohort(state:GameState,region:Region,program:Program,count:number):Cohort {
 const id=`${region.id}:${program.id}:${state.tick}`;
 const age=46+Math.floor(random(state.seed,id,'age')*17);
 // The estimator uses currently measured program evidence; future quarterly outcomes are drawn only as experienced.
 const response=program.response,annualGain=Math.max(0,program.benefit/7.5)*response;
 const harm=clamp(program.harm*(.8+random(state.seed,id,'observed-acute-harm')*.4),0,.25);
 return{id,profileId:`${region.id}:residents:${region.treated}-${region.treated+count}`,regionId:region.id,programId:program.id,count,start:state.tick,age,version:program.version,response,durability:-1/Math.log(clamp(program.durability,.2,.98)),annualGain,harm,continuity:1,experienced:-count*harm*8,remaining:0,baselineDelay:Math.max(2,14*(1-state.world.counterfactualAccess)),alive:count,history:[`Actual care began ${state.year} Q${state.quarter}; ${count.toLocaleString()} unique residents.`]};
}
export function quarterlySurvival(age:number):number {return Math.pow(1-clamp(.007*Math.exp((age-45)/22),.004,.7),.25);}
/** One time-from-initiation curve drives both transferred experience and the future tail. */
export function expectedQuarterGain(c:Cohort,elapsedYears:number,alive:number,counterfactualAccess:number):number {
 const durable=Math.exp(-elapsedYears/Math.max(1,c.durability));
 const comparatorDelay=Math.max(1.4,c.baselineDelay*(1-counterfactualAccess*.45));
 const incremental=Math.exp(-elapsedYears/comparatorDelay);
 const continuedCare=Math.pow(clamp(c.continuity,.02,1),1+elapsedYears);
 return alive*c.annualGain*durable*incremental*continuedCare/4;
}
export function projectLifetime(c:Cohort,state:GameState,quarters=240):{value:number;tailBound:number} {
 const elapsed=Math.max(0,(state.tick-c.start)/4);let alive=c.alive,value=0;
 for(let q=0;q<quarters;q++){const t=elapsed+q/4;value+=expectedQuarterGain(c,t,alive,state.world.counterfactualAccess);alive*=quarterlySurvival(c.age+t);}
 const t=elapsed+quarters/4,next=expectedQuarterGain(c,t,alive,state.world.counterfactualAccess);
 const delay=Math.max(1.4,c.baselineDelay*(1-state.world.counterfactualAccess*.45));
 // Mortality rises with age; all other factors decay exponentially. This geometric tail therefore bounds omitted benefit.
 const ratio=quarterlySurvival(c.age+t)*Math.exp(-.25/Math.max(1,c.durability)-.25/delay)*Math.pow(clamp(c.continuity,.02,1),.25);
 const fundedContinuation=state.status==='insolvent'?INSOLVENCY_HANDOFF_CONTINUATION:1;
 return{value:value*fundedContinuation,tailBound:next/Math.max(1e-12,1-ratio)*fundedContinuation};
}
export function remainingLifetime(c:Cohort,state:GameState):number{return projectLifetime(c,state).value;}
export function ageCohorts(state:GameState,followupByRegion:Map<string,number>):void {
 for(const c of state.cohorts){
  const observedFollowup=followupByRegion.get(c.regionId)??0;c.continuity=clamp(c.continuity*.985+observedFollowup*.015,.1,1);
  const elapsed=Math.max(0,(state.tick-c.start)/4);
  const estimated=expectedQuarterGain(c,elapsed,c.alive,state.world.counterfactualAccess);
  // This independent measured-quarter draw is not evaluated by previews or lifetime projection.
  const measuredFactor=.98+random(state.seed,c.id,state.tick,'experienced-response')*.04;
  c.experienced+=estimated*measuredFactor;c.alive*=quarterlySurvival(c.age+elapsed);
 }
}
export function scoreHealth(state:GameState):HealthScore {
 let experienced=-state.outsideHarm,remaining=0,people=0,tailError=0;
 for(const c of state.cohorts){const projection=projectLifetime(c,state);c.remaining=projection.value;experienced+=c.experienced;remaining+=c.remaining;tailError+=projection.tailBound;people+=c.count;}
 if(Math.abs(experienced+remaining-1e9)<Math.max(tailError*5,1e7)){
  remaining=0;tailError=0;for(const c of state.cohorts){const projection=projectLifetime(c,state,480);c.remaining=projection.value;remaining+=c.remaining;tailError+=projection.tailBound;}
 }
 return{expected:experienced+remaining,experienced,remaining,outsideHarm:state.outsideHarm,low:experienced+remaining*.65,high:experienced+remaining*1.3,people,worldwide:state.regions.reduce((n,r)=>n+r.population,0),tailError};
}
