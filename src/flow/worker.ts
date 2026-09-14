import {createCampaign,commitPlan,advanceMonth,runToNextDecision,getView,previewPlan} from './engine';
import {parseSave,replay,writeSave} from './storage';
import {investorPosition} from './economy';
import type {State} from './types';
let state:State|null=null;
self.onmessage=({data}:MessageEvent)=>{const {id,type,payload}=data;try{
 const previous=state?.events.length??0;
 if(type==='new')state=createCampaign(payload?.scenario??'fast',payload?.seed??2027);
 else if(type==='load'){const save=parseSave(payload);replay(save);state=save.state;}
 else if(!state)throw Error('Start or import a treatment-route campaign first.');
 if(type==='preview'){self.postMessage({id,result:{preview:previewPlan(state!,payload??[])}});return;}
 if(type==='investor'){const view=getView(state!);const value=payload.basis==='venture'?{...view.value,equity:view.quote.preMoney,low:view.quote.preMoney,high:view.quote.preMoney}:view.value;self.postMessage({id,result:{position:investorPosition(state!,value,payload.roundId,payload.check)}});return;}
 if(type==='plan')state=commitPlan(state!,payload??[]);
 if(type==='plan-run'){const committed=commitPlan(state!,payload??[]);state=runToNextDecision(committed);}
 if(type==='run')state=runToNextDecision(state!);
 if(type==='month')state=advanceMonth(state!);
 self.postMessage({id,result:{view:getView(state!),save:writeSave(state!),news:['new','load'].includes(type)?[]:state!.events.slice(previous)}});
 }catch(error){self.postMessage({id,error:error instanceof Error?error.message:'The decision could not be resolved.'});}};
