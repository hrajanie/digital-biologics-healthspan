import type {NetworkController,NetworkSnapshot,TourView} from './controller';
import type {Action,Preview,View} from './types';
import type {Save} from './storage';
const DB='healthspan-network-2';
async function storage(mode:'read'|'write',data?:Save):Promise<Save|null>{return new Promise((resolve,reject)=>{const opening=indexedDB.open(DB,1);opening.onupgradeneeded=()=>opening.result.createObjectStore('saves');opening.onerror=()=>reject(opening.error);opening.onsuccess=()=>{const db=opening.result,tx=db.transaction('saves',mode==='read'?'readonly':'readwrite'),store=tx.objectStore('saves');const request=mode==='read'?store.get('autosave'):store.put(data,'autosave');let result:Save|null=null;request.onsuccess=()=>{result=mode==='read'?(request.result??null):data!;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};};});}
export function createNetworkController():NetworkController{
 const worker=new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});let sequence=0,previewSequence=0,currentSave:Save|null=null;
 let snapshot:NetworkSnapshot={view:null,pending:[],preview:null,busy:false,error:null,notice:null,tour:null};const listeners=new Set<()=>void>();const requests=new Map<number,{resolve:(x:{view?:View;preview?:Preview;save?:Save;tour?:TourView})=>void;reject:(e:Error)=>void}>();
 worker.onmessage=e=>{const req=requests.get(e.data.id);if(!req)return;requests.delete(e.data.id);if(e.data.error)req.reject(new Error(e.data.error));else req.resolve(e.data.result);};
 worker.onerror=e=>{for(const req of requests.values())req.reject(new Error(e.message));requests.clear();};
 const request=(type:string,payload?:unknown)=>new Promise<{view?:View;preview?:Preview;save?:Save;tour?:TourView}>((resolve,reject)=>{const id=++sequence;requests.set(id,{resolve,reject});worker.postMessage({id,type,payload});});
 const publish=(value:Partial<NetworkSnapshot>)=>{snapshot={...snapshot,...value};listeners.forEach(f=>f());};
 const persist=async()=>{if(currentSave)await storage('write',{...currentSave,pending:snapshot.pending});};
 const preview=async()=>{const seq=++previewSequence;try{const r=await request('preview',snapshot.pending);if(seq===previewSequence)publish({preview:r.preview??null});}catch(e){if(seq===previewSequence)publish({error:String(e)});}};
 const attempt=async(fn:()=>Promise<void>)=>{if(snapshot.busy)return;publish({busy:true,error:null,notice:null});try{await fn();}catch(e){publish({error:e instanceof Error?e.message:String(e)});}finally{publish({busy:false});}};
 const apply=async(type:string,payload?:unknown,pending:Action[]=[])=>{const r=await request(type,payload);currentSave=r.save!;publish({view:r.view!,pending,preview:null,tour:type==='new'?null:r.tour??snapshot.tour,notice:r.tour?`${r.tour.stopReason.title}. ${r.tour.stopReason.detail}`:null});await preview();try{await persist();}catch{publish({notice:'Autosave unavailable. Export this campaign to preserve it.'});}};
 const controller:NetworkController={subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},getSnapshot:()=>snapshot,
  newGame:(scenario,seed)=>attempt(()=>apply('new',{scenario,seed})),
  addAction:action=>{if(snapshot.busy||!snapshot.view||snapshot.view.state.status!=='active')return;publish({pending:[...snapshot.pending,action],preview:null,error:null});void preview();void persist().catch(()=>{});},
  removeAction:index=>{if(snapshot.busy)return;publish({pending:snapshot.pending.filter((_,i)=>i!==index),preview:null});void preview();void persist().catch(()=>{});},
  commit:()=>attempt(()=>apply('commit',snapshot.pending)),
  advance:()=>attempt(async()=>{if(snapshot.pending.length)throw Error('Commit or remove the planned investments before advancing.');await apply('commit',[]);}),
  runToChange:()=>attempt(async()=>{if(snapshot.pending.length)throw Error('Commit or remove the plan first.');await apply('run');}),
  runTour:()=>attempt(async()=>{if(snapshot.pending.length)throw Error('Commit or remove the plan before delegating.');await apply('tour');}),
  save:()=>attempt(async()=>{await persist();publish({notice:'Campaign and pending plan saved on this device.'});}),
  load:()=>attempt(async()=>{const data=await storage('read');if(!data)throw Error('No saved network campaign on this device yet.');await apply('load',data,data.pending);publish({notice:'Saved network campaign restored.'});}),
  exportSave:()=>{if(!currentSave)return;const data={...currentSave,pending:snapshot.pending},url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`healthspan-network-${currentSave.state.seed}-${currentSave.state.tick}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},
  importSave:file=>attempt(async()=>{const text=await file.text();if(text.length>20000000)throw Error('This save is too large.');const data=JSON.parse(text) as Save;await apply('load',data,data.pending);publish({notice:'Network campaign imported.'});})};return controller;
}
