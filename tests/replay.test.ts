import {describe,it,expect} from 'vitest';
import {createCampaign,commitPlan,advanceQuarter,autoPlan,previewPlan,checksum} from '../src/core/engine';
import {replayCampaign} from '../src/runtime/replay';
import {parseSave} from '../src/runtime/storage';
describe('pinned campaign replay',()=>{
 // This exercises an entire 96-quarter campaign and replay; allow for slower CI runners.
 it('replays the same legal transcript through 2050',()=>{
  let s=createCampaign('convergence',9031);
  for(let year=0;year<24&&s.status==='active';year++){
   const plan=autoPlan(s);const before=checksum(s);
   previewPlan(s,plan);previewPlan(s,[{type:'wait'},{type:'wait'}]);
   expect(checksum(s)).toBe(before);
   s=commitPlan(s,plan);
   for(let q=0;q<4&&s.phase==='resolving';q++)s=advanceQuarter(s);
  }
  const result=replayCampaign(structuredClone(s));
  expect(result.actual).toBe(result.expected);
 },15000);
 it('restores a pending annual plan without applying it twice',()=>{
  const state=createCampaign('staggered',42);
  const save=parseSave({format:'healthspan-save',version:1,savedAt:'fixture',checksum:checksum(state),state,pending:[{type:'build',regionId:state.regions[0].id,family:'clinic'}]});
  expect(save.state.trace).toHaveLength(0);
  expect(save.pending).toHaveLength(1);
  expect(replayCampaign(save.state).matches).toBe(true);
 });
 it('preserves saves in the middle of a resolving year',()=>{
  let s=commitPlan(createCampaign('convergence',13),[{type:'wait'},{type:'wait'}]);
  expect(replayCampaign(s).matches).toBe(true);
  s=advanceQuarter(s);expect(replayCampaign(s).matches).toBe(true);
 });
 it('refuses version drift and illegal historical decisions',()=>{
  const s=createCampaign();s.engineVersion='unsupported';
  expect(()=>replayCampaign(s)).toThrow(/original/);
  const invalid=commitPlan(createCampaign(),[{type:'wait'},{type:'wait'}]);invalid.trace[0].actions=[{type:'wait'}];
  expect(()=>replayCampaign(invalid)).toThrow(/two/);
 });
});
