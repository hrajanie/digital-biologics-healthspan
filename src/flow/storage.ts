import {semanticChecksum} from '../core/canonical';
import {createCampaign,commitPlan,advanceMonth} from './engine';
import {FLOW_VERSION,type State,type Action} from './types';
export interface Illustration {roundId:string;check:number;basis:'operating'|'venture'}
export interface Save {illustration?:Illustration;format:'healthspan-treatment-route';version:typeof FLOW_VERSION;state:State;pending:Action[];checksum:string}
export const writeSave=(state:State,pending:Action[]=[]):Save=>({format:'healthspan-treatment-route',version:FLOW_VERSION,state,pending,checksum:semanticChecksum(state)});
function equivalent(a:unknown,b:unknown):boolean{
 if(a===b)return true;
 if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Number.isFinite(b)&&!Number.isInteger(a)&&!Number.isInteger(b)&&Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(a),Math.abs(b));
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const ka=Object.keys(a).filter(k=>(a as Record<string,unknown>)[k]!==undefined),kb=Object.keys(b).filter(k=>(b as Record<string,unknown>)[k]!==undefined);return ka.length===kb.length&&ka.every(k=>Object.hasOwn(b,k)&&equivalent((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
}
export function parseSave(input:string|unknown):Save{
 if(typeof input==='string'&&input.length>10000000)throw Error('This file is too large for the treatment-route slice.');
 const save=(typeof input==='string'?JSON.parse(input):input) as Save;
 if(save?.format!=='healthspan-treatment-route'||save.version!==FLOW_VERSION||save.state?.version!==FLOW_VERSION)throw Error('This save belongs to another edition. Open older network saves in the preserved Network edition; their prices and history are unchanged.');
 const s=save.state;
 if(!Number.isSafeInteger(s.seed)||!Number.isInteger(s.month)||s.month<0||s.month>24||!['fast','measured'].includes(s.scenario)||!Number.isSafeInteger(s.company?.cash)||!Array.isArray(s.commands)||s.commands.length>2000||!Array.isArray(s.cohorts)||s.cohorts.length>10000||!Array.isArray(save.pending)||save.pending.length>100)throw Error('The campaign data is invalid.');
 if(save.illustration&&(!['operating','venture'].includes(save.illustration.basis)||typeof save.illustration.roundId!=='string'||!Number.isSafeInteger(save.illustration.check)||save.illustration.check<0))throw Error('Invalid investor illustration.');
 if(semanticChecksum(s)!==save.checksum)throw Error('The campaign file does not match its integrity record.');
 return save;
}
export function replay(save:Save):State{
 let state=createCampaign(save.state.scenario,save.state.seed);
 for(const c of save.state.commands){
  if(c.month!==state.month)throw Error('The campaign decision dates do not match.');
  if(c.kind==='plan'){if(!Array.isArray(c.actions)||c.actions.length>100)throw Error('Invalid plan.');state=commitPlan(state,c.actions);}
  else if(c.kind==='advance'){if(!Number.isInteger(c.months)||c.months<1||c.months>24)throw Error('Invalid time advance.');for(let m=0;m<c.months;m++)state=advanceMonth(state);}
  else throw Error('Unknown campaign command.');
 }
 if(!equivalent(state,save.state))throw Error('The campaign does not replay under this version. Keep the matching build with its save.');
 return state;
}
