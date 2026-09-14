import {useId} from 'react';
import type {GameState, Region, Family} from '../core/types';
import {number,familyShort} from './format';
const fallbackPoints=[[218,160],[500,138],[772,183],[184,386],[480,345],[778,418]];
const families:Family[]=['diagnostics','clinic','manufacturing','evidence','followup','network'];
function Pine({x,y,scale=1}:{x:number;y:number;scale?:number}){return <g transform={`translate(${x} ${y}) scale(${scale})`}><ellipse cx="0" cy="5" rx="11" ry="4" fill="#366458" opacity=".08"/><path d="M0-30 11-9H6L14 3H-14L-6-9H-11Z" fill="#86a898"/><path d="M0-29V8" stroke="#567f70" strokeWidth="2"/><path d="m0-11 6 6m-6-13-5 5" stroke="#abc5ac"/></g>}
function Building({x=0,y=0,kind='clinic',level=1}:{x?:number;y?:number;kind?:Family;level?:number}){
 const small=kind==='diagnostics'||kind==='followup';
 return <g transform={`translate(${x} ${y})`}>
 <ellipse cx="1" cy="14" rx={small?25:34} ry="11" fill="#204e49" opacity=".1"/>
 {kind==='manufacturing'?<><path d="m-26-14 40-9 22 14-41 11Z" fill="#a1c5b8"/><path d="m-26-14 41 16v27l-41-16Z" fill="#e9ece0"/><path d="m15 2 21-11v25L15 29Z" fill="#88aaa0"/><path d="m-15-18 9 3v-26l-9-3Zm18-4 8 3v-16l-8-3Z" fill="#426f66"/><path d="m-20-2 8 3v10l-8-3Zm15 6 8 3v10l-8-3Z" fill="#59877d"/></>:<>
 <path d={small?'m-20-16 25-10 17 11L-4-5Z':'m-29-26 36-11 24 17L-5-8Z'} fill={kind==='evidence'?'#3e736a':'#658e80'}/>
 <path d={small?'m-20-16 16 11v25l-16-11Z':'m-29-26 24 18v35l-24-18Z'} fill="#d1d9c9"/>
 <path d={small?'m-4-5 26-10v26L-4 21Z':'m-5-8 36-12v36L-5 28Z'} fill="#f8f2df"/>
 {small?<><path d="m2 0 6-2v8l-6 2Zm12-4 6-2v8l-6 2Z" fill="#729d90"/><path d="m4 12 7-2v8l-7 2Z" fill="#275c55"/></>:<><path d="m2 1 7-2v9L2 10Zm13-4 7-2v9l-7 2Zm-36-15 7 5v9l-7-5Z" fill="#87afa1"/><path d="m7 16 9-3v11l-9 3Z" fill="#2b5d55"/><path d="m24 12 4-1v7l-4 1Z" fill="#adc5b6"/></>}
 {kind==='clinic'&&<g transform="translate(13 -21)"><path d="M-2-5h4v4h4v4H2v4h-4V3h-4v-4h4Z" fill="#eaf3e7"/></g>}
 {kind==='evidence'&&<><path d="m0-26 3-20 7 19" fill="none" stroke="#e8e8d7" strokeWidth="2"/><circle cx="3" cy="-44" r="4" fill="#e2b568"/></>}
 {kind==='network'&&<><path d="M10-28v-19m-7 5 7-5 8 1" fill="none" stroke="#345e53" strokeWidth="2"/><path d="m11-47 13 3-12 7Z" fill="#e2b568"/></>}
 </>}
 {level>1&&<><path d="m-39 12 10-4 10 7-11 4Z" fill="#709888"/><path d="m-39 12 9 7v13l-9-6Zm9 7 11-4v13l-11 4Z" fill="#d7e0cd"/></>}
 </g>
}
export function NetworkMap({state,selected,onSelect,decorative=false}:{state?:GameState;selected?:string;onSelect?:(id:string)=>void;decorative?:boolean}){
 const id=useId().replace(/:/g,'');
 const regions=state?.regions||[];
 // Authored diagram positions keep every region and label independently selectable.
 const layout:Record<string,[number,number]>={pacific:[190,260],northeast:[360,195],rhine:[520,340],nordic:[600,125],'east-asia':[825,300],'south-asia':[720,455]};
 const positions=regions.map((r,i)=>layout[r.id]??fallbackPoints[i%6]);
 const points=regions.length?positions:fallbackPoints;
 const links=[[0,1],[1,2],[0,3],[1,4],[2,5],[3,4],[4,5],[0,4]];
 const treePoints=[[70,90],[90,119],[109,97],[303,67],[326,81],[347,68],[610,69],[641,90],[910,187],[936,212],[906,240],[688,272],[710,301],[659,298],[51,337],[77,360],[105,335],[350,445],[370,467],[395,448],[845,501],[870,521],[894,508],[549,494],[573,516]];
 return <div className={`network-map ${decorative?'decorative-map':''}`}>
 <svg viewBox="0 0 1000 590" role={decorative?'img':'group'} aria-label={decorative?'Illustrated landscape of a future healthcare network':'Healthcare network. Select a region to plan its infrastructure.'}>
 <defs><linearGradient id={`${id}water`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#b4d7cd"/><stop offset="1" stopColor="#d6e8dd"/></linearGradient><linearGradient id={`${id}land`} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#e3e8d5"/><stop offset="1" stopColor="#f1ecdc"/></linearGradient><filter id={`${id}blur`}><feGaussianBlur stdDeviation="13"/></filter></defs>
 <rect width="1000" height="590" fill={`url(#${id}land)`}/>
 <path d="M-20 396C90 363 107 452 190 474s143-34 202-10 91 108 226 67 139-76 246-22 123 11 156-23v124H-20Z" fill={`url(#${id}water)`}/>
 <path d="M1006 12C862 28 870 89 860 118s-64 57-104 26-107-17-131 48 3 119-36 153-116 44-119 99 59 102 52 150" stroke="#b5d3c7" strokeWidth="27" fill="none"/>
 <path d="M1006 12C862 28 870 89 860 118s-64 57-104 26-107-17-131 48 3 119-36 153-116 44-119 99 59 102 52 150" stroke="#c3dfd2" strokeWidth="21" fill="none"/>
 <path d="M-50 183C45 87 69 8 165-9s142 11 181-17H-50ZM391-11c78 36 75 101 139 127s95-48 138-104Z" fill="#cbd9bc" opacity=".6"/>
 <path d="M-16 178C58 113 64 44 170 17M-12 204C79 147 93 70 186 46M423-7c62 49 49 94 110 103" stroke="#abbf9f" opacity=".35" fill="none"/>
 <path d="M732 371c56-53 110-9 160-40s89 11 133 72v37c-111-23-121 10-212 3s-103-47-81-72Z" fill="#dae0c5"/>
 <path d="M736 376c94-36 111 25 186-26M760 399c65-20 77 24 146-11" stroke="#c1cdae" fill="none" opacity=".6"/>
 <g opacity=".55" stroke="#fcf7e9" strokeWidth="6" fill="none"><path d="M-10 281 122 249 171 263 294 266 368 209 452 248 581 233 713 291 836 293 1010 338"/><path d="m98 10 19 115 91 74 13 146 36 198M387 590l-11-167 83-60 20-153-9-207M758 0l-27 233 44 129 23 231"/></g>
 <g stroke="#c9ceba" strokeWidth="1" fill="none" opacity=".8"><path d="m30 478 33-47 48 14-15 43Zm48 13 24-46 33 24-21 31M842 32l58 1 2 20-58-2Zm-8 29 73-1-5 23-64 1Z"/><path d="m270 119 48 10-7 17-45-11Zm-8 24 44 11-6 22-45-13"/></g>
 {treePoints.map(([x,y],i)=><Pine key={i} x={x} y={y} scale={.6+(i%3)*.16}/>)}
 <g className="map-routes">
 {links.map(([a,b],i)=>{if(!points[a]||!points[b])return null; const [ax,ay]=points[a],[bx,by]=points[b];const path=`M${ax} ${ay+24} Q${(ax+bx)/2} ${(ay+by)/2+(i%2?35:-20)} ${bx} ${by+24}`;const active=regions[a]?.unlocked&&regions[b]?.unlocked;const care=active&&((regions[a]?.lastTreated||0)+(regions[b]?.lastTreated||0)>0);const trial=active&&((regions[a]?.lastTrial||0)+(regions[b]?.lastTrial||0)>0);return <g key={i}><path d={path} stroke={active?'#759f8f':'#aebdab'} strokeWidth={active?2.5:1.5} strokeDasharray={active?'5 5':'3 8'} fill="none" opacity={active?.65:.45}/>{care&&<><path d={path} className="care-flow"/><circle r="3.5" fill="#14584e" className="flow-dot"><animateMotion dur={`${4+i*.4}s`} repeatCount="indefinite" path={path}/></circle></>}{trial&&<circle r="2.5" fill="#b58948" className="flow-dot"><animateMotion dur={`${6+i*.4}s`} repeatCount="indefinite" path={path}/></circle>}</g>})}
 </g>
 {points.map(([x,y],i)=>{const region=regions[i];const unlocked=region?.unlocked??(i<3);const level=region?Object.values(region.levels).reduce((a,b)=>a+b,0):2;const selectedRegion=selected===region?.id;const projects=state?.projects.filter(p=>p.regionId===region?.id)||[];return <g key={region?.id||i} className={`region-node ${selectedRegion?'selected':''} ${unlocked?'':'locked'}`} transform={`translate(${x} ${y})`} role={region?'button':undefined} tabIndex={region?0:undefined} aria-label={region?`${region.name}. ${unlocked?'Active region':'Not yet connected'}. ${number(region.lastTreated)} people treated last quarter. ${number(region.waiting)} waiting.`:undefined} aria-pressed={region?selectedRegion:undefined} onClick={()=>region&&onSelect?.(region.id)} onKeyDown={e=>{if(region&&(e.key==='Enter'||e.key===' ')){e.preventDefault();onSelect?.(region.id)}}}>
 <ellipse className="selection-halo" cx="0" cy="20" rx="65" ry="27" fill="none" stroke="#1c6758" strokeWidth="2" strokeDasharray="4 5" opacity={selectedRegion?1:0}/>
 <ellipse cx="0" cy="21" rx="51" ry="21" fill={unlocked?'#c3d7bd':'#dce1cd'} opacity=".65"/>
 {unlocked?<><Building kind={i===1?'evidence':i===2?'manufacturing':'clinic'} level={level>3?2:1}/>{level>6&&<Building x={-35} y={13} kind="diagnostics" level={1}/>}<Pine x={39} y={13} scale={.65}/>{(region?.levels.manufacturing||0)>0&&<g transform="translate(39 -12)"><rect x="-6" y="-5" width="12" height="10" rx="2" fill="#e6b873" stroke="#996c36"/><path d="M0-5V5" stroke="#f9ecd0"/></g>}</>:<><path d="m-22 7 28-9 18 13-29 10Z" fill="#d5d9c3"/><path d="m-22 7 17 14v9l-17-13m17 4 29-10v9L-5 30" fill="#bbc8b1"/><path d="M0-15v21M0-15h19L0-5" stroke="#90a590" strokeWidth="2" fill="#bdccad"/></>}
 {projects.length>0&&<g className="construction-marker" transform="translate(-38 -33)"><rect x="-9" y="-9" width="18" height="18" rx="5" fill="#b98648"/><path d="M-5-2h10M-3 2h6M-2-5v10" stroke="#fff3d9" strokeWidth="1.5"/></g>}
 <g transform="translate(0 51)"><rect className="node-label-bg" x="-79" y="-13" width="158" height="42" rx="7" fill="#fbf8ed" fillOpacity={selectedRegion?.97:.87}/><text y="3" textAnchor="middle" className="node-title">{region?.name||['Pacific Coast','North Atlantic','Central Europe','Equatorial Network','South Asia','East Asia'][i]}</text><text y="19" textAnchor="middle" className="node-detail">{region?projects.length?`Building · ${projects[0].remaining} quarters`:unlocked?region.lastTreated>0?`${number(region.lastTreated)} people / quarter`:level>0?'Preparing for care':'Build your first clinic':'Partnership opportunity':unlocked?'A new beginning':'Future network'}</text></g>
 {region&&region.lastTreated>0&&<g transform="translate(39 -37)"><circle r="14" fill="#1e6656"/><path d="m-6 0 4 4 8-9" fill="none" stroke="#f6f6e6" strokeWidth="2"/></g>}
 </g>})}
 <g transform="translate(946 64)" stroke="#638474" fill="none" opacity=".7"><path d="M0-18V18M-12 6 0-18 12 6 0 0Z"/><text y="-27" textAnchor="middle" fill="#638474" stroke="none" fontSize="11">N</text></g>
 <text x="651" y="555" fill="#6b9e92" fontSize="11" letterSpacing="5" fontStyle="italic">THE CONNECTED WORLD</text>
 </svg>
 {!decorative&&<div className="map-legend"><span><i className="legend-dot care"/> Care & materials</span><span><i className="legend-dot evidence"/> Clinical evidence</span><span className="map-legend-note">Flows reflect the last quarter</span></div>}
 </div>
}
export function RegionSummary({region}:{region:Region}){return <div className="region-mini-levels">{families.map(f=><div key={f} title={`${familyShort[f]}: level ${region.levels[f]}`}><span>{familyShort[f]}</span><div className="level-pips">{[1,2,3,4].map(n=><i key={n} className={region.levels[f]>=n?'filled':''}/>)}</div></div>)}</div>}
