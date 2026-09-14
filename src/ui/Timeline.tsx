import type {GameView} from '../core/types';
import {releasesForScenario} from '../world/content';

/** Align known commitments with announced world changes without inventing a trial completion date. */
export function CampaignTimeline({view}:{view:GameView}){
 const s=view.state,horizon=16;
 const rows:{name:string;start:number;length:number;detail:string;kind:string}[]=[];
 for(const p of s.projects)rows.push({name:p.name,start:0,length:Math.min(horizon,p.remaining),detail:`${p.remaining} quarters to commissioning`,kind:'build'});
 for(const p of s.programs.filter(p=>p.study)){
  const study=p.study!;
  const waiting=study.readiness<1||study.enrolled<study.target;
  const remaining=Math.max(0,study.observationRequired-study.observation)+Math.max(0,2-study.review);
  rows.push({name:p.name,start:0,length:waiting?2:Math.max(1,Math.min(horizon,remaining)),detail:study.paused?'Paused · CEO decision needed':waiting?`${study.enrolled}/${study.target} enrolled · observation ${study.observationRequired}Q begins after readiness and enrollment`:`Observation ${study.observation}/${study.observationRequired}Q · review follows`,kind:study.paused?'paused':waiting?'uncertain':'study'});
 }
 for(const release of releasesForScenario(s.scenario)){
  const start=(release.year-2027)*4-s.tick;
  if(start>=0&&start<horizon)rows.push({name:release.title,start,length:1,detail:`Announced ${release.year} capability release`,kind:'world'});
 }
 return <details className="campaign-timeline"><summary>Commitments and the changing world <span>{s.year}–{Math.min(2050,s.year+4)}</span></summary><p>Construction has a commissioning date. Clinical observation has a minimum duration; recruitment and review can move the finish. Announced AI releases proceed independently.</p><div className="timeline-heading"><span>Next sixteen quarters</span><div>{[0,4,8,12].map(offset=><span key={offset}>{2027+Math.floor((s.tick+offset)/4)}</span>)}</div></div><div className="timeline-rows">{rows.map((row,index)=><div className="timeline-row" key={index}><div><strong>{row.name}</strong><small>{row.detail}</small></div><div className="timeline-track"><span className={row.kind} style={{left:`${row.start/horizon*100}%`,width:`${row.length/horizon*100}%`}} title={row.detail}/></div></div>)}{!rows.length&&<p>No active construction, study clocks or announced releases in this window.</p>}</div><small>Striped study bars indicate unresolved timing; they are not predicted completion dates.</small></details>;
}
