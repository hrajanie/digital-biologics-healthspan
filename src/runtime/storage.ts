import type {Action, GameState} from '../core/types';
export interface SaveFile {format:'healthspan-save';version:1;savedAt:string;checksum:string;state:GameState;pending:Action[]}
const DB='healthspan-local-v1';
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('saves');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function writeSave(save:SaveFile,key='autosave'){const db=await database();try{await new Promise<void>((resolve,reject)=>{const t=db.transaction('saves','readwrite');t.objectStore('saves').put(save,key);t.oncomplete=()=>resolve();t.onerror=()=>reject(t.error);});}finally{db.close();}}
export async function readSave(key='autosave'):Promise<SaveFile|null>{const db=await database();try{return await new Promise((resolve,reject)=>{const r=db.transaction('saves').objectStore('saves').get(key);r.onsuccess=()=>resolve(r.result??null);r.onerror=()=>reject(r.error);});}finally{db.close();}}
export function parseSave(value:unknown):SaveFile{if(!value||typeof value!=='object')throw new Error('This is not a Healthspan save.');const v=value as SaveFile;const s=v.state;
 if(v.format!=='healthspan-save'||v.version!==1||!s||s.schemaVersion!==1)throw new Error('This save uses an unsupported format.');
 if(!['convergence','staggered'].includes(s.scenario)||!['campaign','investor'].includes(s.mode)||!Number.isSafeInteger(s.seed)||!Number.isInteger(s.tick)||s.tick<0||s.tick>96||!Number.isInteger(s.year)||s.year<2027||s.year>2050)throw new Error('The campaign date or scenario is invalid.');
 if(!s.company||!s.policy||!s.world||!s.score||!Number.isSafeInteger(s.company.cash)||!Array.isArray(s.regions)||s.regions.length!==6||!Array.isArray(s.programs)||s.programs.length!==6||!Array.isArray(s.cohorts)||s.cohorts.length>100000||!Array.isArray(s.trace)||s.trace.length>2000||!Array.isArray(v.pending)||v.pending.length>2)throw new Error('The campaign data is incomplete.');
 if(typeof v.checksum!=='string'||!s.engineVersion||!s.contentVersion)throw new Error('This save is missing its version or integrity record.');
 for(const r of s.regions){if(!r.levels||!Object.values(r.levels).every(n=>Number.isFinite(n)&&n>=0)||!Number.isFinite(r.population))throw new Error('The network contains invalid values.');}
 return v;
}
