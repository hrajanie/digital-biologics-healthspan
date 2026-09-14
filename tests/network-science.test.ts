import {describe,expect,it} from 'vitest';
import {advanceHealth,benefitEstimate,candidateFor,initialPrograms,makeCohort,scoreCohorts,studyResult,studySpec,worldAt} from '../src/network/science';
import type {Facility,Policy,Program,State,Study} from '../src/network/types';

const policy:Policy={support:0,stage:'product',campaignSpend:0,window:0,nextWindow:4,pendingStage:null,effectiveAt:0,recognized:false};
const site:Facility={id:'clinic',name:'Riverside Clinic',kind:'clinic',region:0,x:0,y:0,owner:'db',status:'operating',units:1,capacity:200,employees:10,basis:50000000,readyAt:0,delivery:'clinic',programId:'standard-autoimmune',trialTeam:true,lastStarts:0,lastFollowup:0,lastRevenue:0,lastCosts:0,limiting:'Medicine',description:'Treats and follows up patients.'};
function state():State {
  return {version:'network-2.2',seed:19,scenario:'convergence',tick:0,status:'active',company:{cash:180000000,credits:0,debt:0,revenue:0,expenses:0,capex:0,taxes:0,royalty:0,founderSeats:2,strategicControl:true,ceo:true,control:'retained',cureQuarter:null,classes:[],rounds:[],contracts:[],priority:'balanced',totalRevenue:0,totalSpend:0,lastRevenue:0,lastExpenses:0},facilities:[{...site}],links:[],regions:[{id:0,name:'Riverside',population:1000000,treated:0,waiting:1000,arrivals:0,jurisdiction:0,access:.25}],programs:initialPrograms(),world:worldAt(0,'convergence',19),policy:{...policy},cohorts:[],health:{expected:0,experienced:0,remaining:0,people:0,low:0,high:0,tailError:0},projects:[],events:[],account:{tick:0,starts:0,followup:0,revenue:0,costs:0,payroll:0,supplies:0,research:0,central:0,cashFlow:0,employees:10,partnerEmployees:0,healthAdded:0},accounts:[],commands:[],historicalFollowup:0,creditsUsed:0,publicCompany:false,partnerships:[],cureUntil:null};
}
function completeStudy(program:Program,generation=program.candidate.generation,pkg:Study['package']='focused'):Study {
  const spec=studySpec(program,worldAt(0,'convergence',19),policy,pkg);
  return {...spec,siteId:site.id,generation,package:pkg,started:0,preparation:0,enrolled:spec.target,observed:spec.observation,review:0,paused:false,failed:false,response:null,harm:null};
}
function treatedState(id='standard-autoimmune',generation=0,count=100):State {
  const s=state(),p=s.programs.find(x=>x.id===id)!;
  p.candidate=candidateFor(id,generation);p.authorizedCandidate={...p.candidate};p.authorizedGeneration=generation;p.stage='approved';
  s.cohorts=[makeCohort(s,site,p,count)];return s;
}

describe('AI directly improves both fixed and personalized therapy benefit',()=>{
  it('has six concrete programs, including fixed medicines, personalized vaccine and Aspis',()=>{
    const p=initialPrograms();
    expect(p).toHaveLength(6);expect(p.filter(x=>x.kind==='fixed')).toHaveLength(3);
    expect(p.find(x=>x.id==='standard-autoimmune')?.stage).toBe('approved');
    expect(p.find(x=>x.id==='immune-reset')?.stage).toBe('preclinical');
    expect(p.find(x=>x.id==='aspis')?.description).toContain('makes and delivers');
  });
  for(const id of ['standard-autoimmune','immune-reset','neural-repair','cancer-vaccine','cell-repair','aspis']) {
    it(`${id}: stronger candidates improve response, gain, durability, safety and lifetime benefit`,()=>{
      const world=worldAt(30,'convergence',19),early=candidateFor(id,0),late=candidateFor(id,8);
      const a=benefitEstimate(early,world),b=benefitEstimate(late,world);
      expect(late.response).toBeGreaterThan(early.response);expect(late.annualGain).toBeGreaterThan(early.annualGain);
      expect(late.durability).toBeGreaterThan(early.durability);expect(late.harm).toBeLessThan(early.harm);
      expect(b.gross).toBeGreaterThan(a.gross*3);expect(b.incremental).toBeGreaterThan(a.incremental+.75);
    });
  }
  it('does not auto-upgrade an authorized fixed therapy or an existing patient cohort',()=>{
    const s=treatedState('immune-reset',0),before=structuredClone(s.cohorts[0].candidate);
    s.world=worldAt(90,s.scenario,s.seed);s.programs.find(p=>p.id==='immune-reset')!.frontier=candidateFor('immune-reset',8);
    const result=advanceHealth(s,{clinic:1});
    expect(result.cohorts[0].candidate).toEqual(before);expect(s.cohorts[0].candidate).toEqual(before);
    expect(s.programs.find(p=>p.id==='immune-reset')!.authorizedCandidate).toEqual(before);
  });
  it('starting earlier creates experienced benefit while waiting produces none',()=>{
    const early=treatedState('immune-reset',0),waiting=state();
    const started=advanceHealth(early,{clinic:1});
    expect(started.health.experienced).not.toBe(0);expect(advanceHealth(waiting,{}).health.expected).toBe(0);
    // A poor early candidate may cause initial harm; waiting avoids that harm but forfeits all early treatment opportunities.
    let running=early;
    for(let q=0;q<8;q++){const resolved=advanceHealth(running,{clinic:1});running={...running,tick:running.tick+1,...resolved};}
    expect(running.health.experienced).toBeGreaterThan(0);
  });
});

describe('world information and policy do not manufacture biological efficacy',()=>{
  it('releases eight substantive advances through2050, with uncertain public signals',()=>{
    for(const scenario of ['convergence','staggered'] as const){
      const a=worldAt(0,scenario,19),b=worldAt(96,scenario,19);
      expect(a.generation).toBe(0);expect(b.generation).toBe(8);expect(b.releases).toHaveLength(8);
      expect(b.compute).toBeGreaterThan(a.compute*10000);expect(b.wearables).toBe(true);expect(b.homeMakers).toBe(true);
      expect(a.nextSignal).toContain('not a scheduled unlock');expect(a.nextSignal).not.toMatch(/20\d\d|Q[1-4]/);
    }
  });
  it('pins release timing to seed and scenario without revealing hidden dates',()=>{
    const transcript=(seed:number,scenario:'convergence'|'staggered')=>Array.from({length:97},(_,q)=>worldAt(q,scenario,seed).generation);
    expect(transcript(19,'convergence')).toEqual(transcript(19,'convergence'));
    expect(transcript(19,'convergence')).not.toEqual(transcript(20,'convergence'));
    expect(transcript(19,'convergence')).not.toEqual(transcript(19,'staggered'));
  });
  it('keeps the focused Phase1 fixture to six quarters with one enrollment quarter',()=>{
    const s=state(),p=s.programs.find(p=>p.id==='immune-reset')!,spec=studySpec(p,s.world,s.policy,'focused');
    expect(spec).toEqual({phase:'phase1',target:24,preparation:1,observation:3,review:1,cost:90000000});
    expect(spec.preparation+1+spec.observation+spec.review).toBe(6);
    expect(studySpec(p,s.world,s.policy,'broad').target).toBeGreaterThan(spec.target);
  });
  it('accepted predictions can replace specific later observations but not Phase1 safety or candidate biology',()=>{
    const s=state(),p=s.programs.find(p=>p.id==='cancer-vaccine')!;p.candidate=candidateFor(p.id,8);p.stage='phase2';
    const world=worldAt(96,s.scenario,s.seed),candidate=structuredClone(p.candidate);
    const conventional=studySpec(p,world,policy,'focused');
    const personalized=studySpec(p,world,{...policy,stage:'personal'},'focused');
    expect(personalized.observation).toBeLessThan(conventional.observation);expect(personalized.target).toBeLessThan(conventional.target);
    expect(personalized.cost).toBeLessThan(conventional.cost);expect(p.candidate).toEqual(candidate);
    p.stage='preclinical';expect(studySpec(p,world,policy,'focused')).toEqual(studySpec(p,world,{...policy,stage:'personal'},'focused'));
  });
});

describe('trial readouts are outcome-dependent and reproducible',()=>{
  it('cannot return a readout before observations and review are complete',()=>{
    const p=initialPrograms()[1],study=completeStudy(p);
    for(const altered of [{...study,enrolled:23},{...study,observed:2},{...study,preparation:1},{...study,review:1},{...study,paused:true}])expect(()=>studyResult(p,altered,17)).toThrow('not ready');
  });
  it('does not reroll through previews, repeated calls, reloads or unrelated state',()=>{
    const p=initialPrograms()[1],study=completeStudy(p),first=studyResult(p,study,17);
    for(let i=0;i<20;i++)benefitEstimate(candidateFor('neural-repair',i%9),worldAt(i,'convergence',17));
    expect(studyResult(JSON.parse(JSON.stringify(p)),JSON.parse(JSON.stringify(study)),17)).toEqual(first);
    expect(studyResult({...p,lastResult:'An unrelated interface description changed'},study,17)).toEqual(first);
  });
  it('can fail as well as succeed; completing a study does not award healthspan',()=>{
    const p=initialPrograms()[1],study=completeStudy(p),s=state();
    const results=Array.from({length:160},(_,seed)=>studyResult(p,study,seed));
    expect(results.some(r=>r.passes)).toBe(true);expect(results.some(r=>!r.passes)).toBe(true);
    expect(results.every(r=>r.response>=0&&r.response<=1&&r.harm>=0&&r.harm<=1)).toBe(true);
    expect(scoreCohorts(s).expected).toBe(0);
  });
});

describe('healthspan, initiation and continuing care accounting',()=>{
  it('increasing outside access lowers incremental credit while gross therapy benefit remains unchanged',()=>{
    const c=candidateFor('immune-reset',8),w=worldAt(80,'convergence',19);
    const little=benefitEstimate(c,{...w,counterfactualAccess:.05}),much=benefitEstimate(c,{...w,counterfactualAccess:.90});
    expect(much.gross).toBe(little.gross);expect(much.incremental).toBeLessThan(little.incremental);
    expect(much.incremental).toBeLessThan(much.gross);
  });
  it('continues improving alternatives after2050 and adds no new future customers',()=>{
    const s=treatedState('immune-reset',8);s.tick=95;s.world=worldAt(95,s.scenario,s.seed);s.cohorts=[makeCohort(s,site,s.programs[1],100)];
    const a=scoreCohorts(s),future=worldAt(176,s.scenario,s.seed);
    expect(future.counterfactualAccess).toBeGreaterThan(s.world.counterfactualAccess);
    expect(scoreCohorts({...s,world:future}).remaining).toBeLessThan(a.remaining);
    expect(()=>makeCohort({...s,tick:96},site,s.programs[1],100)).toThrow('after 2050');
    expect(scoreCohorts({...s,tick:176}).people).toBe(100);
  });
  it('uses regional resident intervals and never scores duplicate cohort records twice',()=>{
    const s=treatedState();s.regions[0].treated=100;
    const next=makeCohort(s,site,s.programs[0],80);
    expect(s.cohorts[0].id).toBe('residents:0:0:100');expect(next.id).toBe('residents:0:100:180');
    const a=scoreCohorts(s),b=scoreCohorts({...s,cohorts:[...s.cohorts,structuredClone(s.cohorts[0])]});expect(b).toEqual(a);
    s.regions[0].population=110;expect(makeCohort(s,site,s.programs[0],80).count).toBe(10);
  });
  it('transfers acute harm from remaining to experienced exactly once',()=>{
    const s=treatedState('immune-reset',0),harm=s.cohorts[0].count*s.cohorts[0].candidate.harm*2.5;
    const noHarm=structuredClone(s);noHarm.cohorts[0].candidate.harm=0;
    const before=scoreCohorts(s),beforeNoHarm=scoreCohorts(noHarm);
    expect(beforeNoHarm.remaining-before.remaining).toBeCloseTo(harm,10);
    const after=advanceHealth(s,{clinic:1}),afterNoHarm=advanceHealth(noHarm,{clinic:1});
    expect(afterNoHarm.health.remaining-after.health.remaining).toBeCloseTo(0,10);
    expect(afterNoHarm.health.experienced-after.health.experienced).toBeCloseTo(harm,10);
    expect(after.health.expected).toBe(after.health.experienced+after.health.remaining);
    const twice=advanceHealth({...s,tick:1,cohorts:after.cohorts},{clinic:1}),twiceNoHarm=advanceHealth({...noHarm,tick:1,cohorts:afterNoHarm.cohorts},{clinic:1});
    expect(twiceNoHarm.health.experienced-twice.health.experienced).toBeCloseTo(harm,10);
  });
  it('is pure, preserves mortality and loses benefit when continuing care is unfunded',()=>{
    const s=treatedState('immune-reset',8),before=JSON.stringify(s);
    const funded=advanceHealth(s,{clinic:1}),unfunded=advanceHealth(s,{clinic:0});
    expect(JSON.stringify(s)).toBe(before);expect(funded.cohorts[0].alive).toBeLessThan(100);
    expect(unfunded.health.expected).toBeLessThan(funded.health.expected);
    expect(funded.cohorts[0].followupRemaining).toBe(15);
    expect(funded.health.tailError).toBeLessThan(.000001);
    expect(funded.health.low).toBeLessThanOrEqual(funded.health.expected);expect(funded.health.high).toBeGreaterThanOrEqual(funded.health.expected);
  });
  it('ends a monitoring schedule without treating it as a cure or removing future attrition',()=>{
    const s=treatedState('immune-reset',8);s.tick=16;s.cohorts[0].followupRemaining=0;
    const a=scoreCohorts(s),b=scoreCohorts({...s,world:{...s.world,counterfactualAccess:.9,biology:1.75}});
    expect(a.remaining).toBeGreaterThan(0);expect(b.remaining).toBeLessThan(a.remaining);
    const short={...s,cohorts:[{...s.cohorts[0],candidate:{...s.cohorts[0].candidate,durability:1}}]};
    expect(scoreCohorts(short).remaining).toBeLessThan(a.remaining);
  });
});
