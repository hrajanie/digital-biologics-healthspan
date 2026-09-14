import type {Action,Preview,ScenarioId,View} from './types';
import type {TourStopReason,DelegatedQuarter} from './tour';
export interface TourView {stopReason:TourStopReason;delegatedActions:DelegatedQuarter[]}
export interface NetworkSnapshot {view:View|null;pending:Action[];preview:Preview|null;busy:boolean;error:string|null;notice:string|null;tour:TourView|null}
export interface NetworkController {subscribe:(fn:()=>void)=>()=>void;getSnapshot:()=>NetworkSnapshot;newGame:(scenario:ScenarioId,seed:number)=>Promise<void>;addAction:(a:Action)=>void;removeAction:(i:number)=>void;commit:()=>Promise<void>;advance:()=>Promise<void>;runToChange:()=>Promise<void>;runTour:()=>Promise<void>;save:()=>Promise<void>;load:()=>Promise<void>;exportSave:()=>void;importSave:(file:File)=>Promise<void>}
