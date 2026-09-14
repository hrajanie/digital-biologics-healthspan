import {advanceQuarter,checksum,commitPlan,createCampaign} from '../core/engine';
import type {GameState} from '../core/types';

/** Re-execute recorded decisions with their original seed. Never repair invalid actions. */
export function replayCampaign(saved:GameState):{state:GameState;matches:boolean;expected:string;actual:string;decisions:number}{
 let state=createCampaign(saved.scenario,saved.seed,saved.mode);
 if(state.engineVersion!==saved.engineVersion||state.contentVersion!==saved.contentVersion)throw new Error('Replay requires the original engine and content versions.');
 for(let i=0;i<saved.trace.length;i++){
  const record=saved.trace[i];
  if(state.tick!==record.quarter||state.phase!=='planning')throw new Error(`Transcript diverges before decision ${i+1}, quarter ${record.quarter}.`);
  state=commitPlan({...state,delegated:record.delegated},record.actions);
  const until=saved.trace[i+1]?.quarter??saved.tick;
  let guard=0;
  while(state.tick<until&&state.status==='active'){
   state=advanceQuarter(state);
   if(++guard>4)throw new Error(`Transcript is missing an annual decision after quarter ${record.quarter}.`);
  }
 }
 state={...state,delegated:saved.delegated};
 const expected=checksum(saved),actual=checksum(state);
 return{state,matches:expected===actual,expected,actual,decisions:saved.trace.length};
}
