import type {CSSProperties} from 'react';
export function Icon({name,size=20,style,className=''}:{name:string;size?:number;style?:CSSProperties;className?:string}){
 const paths:Record<string,React.ReactNode>={
 arrow:<><path d="M5 12h14M13 6l6 6-6 6"/></>,
 chevron:<path d="m9 5 7 7-7 7"/>,
 close:<path d="m6 6 12 12M6 18 18 6"/>,
 plus:<path d="M12 5v14M5 12h14"/>,
 check:<path d="m5 12 4 4L19 6"/>,
 pause:<><path d="M8 5v14M16 5v14"/></>,
 play:<path d="m8 5 11 7-11 7Z"/>,
 undo:<><path d="M8 4 3 9l5 5M3 9h11a6 6 0 0 1 0 12"/></>,
 settings:<><path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/></>,
 info:<><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.2"/></>,
 network:<><circle cx="5" cy="6" r="3"/><circle cx="19" cy="7" r="3"/><circle cx="12" cy="19" r="3"/><path d="m7 8 4 8m6-6-4 6M8 6h8"/></>,
 clinic:<><path d="M4 21V6h16v15M9 6V3h6v3M9 21v-5h6v5M8 10h8m-4-3v6M2 21h20"/></>,
 diagnostics:<><circle cx="10" cy="9" r="5"/><path d="m14 13 6 7M7 9h6M10 6v6"/></>,
 manufacturing:<><path d="M3 21V9l6 4V9l6 4V3h4v18ZM7 17v1m5-1v1m5-1v1"/></>,
 evidence:<><path d="M4 19V5m0 14h17M8 14l4-5 4 3 5-7"/><circle cx="8" cy="14" r="1"/></>,
 followup:<><path d="M20 8a9 9 0 1 0 1 7M20 3v5h-5M7 12h3l2-4 2 8 2-4h4"/></>,
 programs:<><path d="M8 3v6L3 19q0 2 2 2h14q2 0 2-2L16 9V3M6 3h12M6 15h12"/><path d="M11 17v1M15 18v1"/></>,
 world:<><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 7h14M5 17h14"/></>,
 company:<><path d="M3 21h18M5 21V9h14v12M8 9V3h8v6M9 13v2m6-2v2M9 18v2m6-2v2"/></>,
 investor:<><path d="M4 17 10 11l4 3 7-10M15 4h6v6M4 21h17"/><circle cx="5" cy="5" r="2"/></>,
 health:<path d="M20.8 5.2a5.5 5.5 0 0 0-7.8 0L12 6.3l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-9a5.5 5.5 0 0 0 0-7.8Z"/>,
 shield:<><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,
 clock:<><circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/></>,
 download:<><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/></>,
 flag:<><path d="M5 22V3c5-5 9 5 14 0v10c-5 5-9-5-14 0"/></>,
 sparkle:<><path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/></>,
 lock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></>,
 sound:<><path d="M3 9h4l5-5v16l-5-5H3ZM16 8q4 4 0 8M19 4q8 8 0 16"/></>,
 };
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>{paths[name]||paths.sparkle}</svg>
}
