import {expect,it} from 'vitest';
import {createCampaign} from '../src/network/engine';
import {eventTitle,eventSite,eventDescription} from '../src/network/presentation';
it('distinguishes same-name same-quarter regional commissioning events without mutating them',()=>{
 const s=createCampaign(),a={...s.facilities[0],id:'network-2-40-20',name:'Network 7 · 10,000 sites',region:2},b={...a,id:'network-5-40-24',region:5};s.facilities.push(a,b);
 const events=[{id:'44:1',tick:44,kind:'build' as const,title:'Replicate Network 7 · 10,000 sites: now operating',detail:'Capacity opened.',major:true},{id:'44:2',tick:44,kind:'build' as const,title:'Replicate Network 7 · 10,000 sites: now operating',detail:'Capacity opened.',major:true}];s.events.push(...events);
 expect(eventSite(s,events[0])?.id).toBe(a.id);expect(eventSite(s,events[1])?.id).toBe(b.id);expect(eventTitle(s,events[0])).toContain(s.regions[2].name);expect(eventTitle(s,events[1])).toContain(s.regions[5].name);expect(events[0].title).toBe(events[1].title);
});
it('explains the start-of-quarter evidence cutoff without inventing a later reform requirement',()=>{
 const s=createCampaign(),e={id:'88:1',tick:88,kind:'policy' as const,title:'A policy window closes',detail:'More evidence needed.',major:true};
 expect(eventDescription(s,e)).toContain('start of the quarter');s.events.push({...e,id:'64:1',tick:64,title:'Personal AGI authorization begins'});expect(eventDescription(s,e)).toContain('already operating');expect(eventDescription(s,e)).not.toContain('More evidence needed');
});
