import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {createCampaign,commitPlan,advanceMonth,runToNextDecision,getView} from '../src/flow/engine';
import {writeSave,replay,parseSave} from '../src/flow/storage';
import type {Scenario,State} from '../src/flow/types';
fs.mkdirSync('artifacts/flow-release',{recursive:true});
const rows:unknown[]=[];
for(const scenario of ['fast','measured'] as Scenario[])for(const seed of [2027,39,481,9071])for(const strategy of ['early-owned','partner-funded','wait-for-design']){
 const start=performance.now();let s=advanceMonth(commitPlan(createCampaign(scenario,seed),[{type:'raise',amount:5e9},{type:'license'},{type:'trial-team'},{type:'hire',people:8}]));
 if(strategy==='wait-for-design'){
  while(s.world.generation===0&&s.status==='active')s=advanceMonth(s);
  s=advanceMonth(commitPlan(s,[{type:'lab-partnership'},{type:'update',productId:'immune-reset',choice:'parallel'}]));
 }
 s=commitPlan(s,[{type:'start-study',productId:'immune-reset',mode:strategy==='partner-funded'?'codevelop':'own'}]);
 let stops=0;while(s.status==='active'&&stops++<30)s=runToNextDecision(s);
 const v=getView(s);const saved=writeSave(s);replay(parseSave(JSON.stringify(saved)));
 const study=s.products[1].studies.at(-1)!;
 rows.push({scenario,seed,strategy,month:s.month,status:s.status,readout:study.stage,generation:study.generation,response:study.response,harm:study.harm,people:s.health.people,healthspan:s.health.expected,cashUSD:s.company.cash/100,preMoneyUSD:v.quote.preMoney/100,stops,elapsedMs:Math.round(performance.now()-start),saveBytes:JSON.stringify(saved).length});
}
fs.writeFileSync('artifacts/flow-release/strategy-benchmark.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(rows,null,2));

// Pinned legal failure/AI fixtures for cross-runtime browser import checks.
let failure=advanceMonth(commitPlan(createCampaign('fast',1),[{type:'raise',amount:5e9},{type:'license'},{type:'trial-team'},{type:'hire',people:8}]));
failure=commitPlan(failure,[{type:'start-study',productId:'immune-reset',mode:'own'}]);
while(failure.month<11)failure=advanceMonth(failure);
fs.writeFileSync('artifacts/flow-release/before-failed-readout.json',JSON.stringify(writeSave(failure)));
let ai=advanceMonth(commitPlan(createCampaign('fast',2027),[{type:'raise',amount:5e9},{type:'license'},{type:'trial-team'},{type:'hire',people:8}]));
ai=commitPlan(ai,[{type:'start-study',productId:'immune-reset',mode:'own'}]);while(ai.month<4)ai=advanceMonth(ai);
fs.writeFileSync('artifacts/flow-release/ai-decision.json',JSON.stringify(writeSave(ai)));
let insolvent=createCampaign();while(insolvent.status==='active')insolvent=advanceMonth(insolvent);
fs.writeFileSync('artifacts/flow-release/insolvent.json',JSON.stringify(writeSave(insolvent)));
