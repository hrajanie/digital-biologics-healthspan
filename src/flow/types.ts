import type {Company, CompanyValue, InvestorPosition} from '../core/types';
import type {Candidate} from '../network/types';
export type {Company, CompanyValue, InvestorPosition, Candidate};
export const FLOW_VERSION='flow-slice-1.0';
export type ProductId='partner-biologic'|'immune-reset'|'cancer-vaccine';
export type NodeId='people'|'lab'|'factory'|'clinic'|'followup';
export type Scenario='fast'|'measured';
export interface Population {total:number;unassessed:number;ineligible:number;waiting:number;baselineCare:number;nextPerson:number;pendingTests:{count:number;eligible:number;readyAt:number}[]}
export interface CareLot {id:string;firstPerson:number;count:number;productId:ProductId;generation:number;startMonth:number;candidate:Candidate;trialId:string|null;alive:number;experienced:number;remaining:number;continuity:number;age:number;followupMonths:number}
export interface Study {id:string;productId:ProductId;generation:number;mode:'own'|'codevelop'|'sponsored';started:number;stage:'preparation'|'recruitment'|'observation'|'analysis'|'passed'|'failed'|'stopped';preparationLeft:number;target:number;enrolled:number;observationMonths:number;observed:number;analysisLeft:number;totalBudget:number;dbBudget:number;paid:number;installments:number;response:number|null;harm:number|null;candidate:Candidate}
export interface Product {id:ProductId;name:string;kind:'fixed'|'personalized';description:string;available:boolean;candidate:Candidate;authorized:Candidate|null;rights:'none'|'delivery'|'owned'|'shared'|'sponsor-service';studies:Study[];readoutGeneration:number|null;readoutPassed:boolean;validation:number}
export interface Project {id:string;kind:'license'|'clinic'|'tests'|'supply'|'staff'|'trial-team'|'design'|'validation';name:string;readyAt:number;cost:number;quantity:number;productId?:ProductId;generation?:number;choice?:'replace'|'parallel';credits?:number}
export interface FlowEvent {id:string;month:number;kind:'delivery'|'world'|'clinical'|'finance'|'capacity'|'policy'|'warning'|'ending';title:string;detail:string;consequence:string;action:string;node?:NodeId;major:boolean}
export interface MonthAccount {commercialFollowups?:number;month:number;starts:number;trialStarts:number;tests:number;followups:number;receipts:number;costs:number;payroll:number;medicine:number;testing:number;research:number;corporate:number;royalties:number;cashFlow:number;healthAdded:number}
export interface Health {expected:number;experienced:number;remaining:number;people:number;tailError:number}
export type Action=
 |{type:'raise';amount:number}
 |{type:'license'}
 |{type:'expand';resource:'clinic'|'tests'|'supply'}
 |{type:'hire';people:number}
 |{type:'trial-team'}
 |{type:'start-study';productId:ProductId;mode:'own'|'codevelop'|'sponsored'}
 |{type:'update';productId:ProductId;choice:'replace'|'parallel'}
 |{type:'lab-partnership'}
 |{type:'validate-model';productId:ProductId}
 |{type:'policy'};
export type Command={kind:'plan';month:number;actions:Action[]}|{kind:'advance';month:number;months:number};
export interface State {version:typeof FLOW_VERSION;seed:number;scenario:Scenario;month:number;status:'active'|'slice-complete'|'insolvent'|'control-loss';company:Company;population:Population;cohorts:CareLot[];products:Product[];network:{licensed:boolean;supply:number;clinic:number;tests:number;followupEmployees:number;trialTeam:boolean};projects:Project[];world:{generation:number;compute:number;outsideAccess:number;biology:number;signal:string;rival:string};policy:{funded:boolean;accepted:boolean};labDeal:boolean;creditsUsed:number;events:FlowEvent[];accounts:MonthAccount[];commands:Command[];health:Health;lastStop:string;firstDeliveryReported:boolean;capacityNotice:string;roundMonth:number|null}
export interface Projection {sustainedFollowupRequired?:number;recommendedFollowupHires?:number;eligibilityTests?:number;safetyTests?:number;commercialFollowups?:number;sponsoredTrialStarts?:number;sponsoredObservation?:number;starts:number;trialStarts:number;tests:number;testResults:number;medicine:number;followupRequired:number;followupCapacity:number;followupDelivered:number;clinicUsed:number;clinicCapacity:number;testingCapacity:number;supplyCapacity:number;limiter:NodeId;reason:string;receipts:number;costs:number;cashFlow:number;payroll:number;corporate:number;research:number;employees:number;partnerEmployees:number}
export interface Quote {preMoney:number;maxRaise:number;reasons:string[];drivers:{label:string;value:string}[]}
export interface Option {id:string;title:string;description:string;action:Action;cost:number;totalCommitment:number;duration:number;effect:string;available:boolean;reason:string;node?:NodeId}
export interface Preview {milestoneLabel?:string;valid:boolean;reasons:string[];cashNow:number;cashAfter:number;upfront:number;remainingCommitments:number;cashAtMilestone:number;monthsToMilestone:number;before:Projection;after:Projection;effects:string[];dilution:number}
export interface View {state:State;date:string;projection:Projection;options:Option[];quote:Quote;value:CompanyValue;nextDecision:{label:string;months:number;detail:string};guidance:{title:string;detail:string;node:NodeId};lastAccount:MonthAccount|null;milestone:{title:string;complete:boolean;detail:string}}
