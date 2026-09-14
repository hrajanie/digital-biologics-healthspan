import type {Event,State} from './types';

/** Identify a completed regional project from its stable creation id and order.
 * Repeated same-name projects finish in creation order; no game state is changed.
 */
export function eventSite(state:State,event:Event){
 const match=/^Replicate (.*): now operating$/.exec(event.title);if(!match)return undefined;
 const sites=state.facilities.filter(f=>f.name===match[1]&&f.id.startsWith('network-')&&Number(f.id.split('-')[2])+4===event.tick);
 const index=state.events.filter(e=>e.tick===event.tick&&e.title===event.title).findIndex(e=>e.id===event.id);
 return index>=0?sites[index]:undefined;
}
export function eventTitle(state:State,event:Event){const site=eventSite(state,event),region=site&&state.regions.find(r=>r.id===site.region);const title=event.title.replace(/phase([123])/g,'Phase $1');return region?`${region.name} · ${title}`:title;}
export function eventDescription(state:State,event:Event){
 if(event.title==='A policy window closes'){
  if(state.events.some(e=>e.title==='Personal AGI authorization begins'&&e.tick<=event.tick))return 'Personal authorization was already operating. No further institutional level needed approval at this scheduled review.';
  return event.detail+' The window uses evidence available at the start of the quarter. A later study readout can inform the next window.';
 }
 return event.detail;
}
