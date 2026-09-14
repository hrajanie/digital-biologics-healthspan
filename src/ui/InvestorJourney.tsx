import {useId,useState} from 'react';
import type {Action,GameState,GameView} from '../core/types';
import {INVESTOR_STOPS,investorStopState,type InvestorStopYear} from '../core/investor';
import {DEALS} from '../world/content';
import {familyNames,money,number,percent,title} from './format';
import {Icon} from './Icon';

interface Brief {
  label:string;
  title:string;
  dilemma:string;
  inspect:{tab:string;label:string}[];
}
const BRIEFS:Record<InvestorStopYear,Brief>={
  2027:{
    label:'Infrastructure architecture',
    title:'What kind of network are you building?',
    dilemma:'One clinic is the opening constraint. Extra treatment capacity serves people sooner; diagnostics, evidence and continuity prepare a different scale of care. Your two commitments decide where the network begins.',
    inspect:[{tab:'network',label:'Inspect the network'},{tab:'programs',label:'Explore future therapies'}],
  },
  2028:{
    label:'Financing and your stake',
    title:'What is independence worth?',
    dilemma:'Capital buys construction and clinical time. Larger rounds sell more ownership; some terms transfer strategic authority. Compare the work a deal makes possible with the obligations it leaves behind.',
    inspect:[{tab:'company',label:'Compare financing terms'},{tab:'investor',label:'Set your illustrative check'}],
  },
  2031:{
    label:'Clinical development timing',
    title:'Start learning, or wait for a better candidate?',
    dilemma:'A trial started now can produce clinical evidence while AI designs improve. Waiting preserves cash and may improve the candidate, but loses time. Broad studies, smaller studies and a later version bridge make different commitments.',
    inspect:[{tab:'programs',label:'Review candidates and study clocks'},{tab:'world',label:'Inspect model progress'}],
  },
  2035:{
    label:'Personalized readiness and policy',
    title:'Can your network use new permissions?',
    dilemma:'Trusted predictive evidence may change what must be studied and what can be authorized as a platform. Policy spending can influence adoption; clinics, evidence and follow-up determine what DB can deliver if the rules change.',
    inspect:[{tab:'world',label:'Review the institutional route'},{tab:'network',label:'Inspect delivery readiness'}],
  },
  2042:{
    label:'Population-scale deployment',
    title:'How broadly should the network commit?',
    dilemma:'Regional reach, reliable follow-up and population agreements can turn individual therapies into a delivery business. Serving more people also commits capacity and continuing costs. Compare additional access with margin and resilience.',
    inspect:[{tab:'network',label:'Inspect regional bottlenecks'},{tab:'company',label:'Review population agreements'}],
  },
  2048:{
    label:'Stewardship and retained control',
    title:'What will outlast the campaign?',
    dilemma:'Care begun by 2050 can add healthy years long afterward, provided it remains effective and accessible. Weigh final expansion against continuing obligations, the improving outside world and the control needed to keep the mission yours.',
    inspect:[{tab:'outcomes',label:'Inspect remaining health benefit'},{tab:'investor',label:'Review value and dilution'}],
  },
};

export interface InvestorJourneyProps {
  view:GameView;
  onNavigate:(tab:string)=>void;
  onDelegate:()=>void;
  onFullControl:()=>void;
  busy:boolean;
  pendingCount:number;
}

export function InvestorJourney({view,onNavigate,onDelegate,onFullControl,busy,pendingCount}:InvestorJourneyProps) {
  const state=view.state;
  const route=investorStopState(state);
  const brief=BRIEFS[route.briefYear];
  const delegated=state.trace.filter(record=>record.delegated);
  const hasPending=pendingCount>0;
  const blocked=busy||hasPending||!route.canDelegate;
  const metrics=briefMetrics(view,route.briefYear);
  const reason=hasPending?'Commit or remove your pending plan before delegating.':route.reason;
  if(state.mode!=='investor'||state.phase==='ended')return null;
  return <section className="investor-journey" aria-label="Investor journey decision">
    <div className="journey-heading">
      <div><span className="eyebrow">{route.currentStop?`Decision ${route.stopNumber} of 6 · ${state.year}`:`Routine years · next stop ${route.nextStop===2051?'the ending':route.nextStop}`}</span><h2>{brief.title}</h2></div>
      <ol className="journey-stops" aria-label="Six planning stops">{INVESTOR_STOPS.map(year=><li key={year} aria-current={year===state.year?'step':undefined} className={year<state.year?'passed':year===state.year?'current':''}><span>{year}</span></li>)}</ol>
    </div>
    <div className="journey-body">
      <div className="journey-dilemma"><span className="eyebrow">{brief.label}</span><p>{brief.dilemma}</p><div className="journey-links">{brief.inspect.map(link=><button key={link.tab} className="text-button" onClick={()=>onNavigate(link.tab)}>{link.label}<Icon name="arrow" size={14}/></button>)}</div></div>
      <div className="journey-metrics">{metrics.map(metric=><JourneyMetric key={metric.label} {...metric}/>)}</div>
    </div>
    <div className="journey-delegation"><div><strong>{route.requiresCommit?'Your annual decision comes first.':route.nextStop===2051?'Ready for the final stretch.':`Next planning stop: ${route.nextStop}.`}</strong><p>{reason}</p></div><button className="button primary" disabled={blocked} onClick={onDelegate} aria-describedby="journey-delegation-policy"><Icon name="play" size={15}/>{busy?'Advancing…':route.nextStop===2051?'Continue to the 2050 ending':`Continue to ${route.canDelegate?route.nextStop:INVESTOR_STOPS.find(year=>year>state.year)??'the ending'}`}</button><button className="text-button" disabled={busy} onClick={onFullControl}>Take full control</button></div>
    <details className="journey-policy"><summary>Delegation policy and decisions made ({delegated.length} annual plans)</summary><p id="journey-delegation-policy">Delegation uses ordinary annual commitments to maintain funded work, repair affordable continuity bottlenecks first, advance programs you already initiated with narrow study packages (partner packages for co-developed programs), then compare affordable upgrades and site expansion in your existing regions where a resource is actually limiting care. It holds discretionary expansion when demand, cash or permission is the constraint; you can choose to build ahead manually. It waits before Phase III when qualifying Phase II evidence and an already funded platform could remove that requirement; you may start the trial manually. It holds a two-year operating reserve and does not bridge models. It accepts no new financing, contracts or policy commitments, starts no new programs and adds no rescue funding. Critical cash or control warnings, paused studies and newly available institutional decisions interrupt. Opportunities can add planning stops. Any already available reform is reviewed before delegation resumes; you may explicitly defer it. You can take full control at any time.</p>
      {delegated.length===0?<p className="small-note">No annual plans have been delegated yet.</p>:<ol className="journey-history">{[...delegated].reverse().map(record=><li key={record.id}><strong>{2027+Math.floor(record.quarter/4)}</strong><div>{record.actions.map((action,index)=><span key={index}>{actionName(action,state)}</span>)}<small>Cash at commitment: {money(record.cashBefore)} → {record.cashAfterCommit===undefined?'not recorded':money(record.cashAfterCommit)}. After resolved operations: {money(record.cashAfter)}.</small></div></li>)}</ol>}
    </details>
  </section>;
}

function briefMetrics(view:GameView,year:InvestorStopYear):{label:string;value:string;note?:string}[] {
  const state=view.state;
  const regions=state.regions.filter(region=>region.unlocked);
  switch(year){
    case 2027:return [
      {label:'Annual care capacity',value:number(view.capacity)},
      {label:'Cash available',value:money(state.company.cash)},
      {label:'Operating regions',value:`${regions.length} / ${state.regions.length}`},
    ];
    case 2028:return [
      {label:'Modeled company equity',value:money(view.value.equity),note:'Operating forecast; not the round price'},
      {label:'Founder board seats',value:`${state.company.founderSeats} / 5`},
      {label:'Closed funding rounds',value:String(state.company.rounds.length)},
    ];
    case 2031:return [
      {label:'Active studies',value:`${view.activePrograms} / ${view.maxPrograms}`},
      {label:'Programs with newer versions',value:String(state.programs.filter(program=>program.availableVersion>program.version).length)},
      {label:'Annual care capacity',value:number(view.capacity),note:'Shared with trials and continuing care'},
    ];
    case 2035:return [
      {label:'Institutional route',value:title(state.policy.stage)},
      {label:'Platform qualification',value:state.policy.qualified?'Qualified':'Not yet qualified'},
      {label:'Evidence and follow-up levels',value:String(regions.reduce((sum,region)=>sum+region.levels.evidence+region.levels.followup,0))},
    ];
    case 2042:return [
      {label:'People reached',value:number(state.score.people)},
      {label:'Partner sites',value:number(regions.reduce((sum,region)=>sum+region.siteCount,0))},
      {label:'Annual care capacity',value:number(view.capacity)},
    ];
    case 2048:return [
      {label:'Expected healthy years',value:number(state.score.expected)},
      {label:'Modeled company equity',value:money(view.value.equity)},
      {label:'Company control',value:title(state.company.control)},
    ];
  }
}

function JourneyMetric({label,value,note}:{label:string;value:string;note?:string}) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong>{note&&<small>{note}</small>}</div>;
}

function actionName(action:Action,state:GameState):string {
  switch(action.type){
    case 'build':return `${familyNames[action.family]} · ${state.regions.find(region=>region.id===action.regionId)?.name??action.regionId}`;
    case 'program':return `${title(action.operation)} ${state.programs.find(program=>program.id===action.programId)?.name??action.programId}${action.package?` · ${title(action.package)} study`:''}`;
    case 'deal':return DEALS.find(deal=>deal.id===action.dealId)?.variants[action.variant]?.name??'Partnership agreement';
    case 'policy':return ({lobby:'Fund policy engagement',platform:'Qualify a societal platform',charter:'Choose a platform charter',recognition:'Seek jurisdiction recognition'})[action.operation];
    case 'priority':return `Set ${title(action.priority)} allocation priority`;
    case 'wait':return 'Hold capacity; continue existing commitments';
  }
}

/** An editable illustration only. Selecting an offer never executes a round. */
export function ProvisionalStake({check,setCheck}:{check:number;setCheck:(check:number)=>void}) {
  const [offerIndex,setOfferIndex]=useState(0);
  const id=useId();
  const offers=DEALS.find(deal=>deal.id==='equity')!.variants;
  const offer=offers[offerIndex];
  const checked=Math.min(offer.cash,Math.max(0,Number.isFinite(check)?Math.round(check):0));
  const postMoney=offer.preMoney+offer.cash;
  return <section className="provisional-stake" aria-label="Provisional illustrative investment">
    <div><span className="eyebrow">Explore your entry</span><h3>Your illustrative investment</h3><p className="provisional-status">Provisional — this round has not closed.</p></div>
    <div className="provisional-fields"><label htmlFor={`${id}-offer`}>Illustrative funding round<select id={`${id}-offer`} value={offerIndex} onChange={event=>{const next=Number(event.target.value);setOfferIndex(next);setCheck(Math.min(checked,offers[next].cash));}}>{offers.map((variant,index)=><option value={index} key={variant.name}>{variant.name}</option>)}</select></label><label htmlFor={`${id}-check`}>Your check in USD<input id={`${id}-check`} type="number" min="0" max={offer.cash/100} step="10000" value={checked/100} onChange={event=>setCheck(Math.round(Math.min(offer.cash/100,Math.max(0,Number(event.target.value)||0))*100))}/><small>Up to the {money(offer.cash)} total round.</small></label></div>
    <div className="provisional-metrics"><JourneyMetric label="Assumed post-money valuation" value={money(postMoney)}/><JourneyMetric label="Illustrative initial ownership" value={percent(postMoney?checked/postMoney:0,2)} note={`${money(checked)} ÷ ${money(postMoney)}`}/></div>
    <p className="small-note">The check replaces part of this round’s other investors. It adds no company funding and creates no extra shares. There are no owned shares or hypothetical proceeds until a round actually closes; later financing can dilute this position.</p>
    {offer.strategicControl&&<p className="provisional-warning">This offer transfers strategic control if accepted in Company. Accepting it ends the founder campaign.</p>}
    <p className="fine-print">Illustrative game terms only; this is not Digital Biologics’ actual fundraising offer.</p>
  </section>;
}
