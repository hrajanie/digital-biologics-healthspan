import type {GameState} from './types';

/** The short route changes pacing only; it uses the ordinary campaign rules. */
export const INVESTOR_ROUTE = {scenario:'convergence',seed:2027} as const;
export const INVESTOR_STOPS = [2027,2028,2031,2035,2042,2048] as const;
export type InvestorStopYear = typeof INVESTOR_STOPS[number];
type RouteState = Pick<GameState,'year'|'phase'|'status'|'trace'>;

export interface InvestorStopState {
  currentStop:InvestorStopYear|null;
  /** Most recent scheduled briefing, retained during the intervening years. */
  briefYear:InvestorStopYear;
  stopNumber:number;
  commitmentRecorded:boolean;
  requiresCommit:boolean;
  nextStop:number;
  canDelegate:boolean;
  reason:string;
}

export function investorStopState(state:RouteState):InvestorStopState {
  const currentStop=INVESTOR_STOPS.find(year=>year===state.year)??null;
  const briefYear=[...INVESTOR_STOPS].reverse().find(year=>year<=state.year)??INVESTOR_STOPS[0];
  // Trace.quarter is the absolute quarter index, starting at zero in 2027.
  // An automated plan cannot discharge the CEO's obligation at a planning stop.
  const commitmentRecorded=state.trace.some(record=>
    !record.delegated&&record.actions.length===2&&2027+Math.floor(record.quarter/4)===state.year);
  const ended=state.phase==='ended'||state.status!=='active';
  const requiresCommit=!ended&&currentStop!==null&&!commitmentRecorded;
  const nextStop=ended?2051:requiresCommit?state.year:INVESTOR_STOPS.find(year=>year>state.year)??2051;
  return {
    currentStop,briefYear,stopNumber:INVESTOR_STOPS.indexOf(briefYear)+1,
    commitmentRecorded,requiresCommit,nextStop,canDelegate:!ended&&!requiresCommit,
    reason:ended?'The campaign has ended.':
      requiresCommit?`Choose two commitments and commit your ${state.year} annual plan before delegating.`:
      nextStop===2051?'Your remaining routine years can advance to the 2050 ending.':
      `Routine years can advance to the ${nextStop} planning stop.`,
  };
}

/** Returns this year when its mandatory decision is still outstanding. */
export function nextInvestorStop(state:RouteState):number {
  return investorStopState(state).nextStop;
}
