/** Stateless keyed draws: ordering an unrelated system cannot change clinical outcomes. */
export function random(seed:number,...keys:(number|string)[]):number {
 let h=(seed^0x811c9dc5)>>>0;
 for(const c of keys.join('|')) {h^=c.charCodeAt(0); h=Math.imul(h,16777619)>>>0;}
 h+=0x6d2b79f5; h=Math.imul(h^(h>>>15),h|1); h^=h+Math.imul(h^(h>>>7),h|61);
 return ((h^(h>>>14))>>>0)/4294967296;
}
export function hash(value:unknown):string {let h=2166136261;for(const c of JSON.stringify(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(16).padStart(8,'0');}
export const clamp=(n:number,lo=0,hi=1)=>Math.min(hi,Math.max(lo,n));
