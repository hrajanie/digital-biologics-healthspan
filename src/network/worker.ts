import {createCampaign,commitPlan,getView,previewPlan,projectOperations} from './engine';
import {parseSave,writeSave,replay} from './storage';
import type {State} from './types';
import {advanceTour} from './tour';
let state:State|null=null;
self.onmessage=(event:MessageEvent)=>{const {id,type,payload}=event.data;try{
 if(type==='new')state=createCampaign(payload.scenario,payload.seed);
 else if(type==='load'){const save=parseSave(payload);try{replay(save);}catch{throw Error('This campaign does not replay on the current build. Use the frozen build it was played on.');}state=save.state;}
 else if(!state)throw Error('Start or load a campaign first.');
 if(type==='preview'){self.postMessage({id,result:{preview:previewPlan(state!,payload??[])}});return;}
 if(type==='commit')state=commitPlan(state!,payload??[]);
 if(type==='tour'){const result=advanceTour(state!);state=result.state;self.postMessage({id,result:{view:getView(state),save:writeSave(state),tour:{stopReason:result.stopReason,delegatedActions:result.delegatedActions}}});return;}
 if(type==='run'){
  const initial=state!.events.filter(e=>e.major).length;
  for(let i=0;i<8&&state!.status==='active';i++){const p=projectOperations(state!);if(p.cashFlow<0&&state!.company.cash<-p.cashFlow*2)break;state=commitPlan(state!,[]);if(state.events.filter(e=>e.major).length>initial)break;}
 }
 self.postMessage({id,result:{view:getView(state!),save:writeSave(state!)}});
 }catch(e){self.postMessage({id,error:e instanceof Error?e.message:'The decision could not be resolved.'});}};
