import type {Company,CompanyValue,InvestorPosition,ScenarioId} from '../core/types';
export type {CompanyValue,InvestorPosition,ScenarioId};
export type FacilityKind='community'|'clinic'|'hospital'|'lab'|'factory';
export type Delivery='clinic'|'local'|'home'|'wearable';
export type ProductKind='fixed'|'personalized';
export type StudyPhase='preclinical'|'phase1'|'phase2'|'phase3'|'approved';
export interface Facility {id:string;name:string;kind:FacilityKind;region:number;x:number;y:number;owner:'db'|'partner'|'public'|'available';status:'operating'|'building'|'closed';units:number;capacity:number;employees:number;followupEmployees?:number;basis:number;readyAt:number;delivery:Delivery;programId:string;trialTeam:boolean;lastStarts:number;lastFollowup:number;lastRevenue:number;lastCosts:number;limiting:string;description:string}
export interface Link {id:string;from:string;to:string;kind:'medicine'|'tests'|'patients';active:boolean;lastFlow:number;capacity:number}
export interface Region {id:number;name:string;population:number;treated:number;waiting:number;arrivals:number;jurisdiction:number;access:number}
export interface Candidate {generation:number;response:number;annualGain:number;durability:number;harm:number;predictionConfidence:number}
export interface Study {phase:Exclude<StudyPhase,'preclinical'|'approved'>;siteId:string;generation:number;package:'focused'|'broad';started:number;preparation:number;target:number;enrolled:number;observation:number;observed:number;review:number;paused:boolean;failed:boolean;cost:number;spent?:number;response:number|null;harm:number|null}
export interface Program {id:string;name:string;description:string;family:'autoimmune'|'oncology'|'neuro';kind:ProductKind;modality:string;availableAt:number;stage:StudyPhase;candidate:Candidate;frontier:Candidate;study:Study|null;evidence:number;authorizedGeneration:number;authorizedCandidate:Candidate|null;lastResult:string;starts:number;developmentSpend:number;platformEligible:boolean}
export interface World {generation:number;compute:number;biology:number;counterfactualAccess:number;releases:string[];nextSignal:string;localMakers:boolean;homeCare:boolean;homeMakers:boolean;wearables:boolean;rivals:{name:string;share:number;action:string}[]}
export interface Cohort {id:string;region:number;programId:string;siteId:string;count:number;start:number;generation:number;candidate:Candidate;experienced:number;remaining:number;alive:number;age:number;continuity:number;followupQuarters:number;followupRemaining:number;delivery:Delivery;baselineDelay:number}
export interface Health {expected:number;experienced:number;remaining:number;people:number;low:number;high:number;tailError:number}
export interface Policy {support:number;stage:'product'|'platform'|'personal';campaignSpend:number;window:number;nextWindow:number;pendingStage:'platform'|'personal'|null;effectiveAt:number;recognized:boolean}
export interface Event {id:string;tick:number;kind:'care'|'world'|'clinical'|'finance'|'policy'|'build'|'warning';title:string;detail:string;major:boolean}
export interface QuarterAccount {tick:number;starts:number;followup:number;revenue:number;costs:number;payroll:number;supplies:number;research:number;central:number;cashFlow:number;employees:number;partnerEmployees:number;healthAdded:number}
export interface Project {id:string;name:string;siteId:string;kind:'expand'|'partner'|'factory'|'lab'|'trial'|'local'|'home'|'wearable'|'replicate'|'staff';readyAt:number;cost:number;units:number;people?:number}
export type Action=
 |{type:'expand';siteId:string}
 |{type:'partner';siteId:string}
 |{type:'build';siteId:string;kind:'factory'|'lab'|'clinic'|'hospital'}
 |{type:'connect';from:string;to:string;kind:Link['kind']}
 |{type:'trial-team';siteId:string}
 |{type:'staff';siteId:string;people:number}
 |{type:'study';programId:string;siteId:string;package:'focused'|'broad'}
 |{type:'adopt';programId:string}
 |{type:'pause';programId:string}
 |{type:'stop';programId:string}
 |{type:'treatment';siteId:string;programId:string}
 |{type:'upgrade';siteId:string;delivery:Exclude<Delivery,'clinic'>}
 |{type:'policy';proposal:'evidence'|'personal'|'recognition';budget:number}
 |{type:'raise';amount:number;terms:'protected'|'growth'|'control'}
 |{type:'partnership';kind:'frontier'|'manufacturer'|'payer'}
 |{type:'sell';siteId:string}
 |{type:'replicate';siteId:string;region:number;units:number}
 |{type:'ipo'};
export interface Command {tick:number;actions:Action[];checksum:string}
export interface State {version:'network-2.2';seed:number;scenario:ScenarioId;tick:number;status:'active'|'victory'|'partial'|'insolvent'|'control-loss';company:Company;facilities:Facility[];links:Link[];regions:Region[];programs:Program[];world:World;policy:Policy;cohorts:Cohort[];health:Health;projects:Project[];events:Event[];account:QuarterAccount;accounts:QuarterAccount[];commands:Command[];historicalFollowup:number;creditsUsed:number;publicCompany:boolean;partnerships:string[];cureUntil:number|null}
export interface Option {id:string;label:string;detail:string;cost:number;duration:number;action:Action;available:boolean;reason:string;effect:string;category:'network'|'clinical'|'policy'|'finance'}
export interface Validation {valid:boolean;reasons:string[];cost:number}
export interface Projection {starts:number;revenue:number;costs:number;cashFlow:number;employees:number;partnerEmployees:number;limiting:string[]}
export interface Preview extends Validation {cashAfter:number;current:Projection;next:Projection;ready:Projection;summary:string[];dilution:number}
export interface BenefitEstimate {gross:number;incremental:number;low:number;high:number;response:number;harm:number;durability:number}
export interface View {state:State;options:Option[];projection:Projection;value:CompanyValue;fundraise:{preMoney:number;maxRaise:number;reasons:string[]};headline:string;guidance:string;date:string;siteLimiters:Record<string,string>;continuingCare:Record<string,{required:number;capacity:number;delivered:number}>}
