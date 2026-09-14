import {describe,it,expect} from 'vitest';
import {advanceQuarter,checksum,commitPlan,continuingCare,createCampaign,forecastOperations,getView,options,previewPlan,supportCapacity,validatePlan} from '../src/network/engine';
import {operatingRates} from '../src/network/economy';
import {makeCohort,scoreCohorts} from '../src/network/science';
import {parseSave,replay,writeSave} from '../src/network/storage';
import type {Action,State} from '../src/network/types';

const RECRUITMENT=15_000*100;
const site=(s:State,id='east-clinic')=>s.facilities.find(f=>f.id===id)!;
function followupShortage(units=1,required=265*units){
 const s=createCampaign('convergence',27103),f=site(s);s.company.cash=100_000_000_000;
 f.owner='partner';f.status='operating';f.units=units;f.capacity=80*units;f.employees=units;
 s.cohorts=[makeCohort(s,f,s.programs[0],required*4)];s.regions[0].treated=required*4;s.health=scoreCohorts(s);
 return s;
}

describe('ordinary follow-up hiring',()=>{
 it('offers essential and buffered Eastside repairs with exact recruitment, support and payroll',()=>{
  const s=followupShortage(),before=checksum(s),[essential,o]=options(s).filter(o=>o.action.type==='staff'&&o.action.siteId==='east-clinic');
  expect(continuingCare(s)['east-clinic']).toEqual({required:265,capacity:240,delivered:240});
  expect(essential).toMatchObject({available:true,duration:1,cost:RECRUITMENT,action:{type:'staff',siteId:'east-clinic',people:1}});
  expect(essential.label).toContain('essential coverage');expect(essential.effect).toContain('240 → 300');expect(essential.effect).toContain('(+60)');expect(essential.effect).toContain('$37,500');
  expect(o).toMatchObject({available:true,duration:1,cost:2*RECRUITMENT,action:{type:'staff',siteId:'east-clinic',people:2}});
  expect(o.label).toContain('2 follow-up staff');expect(o.detail).toContain('$15,000');expect(o.detail).toContain('$30,000');expect(o.detail).toContain('25%');
  expect(o.effect).toContain('240 → 360');expect(o.effect).toContain('(+120)');expect(o.effect).toContain('265 currently needed');expect(o.effect).toContain('$75,000');
  expect(o.effect).toContain('80 starts');expect(checksum(s)).toBe(before);
  expect(validatePlan(s,[essential.action,o.action]).reasons.join(' ')).toContain('already underway');
  expect(continuingCare(commitPlan(s,[essential.action]))['east-clinic'].capacity).toBe(300);
  expect(continuingCare(commitPlan(s,[o.action]))['east-clinic'].capacity).toBe(360);
 });

 it('repairs the ten-site European case with three essential or thirteen buffered hires',()=>{
  const s=followupShortage(10,2534),f=site(s);f.region=2;f.name='European network';
  const [essential,buffered]=options(s).filter(o=>o.action.type==='staff'&&o.action.siteId===f.id);
  expect(essential.action).toMatchObject({people:3});expect(essential.cost).toBe(3*RECRUITMENT);
  expect(essential.effect).toContain('2,400 → 2,580');expect(essential.effect).toContain('(+180)');expect(essential.effect).toContain('$112,500');
  expect(buffered.action).toMatchObject({people:13});expect(buffered.cost).toBe(13*RECRUITMENT);
  expect(buffered.effect).toContain('2,400 → 3,180');expect(buffered.effect).toContain('(+780)');expect(buffered.effect).toContain('$487,500');
  for(const [option,supported] of [[essential,2580],[buffered,3180]] as const){
   const n=commitPlan(s,[option.action]);expect(continuingCare(n)[f.id].capacity).toBe(supported);
   expect(n.events.filter(e=>e.title.includes('follow-up staff')&&e.title.endsWith('now operating')).at(-1)!.detail).toContain(`2,400 → ${supported.toLocaleString()}`);
   expect(site(n)).toMatchObject({capacity:800,units:10});
  }
 });

 it('preserves legacy support while every dedicated hire adds sixty follow-ups',()=>{
  const s=followupShortage(),f=site(s),owned=site(s,'riverside');
  for(const original of [f,owned]){
   const baseline=Math.max(original.capacity*3,original.employees*60);expect(supportCapacity(original)).toBe(baseline);
   expect(supportCapacity({...original,followupEmployees:0})).toBe(baseline);
   for(const people of [1,2,13])expect(supportCapacity({...original,employees:original.employees+people,followupEmployees:people})).toBe(baseline+people*60);
  }
  const first=commitPlan(s,[{type:'staff',siteId:f.id,people:1}]);
  expect(supportCapacity(site(commitPlan(first,[{type:'staff',siteId:f.id,people:1}])))).toBe(360);
 });

 it('sizes a whole network batch by actual support needs without multiplying staff twice',()=>{
  const s=followupShortage(100),o=options(s).find(o=>o.action.type==='staff'&&o.action.siteId==='east-clinic'&&o.label.includes('25% buffer'))!;
  expect(o.action).toMatchObject({people:153});expect(o.cost).toBe(153*RECRUITMENT);expect(o.effect).toContain('$5,737,500');
  const n=commitPlan(s,[o.action]),f=site(n),care=continuingCare(n)[f.id];
  expect(f).toMatchObject({units:100,capacity:8000,employees:253,followupEmployees:153});
  expect(care.capacity).toBe(33180);expect(care.capacity).toBeGreaterThanOrEqual(care.required*1.25);
  const paid=advanceQuarter(n),baseline=advanceQuarter(advanceQuarter(s));
  expect(paid.account.payroll-baseline.account.payroll).toBe(153*operatingRates(f).staffQuarter);
  expect(paid.account.partnerEmployees).toBe(baseline.account.partnerEmployees);
 });

 it('funds recruitment now, hires after a quarter, and pays wages only once staff start',()=>{
  const s=followupShortage(),f=site(s),action:Action={type:'staff',siteId:f.id,people:5},before=checksum(s),preview=previewPlan(s,[action]);
  expect(preview.valid).toBe(true);expect(preview.cashAfter).toBe(s.company.cash-5*RECRUITMENT);
  expect(preview.next.employees).toBe(preview.current.employees);expect(preview.ready.employees-preview.current.employees).toBe(5);
  expect(checksum(s)).toBe(before);
  const n=commitPlan(s,[action]),baseline=advanceQuarter(s);
  expect(n.tick).toBe(s.tick+1);expect(n.projects).toHaveLength(0);expect(site(n).employees).toBe(f.employees+5);
  expect(n.company.cash).toBe(baseline.company.cash-5*RECRUITMENT);
  expect(n.company.totalSpend).toBe(baseline.company.totalSpend);
  expect(n.account.payroll).toBe(baseline.account.payroll);expect(n.health).toEqual(baseline.health);
  expect(site(n)).toMatchObject({capacity:f.capacity,units:f.units,basis:f.basis});expect(n.company.capex).toBe(s.company.capex);
  const paid=advanceQuarter(n),unrepaired=advanceQuarter(baseline);
  expect(paid.account.payroll-unrepaired.account.payroll).toBe(5*operatingRates(f).staffQuarter);
  expect(site(paid).lastFollowup-site(unrepaired).lastFollowup).toBe(25);
  expect(paid.cohorts[0].continuity).toBeGreaterThan(unrepaired.cohorts[0].continuity);
  expect(paid.health.expected).toBeGreaterThan(unrepaired.health.expected);
 });

 it('also hires at owned clinics using owned staff rates',()=>{
  const s=createCampaign(),f=site(s,'riverside'),n=commitPlan(s,[{type:'staff',siteId:f.id,people:2}]);
  expect(site(n,f.id)).toMatchObject({employees:8,followupEmployees:2,capacity:80,units:1,basis:f.basis});
  const paid=advanceQuarter(n),baseline=advanceQuarter(advanceQuarter(s));
  expect(paid.account.payroll-baseline.account.payroll).toBe(2*30_000*100);
  expect(getView(n).continuingCare[f.id].capacity).toBe(480);
 });

 it.each([0,-1,1.5,NaN,Infinity,Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER+1,'5',undefined])('rejects invalid or unrepresentable headcount %s',(people)=>{
  const s=followupShortage(),v=validatePlan(s,[{type:'staff',siteId:'east-clinic',people} as Action]);
  expect(v.valid).toBe(false);expect(v.reasons.join(' ')).toContain('positive whole number');expect(v.cost).toBe(0);
 });

 it('requires an operating owned or partner care site and sufficient combined cash',()=>{
  const s=createCampaign();
  for(const siteId of ['east-clinic','lab','supplier','community','missing',''])expect(validatePlan(s,[{type:'staff',siteId,people:1}]).valid).toBe(false);
  for(const status of ['closed','building'] as const){const n=followupShortage();site(n).status=status;expect(validatePlan(n,[{type:'staff',siteId:'east-clinic',people:1}]).valid).toBe(false);}
  const publicClinic=followupShortage();site(publicClinic).owner='public';expect(validatePlan(publicClinic,[{type:'staff',siteId:'east-clinic',people:1}]).valid).toBe(false);
  s.company.cash=RECRUITMENT-1;expect(validatePlan(s,[{type:'staff',siteId:'riverside',people:1}]).reasons.join(' ')).toContain('Insufficient cash');
  s.company.cash=60_000_000;expect(validatePlan(s,[{type:'expand',siteId:'riverside'},{type:'staff',siteId:'riverside',people:1}]).valid).toBe(false);
 });

 it('runs alongside construction in either plan order without changing its opening clock',()=>{
  const s=createCampaign(),staff:Action={type:'staff',siteId:'riverside',people:2},expand:Action={type:'expand',siteId:'riverside'};
  for(const actions of [[staff,expand],[expand,staff]]){
   expect(validatePlan(s,actions).valid).toBe(true);
   const n=commitPlan(s,actions);expect(site(n,'riverside')).toMatchObject({readyAt:2,capacity:80,employees:8});
   expect(n.projects).toHaveLength(1);expect(n.projects[0]).toMatchObject({kind:'expand',readyAt:2});
   expect(site(advanceQuarter(n),'riverside')).toMatchObject({capacity:120,units:1.5,employees:12,followupEmployees:2});
  }
  const underway=commitPlan(s,[expand]);expect(validatePlan(underway,[staff]).valid).toBe(true);
 });

 it('rejects duplicate hiring while allowing research preparation in the same plan',()=>{
  const s=followupShortage(),staff:Action={type:'staff',siteId:'east-clinic',people:5};
  expect(validatePlan(s,[staff,staff]).reasons.join(' ')).toContain('already underway');
  for(const actions of [[staff,{type:'trial-team',siteId:'east-clinic'} as Action],[{type:'trial-team',siteId:'east-clinic'} as Action,staff]]){
   const n=commitPlan(s,actions);expect(site(n)).toMatchObject({employees:8,followupEmployees:5,trialTeam:true,capacity:80,units:1});
  }
 });

 it('retains dedicated follow-up hires through equipment changes and a care handoff',()=>{
  let s=createCampaign();s.company.cash=10_000_000_000;s=commitPlan(s,[{type:'staff',siteId:'riverside',people:5}]);
  s.policy.stage='personal';s.world.homeMakers=true;s=commitPlan(s,[{type:'upgrade',siteId:'riverside',delivery:'home'}]);s=advanceQuarter(s);
  expect(site(s,'riverside')).toMatchObject({employees:8,followupEmployees:5,delivery:'home'});
  s=commitPlan(s,[{type:'sell',siteId:'riverside'}]);expect(site(s,'riverside')).toMatchObject({owner:'partner',employees:6,followupEmployees:5});
 });

 it('does not replicate the source site’s dedicated hires for free',()=>{
  let s=createCampaign();s.company.cash=10_000_000_000;s=commitPlan(s,[{type:'staff',siteId:'riverside',people:5}]);s.policy.stage='platform';
  s=commitPlan(s,[{type:'replicate',siteId:'riverside',region:0,units:2}]);const batch=s.facilities.find(f=>f.id.startsWith('network-'))!;
  expect(batch.employees).toBe(2);expect(batch.followupEmployees).toBeUndefined();expect(site(s,'riverside').followupEmployees).toBe(5);
 });

 it('forecasts the hiring opening and payroll without treating recruitment as equipment',()=>{
  const s=createCampaign(),f=site(s,'riverside');s.company.cash-=2*RECRUITMENT;
  s.projects.push({id:'hiring',name:'Hire follow-up staff',siteId:f.id,kind:'staff',readyAt:1,cost:2*RECRUITMENT,units:0,people:2});
  const before=checksum(s),forecast=forecastOperations(s),baseline=forecastOperations(createCampaign());
  expect(forecast[0].employees).toBe(baseline[0].employees);expect(forecast[1].employees-baseline[1].employees).toBe(2);
  expect(forecast[1].costs-baseline[1].costs).toBe(2*operatingRates(f).staffQuarter);
  expect(forecast.every(q=>q.maintenanceBasis===f.basis)).toBe(true);expect(checksum(s)).toBe(before);
 });

 it('persists pending decisions and replays completed hiring through ordinary commands',()=>{
  let s=createCampaign('convergence',27103);const staff:Action={type:'staff',siteId:'riverside',people:2};
  const pending=parseSave(JSON.stringify(writeSave(s,[staff])));expect(pending.pending).toEqual([staff]);
  s=commitPlan(pending.state,pending.pending);s=advanceQuarter(s);
  const saved=parseSave(JSON.stringify(writeSave(s)));expect(replay(saved)).toEqual(s);expect(saved.state.commands[0].actions).toEqual([staff]);
 });
});

it('pins additive staffing saves while accepting compatible earlier nonstaff history',()=>{
 const original=writeSave(commitPlan(createCampaign(),[{type:'expand',siteId:'riverside'}]));delete original.rulesRevision;expect(()=>parseSave(original)).not.toThrow();
 const staffing=writeSave(commitPlan(createCampaign(),[{type:'staff',siteId:'riverside',people:2}]));expect(staffing.rulesRevision).toBe('network-2.3');expect(()=>parseSave(staffing)).not.toThrow();delete staffing.rulesRevision;expect(()=>parseSave(staffing)).toThrow('earlier support formula');
});
