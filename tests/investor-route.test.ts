import {describe,expect,it} from 'vitest';
import {createCampaign,commitPlan,advanceQuarter} from '../src/core/engine';
import {INVESTOR_ROUTE,INVESTOR_STOPS,investorStopState,nextInvestorStop} from '../src/core/investor';

describe('investor route planning stops',()=>{
  it('pins six planning windows and the introductory world',()=>{
    expect(INVESTOR_ROUTE).toEqual({scenario:'convergence',seed:2027});
    expect(INVESTOR_STOPS).toEqual([2027,2028,2031,2035,2042,2048]);
  });
  it('cannot skip the opening annual decision',()=>{
    const state=createCampaign('convergence',2027,'investor');
    expect(investorStopState(state)).toMatchObject({currentStop:2027,requiresCommit:true,canDelegate:false,nextStop:2027});
    expect(nextInvestorStop(state)).toBe(2027);
  });
  it('targets 2028 immediately after the ordinary 2027 commitment',()=>{
    const state=commitPlan(createCampaign('convergence',2027,'investor'),[{type:'wait'},{type:'wait'}]);
    expect(investorStopState(state)).toMatchObject({commitmentRecorded:true,requiresCommit:false,canDelegate:true,nextStop:2028});
  });
  it('requires a new manual commitment at 2028, then targets 2031',()=>{
    let state=commitPlan(createCampaign('convergence',2027,'investor'),[{type:'wait'},{type:'wait'}]);
    for(let quarter=0;quarter<4;quarter++)state=advanceQuarter(state);
    expect(state.year).toBe(2028);
    expect(investorStopState(state)).toMatchObject({requiresCommit:true,canDelegate:false,nextStop:2028});
    state=commitPlan(state,[{type:'wait'},{type:'wait'}]);
    expect(nextInvestorStop(state)).toBe(2031);
  });
  it.each(INVESTOR_STOPS)('a delegated plan cannot discharge the %s CEO decision',(year)=>{
    const state=createCampaign('convergence',2027,'investor');
    state.year=year;state.tick=(year-2027)*4;state.delegated=true;
    const committed=commitPlan(state,[{type:'wait'},{type:'wait'}]);
    expect(investorStopState(committed)).toMatchObject({requiresCommit:true,canDelegate:false,nextStop:year});
  });
  it('can delegate between scheduled decisions without pretending a stop happened',()=>{
    const state=createCampaign('convergence',2027,'investor');
    state.year=2033;state.tick=24;
    expect(investorStopState(state)).toMatchObject({currentStop:null,briefYear:2031,requiresCommit:false,canDelegate:true,nextStop:2035});
  });
  it('targets the end after the 2048 commitment',()=>{
    const state=createCampaign('convergence',2027,'investor');
    state.year=2048;state.tick=84;
    const committed=commitPlan(state,[{type:'wait'},{type:'wait'}]);
    expect(nextInvestorStop(committed)).toBe(2051);
    expect(investorStopState(committed).canDelegate).toBe(true);
  });
  it('never advances or mutates the campaign while computing the route',()=>{
    const state=createCampaign('convergence',2027,'investor');
    const before=structuredClone(state);
    investorStopState(state);nextInvestorStop(state);
    expect(state).toEqual(before);
  });
  it('disables delegation at a terminal outcome, including control loss in a stop year',()=>{
    const state=createCampaign('convergence',2027,'investor');
    state.phase='ended';state.status='control-loss';
    expect(investorStopState(state)).toMatchObject({requiresCommit:false,canDelegate:false,nextStop:2051});
  });
});
