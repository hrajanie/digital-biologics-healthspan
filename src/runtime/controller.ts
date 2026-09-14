import type {Action, GameView, Preview, ScenarioId, Mode} from '../core/types';
export interface AppSnapshot { view:GameView|null; busy:boolean; error:string|null; pending:Action[]; preview:Preview|null; notice:string|null; reducedMotion:boolean; sound:boolean; }
export interface GameController {
 subscribe:(listener:()=>void)=>()=>void; getSnapshot:()=>AppSnapshot;
 newGame:(scenario:ScenarioId,seed:number,mode:Mode)=>Promise<void>;
 addAction:(action:Action)=>void; removeAction:(index:number)=>void;
 commit:()=>Promise<void>; advance:()=>Promise<void>; advanceYear:()=>Promise<void>; delegateToNextStop:()=>Promise<void>;
 save:()=>Promise<void>; load:()=>Promise<void>; exportSave:()=>void; importSave:(file:File)=>Promise<void>;
 setMode:(mode:Mode)=>void; setReducedMotion:(enabled:boolean)=>void; setSound:(enabled:boolean)=>void;
 downloadDebrief:(roundId:string,check:number)=>void;
}
