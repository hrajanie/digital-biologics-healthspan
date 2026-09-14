import type {Facility,Region,Link,QuarterAccount} from './types';
export const M=100_000_000;
export const EMPTY_ACCOUNT:QuarterAccount={tick:0,starts:0,followup:0,revenue:0,costs:0,payroll:0,supplies:0,research:0,central:0,cashFlow:0,employees:10,partnerEmployees:0,healthAdded:0};
export const REGION_NAMES=['Pacific coast','Atlantic cities','European corridor','South Asian cities','African urban network','Pacific Asia'];
export function initialRegions():Region[]{return REGION_NAMES.map((name,id)=>({id,name,population:[60,90,140,180,220,310][id]*1e6,treated:0,waiting:id===0?120:0,arrivals:120,jurisdiction:id%3,access:0}));}
export function initialFacilities():Facility[]{
 const make=(id:string,name:string,kind:Facility['kind'],x:number,y:number,owner:Facility['owner'],capacity:number,employees:number,description:string):Facility=>({id,name,kind,x,y,owner,capacity,employees,description,region:0,status:owner==='available'?'closed':'operating',units:1,basis:owner==='db'?60000000:0,readyAt:0,delivery:'clinic',programId:'standard-autoimmune',trialTeam:false,lastStarts:0,lastFollowup:0,lastRevenue:0,lastCosts:0,limiting:''});
 return [make('community','Riverside community','community',750,465,'public',0,0,'People eligible for care. Connecting a clinic creates access; treatment creates healthspan.'),
 make('riverside','Riverside Clinic','clinic',560,315,'db',80,6,'Gives licensed autoimmune medicines and provides follow-up. Four treatment staff can start 80 people each quarter.'),
 make('lab','Coast Testing Lab','lab',235,175,'public',400,0,'Tests patient samples. Buy testing from this partner or build your own laboratory.'),
 make('supplier','Licensed Medicine Supplier','factory',125,380,'public',400,0,'Supplies existing licensed medicines. New personalized products need a compatible factory or local maker.'),
 make('east-clinic','Eastside Hospital','hospital',820,220,'available',80,1,'A hospital partner can add 80 treatment starts per quarter. DB receives service fees; the hospital retains its own care revenue.'),
 make('harbor-clinic','Harbor Clinic','clinic',670,95,'available',80,1,'An existing clinic available for partnership. Lower upfront cost and margin than owned capacity.'),
 make('campus','Central Campus','factory',350,420,'available',160,4,'An adaptable site: build a therapy factory, testing lab, clinic or specialist hospital.'),
 make('hill-site','North Campus','clinic',425,85,'available',80,6,'An available site for new clinical or manufacturing capacity.')];
}
export function initialLinks():Link[]{return[{id:'supplier-riverside',from:'supplier',to:'riverside',kind:'medicine',active:true,lastFlow:0,capacity:400},{id:'lab-riverside',from:'lab',to:'riverside',kind:'tests',active:true,lastFlow:0,capacity:400},{id:'community-riverside',from:'community',to:'riverside',kind:'patients',active:true,lastFlow:0,capacity:1000000000}];}
export const dateAt=(tick:number)=>`${2027+Math.floor(Math.min(95,tick)/4)} Q${Math.min(95,tick)%4+1}`;
