import {createCampaign,validatePlan,previewPlan,commitPlan,advanceQuarter,getView,checksum,delegatePlan,plannedOptions,availableOptions} from '../core/engine';
import type {GameState,Action,ScenarioId,Mode} from '../core/types';
import {parseSave,writeSave} from './storage';
import {investorStopState,nextInvestorStop} from '../core/investor';
let state:GameState|null=null;
self.onmessage=async(e:MessageEvent)=>{const {id,type,payload}=e.data;try{
 let notice:string|undefined;
 if(type==='new'){state=createCampaign(payload.scenario as ScenarioId,payload.seed,payload.mode as Mode);}
 else if(type==='load'){const save=parseSave(payload);if(checksum(save.state)!==save.checksum)throw new Error('This save has changed since it was recorded.');const fresh=createCampaign(save.state.scenario,save.state.seed,save.state.mode);if(save.state.engineVersion!==fresh.engineVersion||save.state.contentVersion!==fresh.contentVersion)throw new Error('This save belongs to a different game build. Keep the original build to replay it.');state=save.state;}
 else {if(!state)throw new Error('Start or load a campaign first.');
  let current:GameState=state;
  if(type==='export'){self.postMessage({id,result:{exported:JSON.stringify({format:'healthspan-save',version:1,savedAt:new Date().toISOString(),checksum:checksum(current),state:current,pending:payload.pending})}});return;}
  if(type==='persist'){const currentHash=checksum(current);if(currentHash===payload.expected)await writeSave({format:'healthspan-save',version:1,savedAt:new Date().toISOString(),checksum:currentHash,state:current,pending:payload.pending},payload.key??'autosave');self.postMessage({id,result:{}});return;}
  if(type==='preview'){self.postMessage({id,result:{preview:previewPlan(current,payload as Action[]),options:plannedOptions(current,payload as Action[])}});return;}
  if(type==='commit'){const check=validatePlan(current,payload);if(!check.valid)throw new Error(check.reasons.join(' '));current=commitPlan(current,payload);}
  if(type==='advance')current=advanceQuarter(current);
  if(type==='mode')current={...current,mode:payload};
  if(type==='delegate'){
   const route=investorStopState(current);if(current.mode!=='investor'||!route.canDelegate)throw new Error(route.reason);const target=nextInvestorStop(current),fromYear=current.year;
   const institutional=()=>availableOptions(current).filter(o=>o.available&&o.action.type==='policy'&&['charter','platform','recognition'].includes(o.action.operation));
   const knownOpportunities=new Set(institutional().map(o=>o.id));
   let guard=0,interruption='',saveWarning='';
   do{if(current.phase==='planning'){
     const annualBurn=Math.max(0,(current.company.lastExpenses-current.company.lastRevenue)*4);
     if(current.company.cash<Math.max(150000000,annualBurn*1.25)){interruption='Cash needs your attention before further commitments.';break;}
     if(current.programs.some(p=>p.study?.paused)){interruption='A paused study needs your decision before routine work continues.';break;}
     const actions=delegatePlan(current);current=commitPlan({...current,delegated:true},actions);}
    current=advanceQuarter(current);guard++;
    try{await writeSave({format:'healthspan-save',version:1,savedAt:new Date().toISOString(),checksum:checksum(current),state:current,pending:[]});}catch{saveWarning=' Local autosave was unavailable; export this campaign to preserve it.';}
    if(current.status!=='active')break;
    const opportunity=institutional().find(o=>!knownOpportunities.has(o.id));if(opportunity){interruption=`New institutional decision: ${opportunity.label}. Review it in World, or continue delegation to defer it. No policy was accepted automatically.`;break;}
    if(current.company.control==='at-risk'){interruption='Governance needs your attention.';break;}
    if(current.programs.some(p=>p.study?.paused)){interruption='A study paused. Review the finding before continuing.';break;}
   }while(guard<96&&(current.year<target||current.phase==='resolving'));
   current={...current,delegated:false};notice=(interruption||`Routine operations advanced from ${fromYear} to ${current.year}. Every delegated annual plan is available in the journey history.`)+saveWarning;
  }
  state=current;
 }
 if(!state)throw new Error('No campaign available.');
 // Cohort lots stay in the worker. The UI receives evaluated totals; export contains the complete authoritative state.
 const view=getView(state);self.postMessage({id,result:{view:{...view,state:{...view.state,cohorts:[]}},checksum:checksum(state),notice}});
}catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)});}};
