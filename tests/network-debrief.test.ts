import {expect,it} from 'vitest';
import {createCampaign,commitPlan,getView,checksum} from '../src/network/engine';
import {debriefHTML,selectedPosition} from '../src/network/debrief';
it('keeps the illustrative entry round stable through later financing and panel changes',()=>{
 let s=commitPlan(createCampaign(),[{type:'raise',amount:100000000,terms:'protected'}]);const first=s.company.rounds[0].id;
 s=commitPlan(s,[{type:'raise',amount:100000000,terms:'protected'}]);const view=getView(s),before=checksum(s);
 expect(selectedPosition(view,{roundId:'',check:100000})!.round.id).toBe(first);
 const html=debriefHTML(view,{roundId:first,check:100000});expect(html).toContain('No follow-on investment');expect(html).toContain('Hypothetical proceeds');expect(html).not.toContain('<script');expect(checksum(s)).toBe(before);
});
it('escapes exported text and clearly handles a campaign with no investment',()=>{const s=createCampaign();s.events[0].title='<script>unsafe</script>';s.events[0].kind='clinical';const html=debriefHTML(getView(s),{roundId:'',check:0});expect(html).toContain('&lt;script&gt;');expect(html).toContain('No financing round selected');});
it('does not print a very small positive illustrative stake as zero',()=>{
 const s=commitPlan(createCampaign(),[{type:'raise',amount:300000000,terms:'protected'}]);
 const html=debriefHTML(getView(s),{roundId:s.company.rounds[0].id,check:1});expect(html).toContain('&lt;0.01%');expect(html).not.toContain('ownership 0.00%');
});
it('keeps enabling milestones rather than replacing them with late routine policy windows',()=>{
 const s=createCampaign();s.events.push({id:'trial',tick:1,kind:'build',title:'Prepare clinical trial team: now operating',detail:'Research capacity opened.',major:true},{id:'policy',tick:24,kind:'policy',title:'Evidence-based treatment platform accepted',detail:'Compatible evidence can shorten development.',major:true},{id:'scale',tick:40,kind:'build',title:'Replicate Network 1: now operating',detail:'800 places supported.',major:true},{id:'late',tick:88,kind:'policy',title:'A policy window closes',detail:'No additional reform.',major:true});
 const html=debriefHTML(getView(s),{roundId:'',check:0});expect(html).toContain('Research capacity opened');expect(html).toContain('Evidence-based treatment platform accepted');expect(html).toContain('800 places supported');expect(html).not.toContain('A policy window closes');
});
