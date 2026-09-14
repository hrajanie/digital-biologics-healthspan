import {describe,it,expect} from 'vitest';
import {candidateFor,makeCareLot,scoreCohorts,advanceHealth,studyResult,worldAt} from '../src/flow/science';
import {createCampaign} from '../src/flow/engine';
import type {Study} from '../src/flow/types';
const study=(generation=0):Study=>({id:'immune-v0',productId:'immune-reset',generation,mode:'own',started:0,stage:'analysis',preparationLeft:0,target:40,enrolled:40,observationMonths:6,observed:6,analysisLeft:0,totalBudget:1_200_000_000,dbBudget:1_200_000_000,paid:1_200_000_000,installments:11,response:null,harm:null,candidate:candidateFor('immune-reset',generation)});
describe('fictional biology and protected healthspan',()=>{
 it('AI improves fixed and personalized response, durability, annual benefit and safety directly',()=>{for(const id of ['immune-reset','cancer-vaccine'] as const){for(let g=1;g<=3;g++){const a=candidateFor(id,g-1),b=candidateFor(id,g);expect(b.response).toBeGreaterThan(a.response);expect(b.durability).toBeGreaterThan(a.durability);expect(b.annualGain).toBeGreaterThan(a.annualGain);expect(b.harm).toBeLessThan(a.harm);}}});
 it('stronger therapies add substantially more expected net healthspan for actual initiated people',()=>{const expected=(g:number)=>{const s=createCampaign();const p=s.products[1];p.authorized=candidateFor(p.id,g);s.cohorts=[makeCareLot(s,p,100,null)];return scoreCohorts(s).expected;};expect(expected(3)).toBeGreaterThan(expected(0)*4);});
 it('new AI, policy and empty infrastructure earn zero patient benefit',()=>{const s=createCampaign();s.world=worldAt(18,'fast');s.policy.accepted=true;s.network.clinic=10000;expect(scoreCohorts(s).expected).toBe(0);});
 it('experienced and remaining benefits reconcile, and acute harm is debited exactly once',()=>{const s=createCampaign();const lot=makeCareLot(s,s.products[0],100,null);s.cohorts=[lot];expect(lot.experienced).toBe(-100*.018*2.5);advanceHealth(s,1);const first=s.cohorts[0].experienced;s.month++;advanceHealth(s,1);expect(s.cohorts[0].experienced).toBeGreaterThan(first);expect(s.health.expected).toBe(s.health.experienced+s.health.remaining);});
 it('a stronger improving outside world reduces DB-attributable lifetime benefit',()=>{const s=createCampaign();s.cohorts=[makeCareLot(s,s.products[0],100,null)];const before=scoreCohorts(s).expected;s.world.outsideAccess=.95;s.world.biology=1.5;expect(scoreCohorts(s).expected).toBeLessThan(before);});
 it('counts people once, excludes post2050 starts, and bounds the omitted mortality tail',()=>{const s=createCampaign();const lot=makeCareLot(s,s.products[0],100,null);s.cohorts=[lot,structuredClone(lot),{...lot,id:'future',startMonth:288}];s.month=288;const score=scoreCohorts(s);expect(score.people).toBe(100);expect(score.tailError).toBeLessThan(.001);expect(()=>makeCareLot(s,s.products[0],1,null)).toThrow(/2050/);});
 it('clinical readouts are deterministic and genuinely can fail',()=>{const t=study();expect(studyResult(t,2027)).toEqual(studyResult({...t,started:9,id:'different-click-order'},2027));const outcomes=Array.from({length:100},(_,seed)=>studyResult(t,seed).passed);expect(outcomes.some(Boolean)).toBe(true);expect(outcomes.some(x=>!x)).toBe(true);});
 it('cannot read a study early by adding enrollment capacity',()=>{expect(()=>studyResult({...study(),observed:5},1)).toThrow(/observation/);expect(()=>studyResult({...study(),analysisLeft:1},1)).toThrow(/analysis/);});
 it('protecting follow-up changes realized benefit rather than creating duplicate people',()=>{const s=createCampaign();s.cohorts=[makeCareLot(s,s.products[0],100,null)];const supported=structuredClone(s),missed=structuredClone(s);for(let i=0;i<5;i++){advanceHealth(supported,1);advanceHealth(missed,0);supported.month++;missed.month++;}expect(supported.health.expected).toBeGreaterThan(missed.health.expected);expect(supported.health.people).toBe(missed.health.people);});
 it('keeps negative opportunity cost during required treatment instead of silently granting a free switch',()=>{
  const s=createCampaign();s.world.outsideAccess=.95;s.world.biology=1.5;
  const lot=makeCareLot(s,s.products[0],100,null);lot.candidate={...lot.candidate,response:.02,annualGain:.1,harm:0};lot.experienced=0;s.cohorts=[lot];
  advanceHealth(s,1);expect(s.cohorts[0].experienced).toBeLessThan(0);
 });
 it('after required follow-up, switching depends on outside access and never refunds earlier harms',()=>{
  const s=createCampaign();const lot=makeCareLot(s,s.products[0],100,null);lot.candidate={...lot.candidate,response:.02,annualGain:.1,harm:.1};lot.experienced=-25;s.cohorts=[lot];s.month=6;
  const accessible=structuredClone(s),inaccessible=structuredClone(s);accessible.world.outsideAccess=.95;accessible.world.biology=1.5;inaccessible.world.outsideAccess=0;inaccessible.world.biology=1.5;
  const low=scoreCohorts(accessible),high=scoreCohorts(inaccessible);
  expect(low.remaining).toBeGreaterThanOrEqual(0);expect(high.remaining).toBeGreaterThan(low.remaining);expect(low.experienced).toBe(-25);expect(low.expected).toBeLessThan(0);
  expect(low.people).toBe(100);
 });

});
