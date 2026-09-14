/** Money is integer USD cents. Shares are exact rational strings. */
export type Money = number;
export type Family = 'diagnostics'|'clinic'|'manufacturing'|'evidence'|'followup'|'network';
export type ScenarioId = 'convergence'|'staggered';
export type Mode = 'campaign'|'investor';
export type StudyPackage = 'narrow'|'broad'|'partner';
export type Stage = 'preclinical'|'phase1'|'phase2'|'phase3'|'approved'|'platform';
export type ProgramOperation = 'start'|'advance'|'pause'|'resume'|'bridge'|'stop'|'readiness';
export type Action =
 | {type:'build';regionId:string;family:Family}
 | {type:'program';programId:string;operation:ProgramOperation;package?:StudyPackage}
 | {type:'deal';dealId:string;variant:number;regionId?:string;programId?:string}
 | {type:'policy';operation:'lobby'|'platform'|'charter'|'recognition';budget?:number;variant?:number}
 | {type:'priority';priority:'balanced'|'care'|'research'}
 | {type:'wait'};
export interface ShareClass { id:string; name:string; shares:string; invested:Money; preferred:boolean; reserved?:boolean }
export interface Round {id:string;year:number;name:string;raised:Money;preMoney:Money;postMoney:Money;classId:string;issuedShares:string;poolTopup:number}
export interface Company {cash:Money;credits:Money;debt:Money;revenue:Money;expenses:Money;capex:Money;taxes:Money;royalty:number;founderSeats:number;strategicControl:boolean;ceo:boolean;control:'retained'|'at-risk'|'lost';cureQuarter:number|null;classes:ShareClass[];rounds:Round[];contracts:Contract[];priority:'balanced'|'care'|'research';totalRevenue:Money;totalSpend:Money;lastRevenue:Money;lastExpenses:Money}
export interface Contract {id:string;family:string;name:string;start:number;end:number;annualCost:Money;annualRevenue:Money;royalty:number;capacity:number;exclusive:boolean;portable:boolean;regionId?:string;programId?:string;restricted?:boolean;details?:string}
export interface Region {id:string;name:string;jurisdiction:number;unlocked:boolean;x:number;y:number;population:number;waiting:number;treated:number;levels:Record<Family,number>;quality:number;capacity:number;lastTreated:number;lastTrial:number;bottleneck:Family|'permission'|'demand'|'cash';utilization:number;siteCount:number;queue?:{gross:number;rivals:number;followupRequired:number;followup:number;trials:number;care:number;idle:number}}
export interface Study {package:StudyPackage;phase:Stage;readiness:number;enrolled:number;target:number;observation:number;observationRequired:number;review:number;budget:Money;spent:Money;start:number;paused:boolean;version:number;observedResponse:number;observedHarm:number}
export interface Program {id:string;name:string;family:'autoimmune'|'oncology'|'neuro';modality:string;stage:Stage;version:number;availableVersion:number;readiness:number;evidence:number;response:number;durability:number;harm:number;benefit:number;study:Study|null;active:boolean;licensed:boolean;partnered:boolean;starts:number;lastResult:string;platformScope:boolean;royalty?:number}
export interface Project {id:string;name:string;kind:'build'|'platform'|'recognition';regionId?:string;family?:Family;remaining:number;cost:Money;started:number;targetLevel?:number}
export interface Policy {stage:'product'|'demonstration'|'agenda'|'offered'|'implementing'|'platform'|'personal';support:number;lobbyBudget:Money;charter:number|null;implementation:number;recognition:boolean;qualified:boolean;window:number;scope:string[];history:string[]}
export interface Rival {id:string;name:string;kind:'lab'|'hospital'|'pharma';capacity:number;capital:Money;share:number;strategy:string;lastAction:string}
export interface World {research:number;compute:number;biology:number;access:number;modelVersion:number;releases:string[];rivals:Rival[];counterfactualAccess:number;counterfactualPolicy:number;lastShift:string}
export interface Cohort {id:string;profileId:string;regionId:string;programId:string;count:number;start:number;age:number;version:number;response:number;durability:number;annualGain:number;harm:number;continuity:number;experienced:number;remaining:number;baselineDelay:number;alive:number;history:string[]}
export interface HealthScore {expected:number;experienced:number;remaining:number;outsideHarm:number;low:number;high:number;people:number;worldwide:number;tailError:number}
export interface GameEvent {id:string;quarter:number;year:number;kind:'world'|'clinical'|'finance'|'policy'|'network'|'patient'|'warning'|'ending';title:string;detail:string;major:boolean;source?:string}
export interface Trace {cashAfterCommit?:Money;id:string;quarter:number;actions:Action[];cashBefore:Money;cashAfter:Money;healthBefore:number;healthAfter:number;events:string[];delegated:boolean;checksum:string}
export interface Snapshot {year:number;score:number;cash:Money;revenue:Money;people:number;control:string;valuation?:number}
export interface GameState {schemaVersion:number;engineVersion:string;contentVersion:string;id:string;seed:number;scenario:ScenarioId;mode:Mode;year:number;quarter:number;tick:number;phase:'planning'|'resolving'|'ended';status:'active'|'victory'|'partial'|'control-loss'|'insolvent';company:Company;regions:Region[];programs:Program[];projects:Project[];policy:Policy;world:World;cohorts:Cohort[];score:HealthScore;events:GameEvent[];trace:Trace[];history:Snapshot[];committed:Action[];delegated:boolean;seenDecisions:string[];outsideHarm:number;trialFollowup?:Record<string,number>}
export interface ActionOption {budgetLimit?:Money;id:string;label:string;description:string;action:Action;cost:Money;duration:string;available:boolean;reason:string;category:string;impact:string}
export interface Validation {valid:boolean;reasons:string[];cost:Money}
export interface Preview extends Validation {cashAfter:Money;summary:string[];careLow:number;careHigh:number;control:string}
export interface GameView {value:CompanyValue;state:GameState;options:ActionOption[];headline:string;guidance:string;capacity:number;waiting:number;runway:number;activePrograms:number;maxPrograms:number;nextShift:string}
export interface ForecastYear {starts?:number;contractStarts?:Record<string,number>;year:number;receipts:Money;operations:Money;capex:Money;taxes:Money;freeCash:Money;recurring:Money;fundingGap:Money}
export interface CompanyValue {enterprise:Money;equity:Money;low:Money;high:Money;residual:Money;residualShare:number;discount:number;multiple:number;forecast:ForecastYear[];fundingGap:Money;explanation:string[]}
export interface ExitAllocation {classId:string;proceeds:Money;converted:boolean}
export interface InvestorPosition {check:Money;roundId:string;initialOwnership:number;ownership:number;shares:string;proceeds:Money;low:Money;high:Money;multiple:number;entryValue:Money}
export interface RegionDefinition {id:string;name:string;jurisdiction:number;x:number;y:number;population:number;description:string}
export interface ProgramDefinition {id:string;name:string;family:Program['family'];modality:string;description:string;available:number;initialStage:Stage;benefit:number;durability:number;response:number;harm:number;cost:Money;price:Money;scope:string}
export interface ReleaseDefinition {id:string;year:number;title:string;detail:string;research:number;compute:number;biology:number;access:number;version:number}
export interface DealVariant {name:string;description:string;cash:Money;credits:Money;preMoney:Money;poolTopup:number;annualCost:Money;annualRevenue:Money;royalty:number;capacity:number;duration:number;exclusive:boolean;portable:boolean;founderSeats:number;strategicControl:boolean}
export interface DealDefinition {id:string;family:string;name:string;description:string;availableYear:number;variants:DealVariant[]}
export interface EventDefinition {id:string;title:string;detail:string;kind:GameEvent['kind'];trigger:string}
