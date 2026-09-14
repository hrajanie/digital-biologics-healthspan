import type {Action,State} from './types';
import {checksum,createCampaign,commitPlan} from './engine';
import {RULES_REVISION} from './version';
export interface Save {format:'healthspan-network';version:2;rulesRevision?:string;state:State;pending:Action[];checksum:string}
export function writeSave(state:State,pending:Action[]=[]):Save{return {format:'healthspan-network',version:2,rulesRevision:RULES_REVISION,state,pending,checksum:checksum(state)};}
export function parseSave(input:string|unknown):Save{
 if(typeof input==='string'&&input.length>20000000)throw Error('This file is larger than a network campaign save.');
 const data=typeof input==='string'?JSON.parse(input):input;const v=data as Save;
 if(!v||v.format!=='healthspan-network'||v.version!==2||v.state?.version!=='network-2.2')throw Error('This is not a save for the network edition. Rules differ from this build (network-2.2). Open this campaign in its frozen build; the original network edition is retained separately.');
 const s=v.state;if(!Number.isSafeInteger(s.tick)||s.tick<0||s.tick>96||!Number.isSafeInteger(s.seed)||!['convergence','staggered'].includes(s.scenario)||!Number.isSafeInteger(s.company?.cash)||!Array.isArray(s.facilities)||!Array.isArray(s.programs)||s.programs.length!==6||!Array.isArray(s.cohorts)||s.cohorts.length>100000||!Array.isArray(s.commands)||s.commands.length>96||!Array.isArray(v.pending)||v.pending.length>500)throw Error('This save contains invalid campaign data.');
 if(v.rulesRevision&&v.rulesRevision!==RULES_REVISION)throw Error('This campaign uses a different rules revision. Open it in its frozen build.');
 if(!v.rulesRevision&&s.commands.some(c=>c.actions.some(a=>a.type==='staff')))throw Error('This staffing campaign used the earlier support formula. Open it in its frozen network-2.2 build.');
 if(checksum(s)!==v.checksum)throw Error('The save integrity record does not match its contents.');return v;
}
/** Final-state comparison for a checksum rounding-boundary collision across runtimes.
 * Money, counts, clocks, strings and governance remain exact. Only two noninteger
 * measurements may differ, by at most 1e-12 relative. This never edits the score.
 */
export function equivalentReplayValue(a:unknown,b:unknown):boolean {
 if(a===b)return true;
 if(typeof a==='number'&&typeof b==='number')return Number.isFinite(a)&&Number.isFinite(b)&&!Number.isInteger(a)&&!Number.isInteger(b)&&Math.abs(a-b)<=1e-12*Math.max(1,Math.abs(a),Math.abs(b));
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;
 const ak=Object.keys(a),bk=Object.keys(b);return ak.length===bk.length&&ak.every(k=>Object.hasOwn(b,k)&&equivalentReplayValue((a as Record<string,unknown>)[k],(b as Record<string,unknown>)[k]));
}
const replayState=(s:State)=>({...s,commands:s.commands.map(({checksum,...c})=>c)});
export function replay(save:Save):State {
 let s=createCampaign(save.state.scenario,save.state.seed),firstDifference:number|null=null;
 for(const c of save.state.commands){s=commitPlan(s,c.actions);if(checksum(s)!==c.checksum&&firstDifference===null)firstDifference=c.tick;}
 // Compare the complete final state, including every account and cohort, even if
 // all recorded checksums matched. A file hash alone does not validate its history.
 if(!equivalentReplayValue(replayState(s),replayState(save.state)))throw Error(`Replay differs after ${firstDifference??s.tick}.`);
 return s;
}
