import type {GameState,Program,Stage,StudyPackage} from './types';
import {clamp,random} from './random';
const phaseValue=(phase:Stage,values:Partial<Record<Stage,number>>,fallback:number)=>values[phase]??fallback;
export const PHASES:Stage[]=['preclinical','phase1','phase2','phase3','approved'];
export const STUDY_PACKAGES:Record<StudyPackage,{target:number;observation:number;cost:number;label:string}>={narrow:{target:.65,observation:0,cost:.7,label:'Narrow, focused population'},broad:{target:1.3,observation:2,cost:1.3,label:'Broad, multiple sites'},partner:{target:1,observation:1,cost:.65,label:'Partner network, royalty obligation'}};
export function nextPhase(p:Program):Stage{return p.stage==='preclinical'?'phase1':p.stage==='phase1'?'phase2':p.stage==='phase2'?'phase3':'approved';}
export function studyCost(p:Program,pkg:StudyPackage='narrow',state?:GameState):number {const n=nextPhase(p);const licensed=state?.company.contracts.some(c=>c.family==='therapy'&&c.programId===p.id&&c.start<=state.tick&&c.end>state.tick)??false;return Math.round(phaseValue(n,{phase1:90000000,phase2:280000000,phase3:650000000},0)*STUDY_PACKAGES[pkg].cost*(licensed?.8:1));}
export function studySpecification(state:GameState,p:Program,pkg:StudyPackage) {
 const phase=nextPhase(p),config=STUDY_PACKAGES[pkg];
 const target=Math.ceil(phaseValue(phase,{phase1:80,phase2:420,phase3:1600},80)*config.target);
 let observation=phaseValue(phase,{phase1:3,phase2:5,phase3:7},3)+config.observation;
 if(state.policy.stage==='personal'&&p.platformScope)observation=Math.max(2,observation-2);
 return {phase,target,observation,review:state.policy.stage==='personal'&&p.platformScope?1:2};
}
export function startStudy(state:GameState,p:Program,pkg:StudyPackage):void {
 const {phase,target,observation}=studySpecification(state,p,pkg);
 p.study={package:pkg,phase,readiness:p.readiness,enrolled:0,target,observation:0,observationRequired:observation,review:0,budget:studyCost(p,pkg,state),spent:studyCost(p,pkg,state),start:state.tick,paused:false,version:p.version,observedResponse:0,observedHarm:0};
 p.active=true;p.partnered=p.partnered||pkg==='partner';p.lastResult=`${phase} ${pkg} package commissioned; readiness and enrollment are pending.`;
 if(pkg==='partner')p.royalty=Math.min(.3,(p.royalty??0)+.025);
}
/** Called once per quarter after shared diagnostic, manufacturing and evidence allocation. */
export function progressStudy(state:GameState,p:Program,seats:number,readinessRate:number):{title:string;detail:string;complete:boolean}|null {
 const s=p.study;if(!s||s.paused)return null;
 if(s.readiness<1) {s.readiness=clamp(s.readiness+readinessRate);p.readiness=s.readiness;p.lastResult=`${s.phase}: site readiness ${Math.round(s.readiness*100)}%.`;return null;}
 if(s.enrolled<s.target) {s.enrolled=Math.min(s.target,s.enrolled+seats);p.lastResult=`${s.phase}: ${s.enrolled}/${s.target} enrolled; observation follows complete enrollment.`;return null;}
 if(s.observation<s.observationRequired) {
  s.observation++;
  const measured=s.observation/s.observationRequired;
  s.observedResponse=clamp(p.response+(random(state.seed,p.id,s.start,s.version,'response')-.5)*.2*Math.sqrt(80/Math.max(80,s.target)))*measured;
  const unexpectedSafety=random(state.seed,p.id,s.start,s.version,s.phase,'unexpected-safety')<.04;
  s.observedHarm=clamp(p.harm*(.7+random(state.seed,p.id,s.start,s.version,'harm')*.6)+(unexpectedSafety?.14:0))*measured;
  p.lastResult=`${s.phase}: observation ${s.observation}/${s.observationRequired} quarters; measured response ${Math.round(s.observedResponse*100)}%.`;
  return null;
 }
 s.review++;
 const reviewRequired=state.policy.stage==='personal'&&p.platformScope?1:2;
 if(s.review<reviewRequired){p.lastResult=`${s.phase}: regulatory review ${s.review}/${reviewRequired}.`;return null;}
 const response=s.observedResponse,harm=s.observedHarm;
 // Failures are observed endpoints, never a hidden result surfaced by previews.
 const passes=response>=.22&&harm<.13;
 if(!passes){s.paused=true;p.lastResult=`${s.phase} failed its observed benefit/harm criterion. Redesign or stop required.`;return{title:`${p.name}: study paused`,detail:`Observed response ${(100*response).toFixed(1)}%, harm ${(100*harm).toFixed(2)}%; progression blocked.`,complete:false};}
 p.response=clamp(p.response*.55+response*.45);p.harm=p.harm*.55+harm*.45;
 const evidenceMultiplier=s.package==='broad'?1.5:s.package==='partner'?1.2:1;p.evidence=clamp(p.evidence+phaseValue(s.phase,{phase1:.18,phase2:.3,phase3:.45},.2)*evidenceMultiplier);
 p.stage=s.phase==='phase3'?'approved':s.phase;p.study=null;p.readiness=.8;p.active=p.stage==='approved';
 p.lastResult=`${s.phase} passed; response ${(response*100).toFixed(1)}%, harm ${(harm*100).toFixed(2)}%. ${p.stage==='approved'?'Care initiation is authorized.':'CEO must choose the next package.'}`;
 return{title:`${p.name}: ${s.phase} complete`,detail:p.lastResult,complete:true};
}
