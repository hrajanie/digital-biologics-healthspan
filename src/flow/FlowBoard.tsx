import {useEffect, useId, useRef, useState} from 'react';
import type {CSSProperties, PointerEvent as ReactPointerEvent} from 'react';
import type {NodeId, ProductId, View} from './types';
import './board.css';

type Props = {view: View; selected: NodeId; onSelect: (node: NodeId) => void; productId: ProductId};
type Point = [number, number];
const WORLD = {width: 1320, height: 520};
const POSITIONS: Record<NodeId, Point> = {people: [130, 359], lab: [370, 126], factory: [850, 126], clinic: [650, 359], followup: [1120, 359]};
const TITLES: Record<NodeId, string> = {people: 'People waiting', lab: 'Patient testing lab', factory: 'Therapy manufacturer', clinic: 'Treatment & trial clinic', followup: 'Clinic follow-up team'};
const SHORT_TITLES: Record<NodeId, string> = {people: 'People waiting', lab: 'Patient testing lab', factory: 'Therapy factory', clinic: 'Treatment & trials', followup: 'Follow-up team'};
const count = (value: number) => Math.max(0, Math.round(value)).toLocaleString('en-US');
const iso = (x: number, y: number, z = 0): Point => [110 + (x - y) * .84, 113 + (x + y) * .42 - z];
const points = (...p: Point[]) => p.map(v => v.join(',')).join(' ');

/** Original shared-angle vector objects. These are illustrative objects, never patient counts. */
function Box({x, y, w, d, h, z = 0, top = '#f9faf3', left = '#d6e2d9', right = '#9eb7ac'}: {x: number; y: number; w: number; d: number; h: number; z?: number; top?: string; left?: string; right?: string}) {
  return <g stroke="#45675d" strokeWidth=".65" strokeLinejoin="round">
    <polygon points={points(iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h))} fill={left}/>
    <polygon points={points(iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h))} fill={right}/>
    <polygon points={points(iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h))} fill={top}/>
  </g>;
}
function Person({x, y, z = 8, coat = '#447867'}: {x: number; y: number; z?: number; coat?: string}) {
  const [cx, cy] = iso(x, y, z);
  return <g><ellipse cx={cx} cy={cy + 5} rx="4.4" ry="2" fill="#406453" opacity=".14"/><path d={`M${cx - 2.4},${cy}l-.7,7m5.5,-7l.7,7`} stroke="#244f43" strokeWidth="1.6" strokeLinecap="round"/><path d={`M${cx},${cy - 9}v9`} stroke={coat} strokeWidth="7" strokeLinecap="round"/><circle cx={cx} cy={cy - 15} r="3.9" fill="#c99873"/><path d={`M${cx - 3.6},${cy - 16}q3,-6 7.2,0`} fill="#264b40"/></g>;
}
function Tank({x, y, height = 45}: {x: number; y: number; height?: number}) {
  const [cx, cy] = iso(x, y, 9);
  return <g stroke="#587c6f" strokeWidth=".8"><path d={`M${cx - 13},${cy - height}v${height}a13,6 0 0 0 26,0v-${height}`} fill="#b2cac0"/><path d={`M${cx - 4},${cy - height + 5}v${height - 4}`} stroke="#e4eee5" strokeWidth="8"/><ellipse cx={cx} cy={cy - height} rx="13" ry="6" fill="#edf4e9"/><ellipse cx={cx} cy={cy - height} rx="4" ry="1.8" fill="#7aa792"/><path d={`M${cx + 6},${cy - height + 12}v${height - 22}`} stroke="#315e4d" strokeWidth="2"/><path d={`M${cx - 12},${cy - 8}q12,9 24,0`} fill="none"/><rect x={cx - 3} y={cy - height + 14} width="6" height="8" rx="1" fill="#154d3e"/><path d={`M${cx - 1},${cy - height + 17}h2`} stroke="#9ce3bf"/></g>;
}
function FacilityArt({kind, active}: {kind: NodeId; active: boolean}) {
  const clinic = kind === 'clinic';
  return <svg className={`fb-art fb-art-${kind}`} viewBox="0 20 220 140" aria-hidden="true">
    <ellipse cx="112" cy="134" rx={kind === 'followup' ? 64 : 92} ry="27" fill="#486a5d" opacity=".10"/>
    {kind === 'people' ? <>
      <Box x={-52} y={-37} w={104} d={76} h={4} top="#e7eddb" left="#cbd8bd" right="#b1c5ae"/>
      <polygon points={points(iso(-41, 1, 5), iso(46, 1, 5), iso(46, 16, 5), iso(-41, 16, 5))} fill="#f6f4e9"/>
      <Box x={-36} y={-29} w={29} d={17} h={13} top="#f4ecdb" left="#dbcbb2" right="#c5b894"/>
      <Box x={-39} y={-31} w={35} d={22} h={3} z={14} top="#436957" left="#2d5646" right="#214739"/>
      <Box x={19} y={-27} w={20} d={17} h={9} top="#d7e2bb" left="#a6bf90" right="#859f78"/>
      {[[-31, 22], [-19, 8], [-2, -8], [10, 10], [31, 19], [37, -4], [-10, 30], [13, 32]].map(([x, y], i) => <Person key={i} x={x} y={y} coat={['#366455', '#d9b269', '#7fa7a0', '#e9eee2'][i % 4]}/>)}
      <path d="M54,90v-21m6,9h-12" stroke="#829c70" strokeWidth="3" strokeLinecap="round"/>
    </> : kind === 'followup' ? <>
      <Box x={-38} y={-27} w={76} d={55} h={5} top="#ecede1" left="#d0d8c9" right="#a9beb1"/>
      <Box x={-32} y={-19} w={55} d={20} h={20} top="#f8f8ef" left="#dce5d8" right="#aac2b3"/>
      {[-19, 9].map((x, i) => <g key={x}><Box x={x} y={-13} w={16} d={3} h={15} z={22} top="#2c6755" left="#153e34" right="#3d7964"/><Person x={x + 7} y={14} coat={i ? '#518577' : '#e9efe2'}/></g>)}
      <path d="M87,76l5,-6 4,5 8,-10" fill="none" stroke="#9ae1b5" strokeWidth="1.5"/>
      <Box x={25} y={12} w={13} d={13} h={17} top="#d4e1cc" left="#91ae94" right="#71987e"/>
    </> : <>
      <Box x={-55} y={-37} w={110} d={78} h={6} top="#e9eee1" left="#c4d2c4" right="#a6b9aa"/>
      <Box x={-48} y={-31} w={94} d={7} h={48} z={6} top="#f6f6eb" left="#dfebe0" right="#aac1b1"/>
      <Box x={-48} y={-26} w={7} d={55} h={39} z={6} top="#faf8ee" left="#e2e7d8" right="#a8c0af"/>
      {clinic ? <>
        {[-26, 0, 26].flatMap(x => [-8, 21].map(y => <g key={`${x}-${y}`}><Box x={x} y={y} w={16} d={17} h={9} z={6} top="#d3e9db" left="#78a98f" right="#65927e"/><Box x={x} y={y} w={16} d={4} h={17} z={10} top="#d9eee0" left="#83b79c" right="#538a6b"/><path d={`M${iso(x + 19, y, 6).join(',')}v-31h-6`} stroke="#789b8c" strokeWidth="1.2"/><rect x={iso(x + 15, y, 27)[0]} y={iso(x + 15, y, 27)[1]} width="4" height="7" rx="1" fill="#f5f7e8" stroke="#648d7c" strokeWidth=".6"/></g>))}
        <Box x={-50} y={-33} w={99} d={19} h={4} z={56} top="#305e4c" left="#194836" right="#12412f"/>
        <path d="M110,48v12m-6,-6h12" stroke="#f5f6df" strokeWidth="3"/>
        <Person x={-28} y={32} coat="#f3f5eb"/>
        <Person x={46} y={17} coat="#54897c"/>
      </> : kind === 'lab' ? <>
        <Box x={-32} y={-14} w={62} d={23} h={21} z={6} top="#f7f8ec" left="#d5e0d0" right="#9cbaa8"/>
        <Box x={-29} y={-12} w={26} d={17} h={24} z={27} top="#b4d9d0" left="#d9eee4" right="#7da99a"/>
        <polygon points={points(iso(-28, 5, 31), iso(-5, 5, 31), iso(-5, 5, 47), iso(-28, 5, 47))} fill="#285e50" opacity=".8"/>
        <Box x={3} y={-8} w={20} d={14} h={4} z={28} top="#d8e8dd" left="#639785" right="#4a7f6b"/>
        {[7, 13, 19].flatMap(x => [-4, 2].map(y => {const p = iso(x, y, 38); return <path key={`${x}${y}`} d={`M${p[0]},${p[1]}v5`} stroke="#408c95" strokeWidth="3" strokeLinecap="round"/>;}))}
        <Box x={18} y={24} w={26} d={13} h={15} z={6} top="#e9ede0" left="#a2bdae" right="#6a9580"/>
        <Person x={-8} y={24} coat="#f4f4e6"/>
        <Box x={-48} y={-33} w={96} d={15} h={4} z={56} top="#5c8c82" left="#396b60" right="#255848"/>
      </> : <>
        <Tank x={-22} y={-6}/><Tank x={12} y={-9} height={52}/>
        <Box x={27} y={6} w={19} d={23} h={26} z={6} top="#e3eee0" left="#a8c5ae" right="#639a7e"/>
        <path d="M85,66v-13h42v11" fill="none" stroke="#718d7b" strokeWidth="4" strokeLinejoin="round"/>
        <Box x={-31} y={24} w={51} d={12} h={8} z={6} top="#b5c9ae" left="#698b6c" right="#537857"/>
        {[-24, -8, 8].map(x => <Box key={x} x={x} y={25} w={10} d={10} h={10} z={15} top="#fbf4d5" left="#daca9c" right="#bca976"/>)}
        <Box x={-48} y={-33} w={96} d={14} h={4} z={56} top="#739882" left="#4a7158" right="#345c43"/>
      </>}
    </>}
    {kind !== 'people' && <g><circle cx="183" cy="137" r="4.7" fill={active ? '#087d61' : '#bc8c4c'} stroke="#fff9ed" strokeWidth="2"/></g>}
  </svg>;
}

function Route({d, label, detail, labelAt, tone = 'care', blocked = false, onClick, id}: {d: string; label: string; detail: string; labelAt: Point; tone?: 'care'|'test'|'medicine'; blocked?: boolean; onClick: () => void; id: string}) {
  return <>
    <svg className={`fb-edge ${blocked ? 'is-blocked' : ''} fb-edge-${tone}`} viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} aria-hidden="true">
      <path d={d} className="fb-edge-halo"/>
      <path d={d} className="fb-edge-line" markerEnd={`url(#${id}-${blocked ? 'blocked' : tone})`}/>
    </svg>
    <button type="button" className={`fb-route-label fb-route-${tone} ${blocked ? 'is-blocked' : ''}`} style={{left: labelAt[0], top: labelAt[1]}} onClick={onClick} aria-label={`${label}. ${detail}. Inspect this dependency.`}>
      <span>{blocked && <span aria-hidden="true">! </span>}{label}</span><small>{detail}</small>
    </button>
  </>;
}

export default function FlowBoard({view, selected, onSelect, productId}: Props) {
  const {state, projection: p} = view;
  const product = state.products.find(candidate => candidate.id === productId) ?? state.products[0];
  const viewport = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({width: 1320, height: 520});
  const [camera, setCamera] = useState({zoom: 1, x: 0, y: 0});
  const drag = useRef<{x: number; y: number; startX: number; startY: number} | null>(null);
  const markerId = `fb${useId().replace(/:/g, '')}`;
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setSize({width: entry.contentRect.width, height: entry.contentRect.height}));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const fit = Math.min((size.width - 12) / WORLD.width, (size.height - 12) / WORLD.height);
  const scale = fit * camera.zoom;
  const translateX = (size.width - WORLD.width * scale) / 2 + camera.x;
  const translateY = (size.height - WORLD.height * scale) / 2 + camera.y;
  const totalPatients = p.starts + p.trialStarts;
  const followupShortfall = Math.max(0, p.followupRequired - p.followupCapacity);
  const studies = product?.studies.filter(s => !['passed', 'failed', 'stopped'].includes(s.stage)) ?? [];
  const selectedEnrollment = studies.reduce((sum, study) => sum + study.enrolled, 0);
  const selectedTarget = studies.reduce((sum, study) => sum + study.target, 0);
  const selectedRecruiting = studies.some(study => study.stage === 'recruitment');
  const otherRecruiting = state.products.some(pr => pr.id !== productId && pr.studies.some(study => study.stage === 'recruitment'));
  // The slice exposes total recruitment. Attribute it only when one program is recruiting.
  const selectedMonthlyEnrollment = !selectedRecruiting ? 0 : otherRecruiting ? null : p.trialStarts;
  const isDevelopment = productId !== 'partner-biologic' && !product?.authorized;
  const type = isDevelopment ? 'Trial route' : 'Treatment route';
  const nodeData: Record<NodeId, {purpose: string; number: string; unit: string; detail: string; active: boolean}> = {
    people: {purpose: 'People, not a resource to manufacture', number: count(state.population.waiting), unit: 'eligible people waiting', detail: `${count(state.population.unassessed)} still need assessment`, active: totalPatients > 0},
    lab: {purpose: 'Checks who can safely receive treatment', number: `${count(p.tests)} / ${count(p.testingCapacity)}`, unit: 'patient tests / month', detail: 'Eligibility & safety reports → clinic', active: p.tests > 0},
    factory: {purpose: 'One slot supplies one partner dose or one trial batch', number: `${count(p.medicine)} / ${count(p.supplyCapacity)}`, unit: 'medicine slots / month', detail: `${count(p.starts)} partner doses · ${count(p.trialStarts)} trial batches`, active: p.medicine > 0},
    clinic: {purpose: 'Treats patients and runs clinical studies', number: `${count(p.clinicUsed)} / ${count(p.clinicCapacity)}`, unit: 'appointments / month', detail: `${count(p.starts)} care starts · ${count(p.trialStarts)} trial starts`, active: totalPatients > 0},
    followup: {purpose: 'Same clinic · care after treatment', number: `${count(p.followupRequired)} / ${count(p.followupCapacity)}`, unit: 'visits needed / supported each month', detail: `${count(state.network.followupEmployees)} staff${followupShortfall > 0 ? ` · ${count(followupShortfall)} visits short` : ` · ${count(Math.max(0, p.followupCapacity - p.followupRequired))} spare visits`}`, active: p.followupDelivered > 0},
  };
  const select = (node: NodeId) => onSelect(node);
  const zoom = (amount: number) => setCamera(current => ({...current, zoom: Math.max(.85, Math.min(1.8, Math.round((current.zoom + amount) * 100) / 100))}));
  const down = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as Element).closest('button') || event.button !== 0) return;
    drag.current = {x: event.clientX, y: event.clientY, startX: camera.x, startY: camera.y};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const start = drag.current;
    setCamera(current => ({...current, x: Math.max(-450, Math.min(450, start.startX + event.clientX - start.x)), y: Math.max(-300, Math.min(300, start.startY + event.clientY - start.y))}));
  };
  const end = () => {drag.current = null;};
  const node = (kind: NodeId, mobile = false) => {
    const data = nodeData[kind];
    const position = POSITIONS[kind];
    return <div key={kind} data-node={kind} className={`fb-node ${selected === kind ? 'is-selected' : ''} ${p.limiter === kind ? 'is-limiting' : ''} ${mobile ? 'fb-mobile-node' : ''}`} style={mobile ? undefined : {left: position[0], top: position[1]}}>
      <button type="button" className="fb-art-button" tabIndex={-1} aria-hidden="true" onClick={() => select(kind)}><FacilityArt kind={kind} active={data.active}/></button>
      <button type="button" className="fb-node-control" aria-pressed={selected === kind} onClick={() => select(kind)} aria-label={`${TITLES[kind]}. ${data.number} ${data.unit}. ${data.detail}.${p.limiter === kind ? ' Current bottleneck.' : ''}`}>
        <span className="fb-node-title">{SHORT_TITLES[kind]}{p.limiter === kind && <span className="fb-limit-dot" aria-label="Current bottleneck"/>}</span>
        <span className="fb-node-number">{data.number}</span>
        <span className="fb-node-unit">{data.unit}</span>
        <span className="fb-node-detail">{data.detail}</span>
        <span className="fb-node-purpose">{data.purpose}</span>
      </button>
    </div>;
  };
  return <section className="flow-board" aria-label="Treatment dependency network">
    <header className="fb-heading"><div><span className="fb-eyebrow">{type} · {product?.name ?? 'Shared delivery network'}</span><h2>A complete route to care.</h2></div><div className="fb-shared-note">Shared network capacity<span>Forecast for next month</span></div></header>
    <div className={`fb-route-context ${isDevelopment ? 'fb-development-context' : ''}`}>{isDevelopment ? <><span className="fb-study-tag">Selected program</span><span title={`${count(selectedEnrollment)} of ${count(selectedTarget)} participants enrolled so far`}>{selectedMonthlyEnrollment === null ? <b>Recruitment shared across studies</b> : <b>{count(selectedMonthlyEnrollment)} trial enrollments / month</b>}</span><span className="fb-partner-attribution">Partner care: <b>{count(p.starts)} starts / month</b></span><span>Shared resources below.</span></> : <><span className="fb-study-tag">Partner delivery</span>People need a test result, medicine, an appointment and continuing support.</>}</div>
    <div className="fb-viewport" ref={viewport} onPointerDown={down} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-label="Schematic network. Drag empty space to pan. Zoom moves facilities, links and work surface together.">
      <div className="fb-world" data-testid="flow-world" style={{width: WORLD.width, height: WORLD.height, transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`, '--fb-label-floor': `${Math.max(1, .95 / scale)}`} as CSSProperties}>
        <svg className="fb-ground" viewBox={`0 0 ${WORLD.width} ${WORLD.height}`} aria-hidden="true"><defs>
          <pattern id={`${markerId}-grid`} width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".8" fill="#acbdb0" opacity=".45"/></pattern>
          {(['care', 'test', 'medicine', 'blocked'] as const).map(tone => <marker key={tone} id={`${markerId}-${tone}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L6,3 L0,6 Z" fill={{care: '#397e65', test: '#568499', medicine: '#b68c41', blocked: '#b55337'}[tone]}/></marker>)}
        </defs><rect x="0" y="0" width={WORLD.width} height={WORLD.height} fill={`url(#${markerId}-grid)`}/>
          <rect x="518" y="251" width="715" height="262" rx="60" fill="#e6ede1" fillOpacity=".7" stroke="#c2d2bd" strokeDasharray="4 7"/>
          <text x="1120" y="264" textAnchor="middle" className="fb-campus-label">SAME CLINIC</text>
        </svg>
        <Route id={markerId} d="M130 313 V136 Q130 126 146 126 H272" label="Patient samples" detail={`${count(p.tests)} tests / month`} labelAt={[130, 225]} tone="test" blocked={p.testingCapacity === 0} onClick={() => select('lab')}/>
        <Route id={markerId} d="M457 131 C601 131 674 197 667 275" label="Eligibility reports" detail={`${count(p.testResults)} results this month`} labelAt={[620, 215]} tone="test" onClick={() => select('lab')}/>
        <Route id={markerId} d="M850 235 V302 Q850 316 832 316 H775 Q758 316 758 330 V340" label={!state.network.licensed && productId === 'partner-biologic' ? 'License required' : p.supplyCapacity === 0 ? 'Supply missing' : 'Shared medicine'} detail={`${count(p.starts)} care + ${count(p.trialStarts)} trial/mo`} labelAt={[850, 319]} tone="medicine" blocked={p.supplyCapacity === 0 || (!state.network.licensed && productId === 'partner-biologic')} onClick={() => select('factory')}/>
        <Route id={markerId} d="M222 359 H540" label="People to clinic" detail={`${count(p.starts)} care + ${count(p.trialStarts)} trial/mo`} labelAt={[390, 371]} blocked={p.limiter === 'clinic'} onClick={() => select('clinic')}/>
        <Route id={markerId} d="M761 359 H1034" label="Ongoing visits" detail={`${count(p.followupDelivered)} / month`} labelAt={[910, 412]} blocked={followupShortfall > 0} onClick={() => select('followup')}/>
        {(['people', 'lab', 'factory', 'clinic', 'followup'] as const).map(kind => node(kind))}
        <div className="fb-work-label">DELIVERY WORK SURFACE <span>Connections show dependencies.<br/>Not geographic distance.</span></div>
      </div>
      <div className="fb-camera" role="group" aria-label="Network camera"><button type="button" onClick={() => zoom(-.15)} disabled={camera.zoom <= .85} aria-label="Zoom network out">−</button><output aria-label="Network zoom">{Math.round(camera.zoom * 100)}%</output><button type="button" onClick={() => zoom(.15)} disabled={camera.zoom >= 1.8} aria-label="Zoom network in">+</button><button type="button" className="fb-reset" onClick={() => setCamera({zoom: 1, x: 0, y: 0})}>Fit route</button></div>
    </div>
    <div className="fb-mobile-route" aria-label="Shared monthly treatment dependencies">
      {node('people', true)}<div className="fb-mobile-link">↓ Samples to testing · {count(p.tests)} / month</div>
      {node('lab', true)}<div className="fb-mobile-link">Reports → clinic below · {count(p.testResults)} this month<br/><span className="fb-separate-input">Separate input: manufacture the medicine</span></div>
      {node('factory', true)}<div className={`fb-mobile-link ${p.supplyCapacity === 0 ? 'is-blocked' : ''}`}>↓ Medicine to clinic · {count(p.starts)} partner doses + {count(p.trialStarts)} trial batches / month<br/>+ eligible people + test results</div>
      {node('clinic', true)}<div className="fb-mobile-link">↓ Care continues at the same clinic</div>
      {node('followup', true)}
    </div>
    <button type="button" className="fb-bottleneck" onClick={() => select(p.limiter)}><span className="fb-bottleneck-label">Current limiting step <span aria-hidden="true">↗</span></span><strong>{p.reason}</strong><span>Inspect {TITLES[p.limiter].toLowerCase()}</span></button>
  </section>;
}
