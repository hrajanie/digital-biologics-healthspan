import type {Action,FlowEvent,InvestorPosition,Preview,Scenario,View} from './types';
import type {Save,Illustration} from './storage';
export interface Snapshot {illustration:Illustration;view:View|null;pending:Action[];preview:Preview|null;news:FlowEvent[];busy:boolean;error:string|null;notice:string|null}
export interface Controller {initialize:()=>Promise<void>;setIllustration:(value:Illustration)=>void;subscribe:(fn:()=>void)=>()=>void;getSnapshot:()=>Snapshot;newGame:(scenario?:Scenario,seed?:number)=>Promise<void>;add:(action:Action)=>void;remove:(index:number)=>void;commit:(run?:boolean)=>Promise<void>;run:()=>Promise<void>;month:()=>Promise<void>;save:()=>Promise<void>;load:()=>Promise<void>;importSave:(file:File)=>Promise<void>;exportSave:()=>void;dismissNews:()=>void;investor:(roundId:string,check:number,basis:'operating'|'venture')=>Promise<InvestorPosition>}
const DB='healthspan-treatment-route-1';
const JOURNAL=DB+'-pending';
async function persisted(mode:'read'|'write',data?:Save):Promise<Save|null>{return new Promise((resolve,reject)=>{const open=indexedDB.open(DB,1);open.onupgradeneeded=()=>open.result.createObjectStore('saves');open.onerror=()=>reject(open.error);open.onsuccess=()=>{const db=open.result,tx=db.transaction('saves',mode==='read'?'readonly':'readwrite'),object=tx.objectStore('saves'),r=mode==='read'?object.get('autosave'):object.put(data,'autosave');let result:Save|null=null;r.onsuccess=()=>{result=mode==='read'?(r.result??null):data!;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};};});}
export function createFlowController():Controller{
 const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});let sequence=0,previewSeq=0,current:Save|null=null;
 type Result={view?:View;save?:Save;preview?:Preview;news?:FlowEvent[];position?:InvestorPosition};
 const requests=new Map<number,{resolve:(r:Result)=>void;reject:(e:Error)=>void}>(),listeners=new Set<()=>void>();
 let snapshot:Snapshot={illustration:{roundId:'',check:100000000,basis:'venture'},view:null,pending:[],preview:null,news:[],busy:false,error:null,notice:null};
 const publish=(patch:Partial<Snapshot>)=>{snapshot={...snapshot,...patch};listeners.forEach(f=>f());};
 const request=(type:string,payload?:unknown)=>new Promise<Result>((resolve,reject)=>{const id=++sequence;requests.set(id,{resolve,reject});worker.postMessage({id,type,payload});});
 worker.onmessage=({data})=>{const req=requests.get(data.id);if(!req)return;requests.delete(data.id);data.error?req.reject(new Error(data.error)):req.resolve(data.result);};
 worker.onerror=e=>{requests.forEach(r=>r.reject(new Error(e.message)));requests.clear();};
 const persist=async()=>{if(current){const data={...current,pending:snapshot.pending,illustration:snapshot.illustration};try{localStorage.setItem(JOURNAL,JSON.stringify({checksum:current.checksum,pending:data.pending,illustration:data.illustration}));}catch{}await persisted('write',data);}};
 const preview=async()=>{const seq=++previewSeq;try{const result=await request('preview',snapshot.pending);if(seq===previewSeq)publish({preview:result.preview!});}catch(e){if(seq===previewSeq)publish({error:String(e)});}};
 const attempt=async(fn:()=>Promise<void>)=>{if(snapshot.busy)return;publish({busy:true,error:null,notice:null});try{await fn();}catch(e){publish({error:e instanceof Error?e.message:String(e)});}finally{publish({busy:false});}};
 const apply=async(type:string,payload?:unknown,pending:Action[]=[])=>{const result=await request(type,payload);current=result.save!;const illustration=type==='load'?(payload as Save).illustration??{roundId:'',check:100000000,basis:'venture' as const}:type==='new'?{roundId:'',check:100000000,basis:'venture' as const}:snapshot.illustration;publish({illustration,view:result.view!,pending,news:result.news??[],preview:null});await preview();try{await persist();}catch{publish({notice:'Autosave unavailable. Export a save to keep this campaign.'});}};
 return {initialize:()=>attempt(async()=>{let data:Save|null=null;try{data=await persisted('read');}catch{publish({notice:'Device storage unavailable. Export a save to keep your progress.'});}if(data){try{const journal=JSON.parse(localStorage.getItem(JOURNAL)||'null');if(journal?.checksum===data.checksum&&Array.isArray(journal.pending)){data={...data,pending:journal.pending,illustration:journal.illustration};}}catch{}await apply('load',data,data.pending);}else await apply('new',{scenario:'fast',seed:2027});}),setIllustration:illustration=>{publish({illustration});void persist().catch(()=>{});},subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},getSnapshot:()=>snapshot,
  newGame:(scenario='fast',seed=2027)=>attempt(()=>apply('new',{scenario,seed})),
  add:action=>{if(snapshot.busy||snapshot.view?.state.status!=='active')return;const encoded=JSON.stringify(action);if(snapshot.pending.some(a=>JSON.stringify(a)===encoded))return;publish({pending:[...snapshot.pending.filter(a=>action.type!=='raise'||a.type!=='raise'),action],preview:null,error:null});void preview();void persist().catch(()=>{});},
  remove:index=>{if(snapshot.busy)return;publish({pending:snapshot.pending.filter((_,i)=>i!==index),preview:null});void preview();void persist().catch(()=>{});},
  commit:(run=true)=>attempt(()=>apply(run?'plan-run':'plan',snapshot.pending)),
  run:()=>attempt(async()=>{if(snapshot.pending.length)throw Error('Commit or remove the pending plan first.');await apply('run');}),
  month:()=>attempt(async()=>{if(snapshot.pending.length)throw Error('Commit or remove the pending plan first.');await apply('month');}),
  save:()=>attempt(async()=>{await persist();publish({notice:'Campaign and pending plan saved on this device.'});}),
  load:()=>attempt(async()=>{const data=await persisted('read');if(!data)throw Error('No treatment-route save on this device. Older editions remain separate.');await apply('load',data,data.pending);publish({notice:'Treatment-route campaign restored.'});}),
  importSave:file=>attempt(async()=>{const text=await file.text();if(text.length>10000000)throw Error('This file is too large.');const data=JSON.parse(text) as Save;await apply('load',data,data.pending);publish({notice:'Treatment-route campaign imported. No time advanced.'});}),
  exportSave:()=>{if(!current)return;const blob=new Blob([JSON.stringify({...current,pending:snapshot.pending,illustration:snapshot.illustration})],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`healthspan-flow-${current.state.seed}-${current.state.month}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
  dismissNews:()=>publish({news:[]}),
  investor:async(roundId,check,basis)=>{const result=await request('investor',{roundId,check,basis});return result.position!;}
 };
}
