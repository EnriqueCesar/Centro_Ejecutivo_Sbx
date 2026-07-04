'use strict';

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const CENTER_REGIONS = new Set(['Centro Centro','Centro Norte','Centro Poniente','Centro Sur']);
const STATE_ALIAS = {
  'Ciudad De México':'CDMX','Estado De México':'MEX','Nuevo León':'NL','Baja California':'BC','Baja California Sur':'BCS','Sonora':'SON','Sinaloa':'SIN','Chihuahua':'CHH','Coahuila':'COA','Tamaulipas':'TAM','Durango':'DGO','Zacatecas':'ZAC','San Luis Potosí':'SLP','Aguascalientes':'AGS','Jalisco':'JAL','Nayarit':'NAY','Colima':'COL','Michoacán':'MIC','Guanajuato':'GTO','Querétaro':'QRO','Hidalgo':'HGO','Puebla':'PUE','Tlaxcala':'TLX','Morelos':'MOR','Guerrero':'GRO','Oaxaca':'OAX','Veracruz':'VER','Chiapas':'CHP','Tabasco':'TAB','Campeche':'CAM','Yucatán':'YUC','Quintana Roo':'QROO'
};
const STATE_FULL = Object.fromEntries(Object.entries(STATE_ALIAS).map(([k,v]) => [v,k]));
const STATE_GRID = [
  ['BC', 40, 20, 52, 120], ['SON', 95, 48, 100, 92], ['CHH', 190, 40, 120, 105], ['COA', 325, 75, 105, 84], ['NL', 438, 105, 64, 56], ['TAM', 505, 130, 74, 92],
  ['BCS', 70, 175, 62, 118], ['SIN', 176, 166, 76, 78], ['DGO', 265, 164, 82, 70], ['ZAC', 352, 173, 75, 66], ['SLP', 434, 188, 76, 64],
  ['NAY', 228, 248, 58, 56], ['AGS', 350, 245, 45, 44], ['GTO', 394, 255, 68, 50], ['QRO', 470, 263, 55, 46], ['HGO', 530, 268, 60, 44],
  ['JAL', 285, 292, 102, 72], ['COL', 320, 372, 44, 32], ['MIC', 390, 325, 95, 64], ['MEX', 502, 323, 56, 44], ['CDMX', 565, 340, 34, 34], ['MOR', 545, 385, 46, 34],
  ['GRO', 430, 410, 116, 65], ['PUE', 592, 355, 74, 55], ['TLX', 668, 342, 35, 30], ['VER', 665, 386, 104, 66], ['OAX', 555, 455, 112, 74], ['CHP', 690, 500, 92, 62], ['TAB', 790, 455, 64, 50], ['CAM', 860, 430, 76, 62], ['YUC', 928, 390, 76, 54], ['QROO', 954, 464, 66, 90]
];
const CENTER_MAP = [
  ['Centro Norte', 50, 35, 245, 80], ['Centro Poniente', 45, 150, 245, 95], ['Centro Centro', 330, 110, 230, 95], ['Centro Sur', 310, 245, 270, 105], ['Bajío', 610, 88, 120, 92]
];
const KPI_CONFIG = {
  conexion:{label:'Conexión', short:'Conexión', kind:'percent', goal:'Conexión', higher:true, axis:'Porcentaje de conexión', action:'Refuerza ritual de conexión, saludo y cierre de experiencia.'},
  bebida:{label:'Bebida', short:'Bebida', kind:'percent', goal:'Bebida', higher:true, axis:'Calidad / ejecución de bebida', action:'Audita estándares de preparación y calibración por turno.'},
  tplh:{label:'TPLH', short:'TPLH', kind:'number', goal:'TPLH', higher:true, axis:'Transacciones por labor hour', action:'Optimiza cobertura, roles por franja y productividad de piso.'},
  segundas:{label:'Segundas Cx', short:'Segundas', kind:'number', goal:'Segundas Cx', higher:true, axis:'Segundas conexiones', action:'Activa impulso de segunda conexión y venta sugerida.'},
  adt:{label:'ADT Δ 26-25', short:'ADT', kind:'number', goal:'ADT', higher:true, axis:'Diferencia ADT 26 vs 25', action:'Prioriza recuperación de tráfico, horarios pico y activaciones locales.'}
};
const $ = s => document.querySelector(s);
let DB = null;
let STATE = { kpi:'conexion', months:['Jun'], regions:['Todas'], level:'region', selectedRegion:null, sort:{key:'real', dir:'desc'}, search:'' };
let STORE_META = new Map();
let REGION_BY_STATE = new Map();
let REGION_COLOR_CACHE = new Map();

const norm = v => String(v ?? '').trim();
const cleanKey = v => norm(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_');
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const avg = arr => { const v = arr.map(num).filter(x => x !== null); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : null; };
const pct = (n,d) => d ? n/d : 0;

function fmt(v, kind = currentKind()) {
  const n = num(v); if (n === null) return '--';
  if (kind === 'percent') return `${(n*100).toFixed(1)}%`;
  if (Math.abs(n) >= 100) return Math.round(n).toLocaleString('es-MX');
  return (Math.round(n*10)/10).toLocaleString('es-MX');
}
function diffFmt(v, kind = currentKind()) {
  const n = num(v); if (n === null) return '--';
  const s = n > 0 ? '+' : '';
  if (kind === 'percent') return `${s}${(n*100).toFixed(1)} pp`;
  return `${s}${(Math.round(n*10)/10).toLocaleString('es-MX')}`;
}
function currentKind(){ return KPI_CONFIG[STATE.kpi]?.kind || 'number'; }
function latestYear(kpi=STATE.kpi){
  const rec = DB?.kpis?.[kpi]?.records || {}; const yrs = new Set();
  Object.values(rec).forEach(o => Object.keys(o||{}).forEach(y => yrs.add(Number(y))));
  return Math.max(...[...yrs].filter(Number.isFinite), 2026);
}
function priorYear(kpi=STATE.kpi){ return latestYear(kpi)-1; }
function availableMonths(kpi=STATE.kpi){ return (DB?.kpis?.[kpi]?.months || DB?.months || MONTHS).filter(m => MONTHS.includes(m)); }
function selectedMonths(){ return STATE.months.includes('Todos') ? availableMonths() : STATE.months; }
function selectedRegions(){ return STATE.regions.includes('Todas') ? (DB.regions || []) : STATE.regions; }
function storeInfo(ceco){ return STORE_META.get(norm(ceco)) || {}; }
function objective(kpi, month){
  const key = KPI_CONFIG[kpi]?.goal || kpi;
  const row = DB.objectives?.[month] || {};
  return num(row[key] ?? row[KPI_CONFIG[kpi]?.label] ?? row[KPI_CONFIG[kpi]?.short] ?? row[kpi]);
}
function valueFor(kpi, ceco, year, month){ return num(DB.kpis?.[kpi]?.records?.[ceco]?.[String(year)]?.[month]); }
function metricFor(row, kpi=STATE.kpi){
  if (kpi === 'adt') {
    if (row.real === null || row.aa === null) return null;
    return row.real - row.aa;
  }
  return row.real;
}
function statusFromGap(gap, kind=currentKind()){
  const g = num(gap); if (g === null) return 'amber';
  const t1 = kind === 'percent' ? -0.005 : -0.15;
  const t2 = kind === 'percent' ? -0.025 : -0.6;
  if (g >= 0) return 'green';
  if (g >= t1) return 'lime';
  if (g >= t2) return 'amber';
  return 'red';
}
function heatColor(gap, kind=currentKind()){
  const s = statusFromGap(gap, kind);
  return {green:'#00754a', lime:'#8fbf3f', amber:'#f5a623', red:'#d64545'}[s] || '#e87522';
}
function scoreFor(real, meta, aa, kpi=STATE.kpi){
  const r = num(real); if (r === null) return 0;
  const kind = KPI_CONFIG[kpi]?.kind || 'number';
  let s = 62;
  if (num(meta) !== null) { const d = r-meta; s += d>=0 ? 28 : Math.max(-35, d*(kind==='percent'?900:26)); }
  if (num(aa) !== null) { const d = r-aa; s += d>=0 ? 10 : Math.max(-12, d*(kind==='percent'?250:8)); }
  return Math.max(0, Math.min(100, Math.round(s)));
}
function aggregateStoreRows(kpi=STATE.kpi, months=selectedMonths(), regions=selectedRegions()){
  const year = latestYear(kpi), aaYear = priorYear(kpi);
  const out = [];
  Object.keys(DB.kpis?.[kpi]?.records || {}).forEach(ceco => {
    const info = storeInfo(ceco);
    const region = info.region || 'Sin Región';
    if (regions.length && !regions.includes(region)) return;
    const real = avg(months.map(m => valueFor(kpi, ceco, year, m)));
    const aa = avg(months.map(m => valueFor(kpi, ceco, aaYear, m)));
    if (real === null) return;
    const meta = avg(months.map(m => objective(kpi, m)));
    const difMeta = meta === null ? null : real-meta;
    const difAA = aa === null ? null : real-aa;
    const metric = kpi === 'adt' ? (aa === null ? null : real-aa) : real;
    out.push({ceco, tienda:info.tienda || ceco, region, estado:info.estado || '', ciudad:info.ciudad || '', real, aa, meta, difMeta, difAA, metric, score:scoreFor(real, meta, aa, kpi), status:statusFromGap(difMeta)});
  });
  return out;
}
function aggregateRegions(kpi=STATE.kpi, months=selectedMonths()){
  return (DB.regions || []).map(region => {
    const rows = aggregateStoreRows(kpi, months, [region]);
    const real = avg(rows.map(r=>r.real)), aa = avg(rows.map(r=>r.aa)), meta = avg(months.map(m=>objective(kpi,m)));
    const difMeta = meta === null || real === null ? null : real-meta;
    const difAA = aa === null || real === null ? null : real-aa;
    const complies = rows.filter(r => (num(r.difMeta) ?? -1) >= 0).length;
    const risk = rows.filter(r => r.status === 'red').length;
    return {region, real, aa, meta, difMeta, difAA, stores:rows.length, complies, risk, attention:Math.max(0, rows.length-complies-risk), score:scoreFor(real, meta, aa, kpi), status:statusFromGap(difMeta)};
  }).filter(r => r.real !== null);
}
function nationalAgg(){
  const regs = aggregateRegions();
  const real=avg(regs.map(r=>r.real)), aa=avg(regs.map(r=>r.aa)), meta=avg(selectedMonths().map(m=>objective(STATE.kpi,m)));
  return {real, aa, meta, difMeta: meta===null||real===null?null:real-meta, difAA: aa===null||real===null?null:real-aa, score:scoreFor(real, meta, aa)};
}

async function boot(){
  DB = await fetch('data/kpi-data.json', {cache:'no-store'}).then(r=>r.json());
  await enrichDirectory();
  ensureState();
  bindGlobal();
  render();
}
async function enrichDirectory(){
  try {
    const txt = await fetch('data/directorio_geo.tsv', {cache:'no-store'}).then(r => r.ok ? r.text() : '');
    if (txt) parseDirectoryText(txt);
  } catch(e) {}
  (DB.stores || []).forEach(s => {
    const key = norm(s.ceco);
    const prior = STORE_META.get(key) || {};
    STORE_META.set(key, {...prior, ceco:key, tienda:prior.tienda || s.tienda, region:prior.region || s.region});
  });
  buildStateRegionMap();
}
function parseDirectoryText(txt){
  const lines = txt.split(/\r?\n/).filter(x => x.trim());
  if (!lines.length) return;
  const header = lines[0].split('\t').map(cleanKey);
  const idx = name => header.findIndex(h => h === name || h.includes(name));
  const iCC = idx('cc'), iName = idx('cc_nombre'), iReg = idx('region'), iCity = idx('ciudad'), iState = idx('estado');
  lines.slice(1).forEach(line => {
    const c = line.split('\t'); const ceco = norm(c[iCC]); if (!ceco) return;
    STORE_META.set(ceco, {ceco, tienda:norm(c[iName]), region:norm(c[iReg]), ciudad:norm(c[iCity]), estado:norm(c[iState])});
  });
}
function buildStateRegionMap(){
  const buckets = {};
  STORE_META.forEach(s => { if (!s.estado || !s.region) return; const ab = STATE_ALIAS[s.estado] || STATE_ALIAS[toTitle(s.estado)] || null; if (!ab) return; buckets[ab] ||= {}; buckets[ab][s.region] = (buckets[ab][s.region]||0)+1; });
  Object.entries(buckets).forEach(([ab, counts]) => { const reg = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0]; if (reg) REGION_BY_STATE.set(ab, reg); });
  STATE_GRID.forEach(([ab]) => { if (!REGION_BY_STATE.has(ab)) REGION_BY_STATE.set(ab, guessRegion(ab)); });
}
function toTitle(s){ return norm(s).toLowerCase().replace(/\b\w/g, c => c.toUpperCase()); }
function guessRegion(ab){
  if(['BC','BCS','SON','SIN'].includes(ab)) return 'Noroeste';
  if(['NL','TAM'].includes(ab)) return 'Norte';
  if(['CHH','COA','DGO','ZAC','SLP','AGS'].includes(ab)) return 'Norte Centro';
  if(['JAL','NAY','COL','MIC'].includes(ab)) return 'Occidente';
  if(['GTO','QRO','HGO'].includes(ab)) return 'Bajío';
  if(['CDMX'].includes(ab)) return 'Centro Centro';
  if(['MEX'].includes(ab)) return 'Centro Norte';
  if(['PUE','TLX','MOR','GRO','OAX','VER'].includes(ab)) return 'Sur';
  if(['CHP','TAB','CAM','YUC','QROO'].includes(ab)) return 'Sureste';
  return 'Sin Región';
}
function ensureState(){
  const kpis = Object.keys(DB.kpis || {}); if (!kpis.includes(STATE.kpi)) STATE.kpi = kpis[0];
  const months = availableMonths(); if (!STATE.months.some(m => m === 'Todos' || months.includes(m))) STATE.months = [months.at(-1) || 'Jun'];
  const regs = DB.regions || []; if (!STATE.regions.some(r => r === 'Todas' || regs.includes(r))) STATE.regions = ['Todas'];
}
function bindGlobal(){
  $('#resetBtn').onclick = () => { STATE.regions=['Todas']; STATE.level='region'; STATE.selectedRegion=null; render(); };
  $('#backLevelBtn').onclick = () => { STATE.level='region'; STATE.selectedRegion=null; render(); };
  $('#centerZoomBtn').onclick = () => { STATE.regions = ['Centro Centro','Centro Norte','Centro Poniente','Centro Sur']; STATE.level='region'; render(); };
  $('#tableSearch').oninput = e => { STATE.search = e.target.value.trim().toLowerCase(); renderTable(); };
  $('#exportBtn').onclick = () => window.print();
}
function render(){ ensureState(); renderControls(); renderBreadcrumb(); renderSummary(); renderCards(); renderMap(); renderTable(); renderTrend(); renderRanks(); renderInsights(); renderRecommendations(); }
function renderControls(){
  $('#kpiTabs').innerHTML = Object.keys(DB.kpis || {}).map(k => `<button class="chip ${STATE.kpi===k?'active':''}" data-kpi="${k}">${KPI_CONFIG[k]?.short || DB.kpis[k].label || k}</button>`).join('');
  $('#kpiTabs').onclick = e => { const b=e.target.closest('[data-kpi]'); if(!b) return; STATE.kpi=b.dataset.kpi; STATE.months=[availableMonths(STATE.kpi).at(-1)||'Jun']; STATE.level='region'; render(); };
  const months = availableMonths();
  $('#monthChips').innerHTML = `<button class="chip all ${STATE.months.includes('Todos')?'active':''}" data-month="Todos">Todos</button>` + months.map(m => `<button class="chip ${STATE.months.includes(m)?'active':''}" data-month="${m}">${m}</button>`).join('');
  $('#monthChips').onclick = e => { const b=e.target.closest('[data-month]'); if(!b) return; toggleMulti(STATE.months, b.dataset.month, 'Todos'); render(); };
  const regs = DB.regions || [];
  $('#regionChips').innerHTML = `<button class="chip all ${STATE.regions.includes('Todas')?'active':''}" data-region="Todas">Todas</button>` + regs.map(r => `<button class="chip ${STATE.regions.includes(r)?'active':''}" data-region="${r}">${r}</button>`).join('');
  $('#regionChips').onclick = e => { const b=e.target.closest('[data-region]'); if(!b) return; toggleMulti(STATE.regions, b.dataset.region, 'Todas'); STATE.level='region'; STATE.selectedRegion=null; render(); };
  $('#periodBadge').textContent = `${STATE.months.includes('Todos')?'TODOS':STATE.months.join(', ')} ${latestYear()}`;
}
function toggleMulti(arr, val, all){
  if (val === all) { arr.splice(0, arr.length, all); return; }
  const ai = arr.indexOf(all); if (ai >= 0) arr.splice(ai,1);
  const i = arr.indexOf(val); i >= 0 ? arr.splice(i,1) : arr.push(val);
  if (!arr.length) arr.push(all);
}
function renderBreadcrumb(){
  const parts = ['Nacional'];
  if (!STATE.regions.includes('Todas')) parts.push(STATE.regions.join(' + '));
  if (STATE.level === 'store' && STATE.selectedRegion) parts.push('Tiendas');
  $('#breadcrumb').innerHTML = parts.map((p,i) => i===0 ? `<button data-home="1">${p}</button>` : `<span>›</span> <b>${p}</b>`).join(' ');
  $('#breadcrumb [data-home]')?.addEventListener('click', () => { STATE.regions=['Todas']; STATE.level='region'; STATE.selectedRegion=null; render(); });
}
function renderSummary(){
  const n = nationalAgg(); const k = currentKind(); const regs = aggregateRegions();
  const best = [...regs].sort((a,b)=>b.real-a.real)[0];
  const worst = [...regs].sort((a,b)=>(a.difMeta??999)-(b.difMeta??999))[0];
  const scope = STATE.regions.includes('Todas') ? 'Nacional' : STATE.regions.join(' + ');
  $('#scopeLabel').textContent = `${scope} · ${STATE.months.includes('Todos')?'Todos los meses':STATE.months.join(', ')}`;
  $('#summaryHeadline').textContent = `${KPI_CONFIG[STATE.kpi]?.label || STATE.kpi}: ${fmt(n.real,k)} · ${n.score}/100`;
  $('#summaryText').textContent = best && worst ? `${best.region} lidera con ${fmt(best.real,k)}. La mayor oportunidad está en ${worst.region} (${diffFmt(worst.difMeta,k)} vs meta).` : 'No hay datos suficientes para el filtro actual.';
  $('#summaryIcon').textContent = n.score>=80?'✓':n.score>=65?'!':'↓';
}
function renderCards(){
  const n = nationalAgg(), k = currentKind();
  const regs = aggregateRegions(); const stores = aggregateStoreRows();
  const cards = [
    ['Real', fmt(n.real,k), KPI_CONFIG[STATE.kpi].axis, ''], ['Meta', fmt(n.meta,k), 'Objetivo mensual', ''], ['vs Meta', diffFmt(n.difMeta,k), 'Brecha ejecutiva', n.difMeta>=0?'positive':n.difMeta<0?'negative':'warning'],
    ['AA', fmt(n.aa,k), `${priorYear()} comparable`, ''], ['vs AA', diffFmt(n.difAA,k), 'Evolución', n.difAA>=0?'positive':n.difAA<0?'negative':'warning'], ['Score', String(n.score), n.score>=80?'Excelente':n.score>=65?'Atención':'Riesgo', n.score>=80?'positive':n.score>=65?'warning':'negative']
  ];
  $('#kpiCards').innerHTML = cards.map(c=>`<article class="metric-card ${c[3]}"><header>${c[0]}</header><strong>${c[1]}</strong><em>${c[2]}</em></article>`).join('');
}
function renderMap(){
  const regs = aggregateRegions(); REGION_COLOR_CACHE = new Map(regs.map(r => [r.region, heatColor(r.difMeta)]));
  const selected = selectedRegions(); const useZoom = selected.some(r => CENTER_REGIONS.has(r));
  $('#mapSubtitle').textContent = useZoom ? 'Zoom Centro · CDMX / EdoMex' : 'Estados agrupados por región operativa';
  $('#mexicoMap').innerHTML = useZoom ? centerSvg(regs) : mexicoSvg(regs);
  const n = nationalAgg();
  $('#mapScore').textContent = n.score; $('#mapStatus').textContent = n.score>=80?'Excelente':n.score>=65?'Atención':'Riesgo';
  const green = regs.filter(r=>r.status==='green').length, amber = regs.filter(r=>['lime','amber'].includes(r.status)).length, red = regs.filter(r=>r.status==='red').length;
  $('#mapStats').innerHTML = [ ['Regiones', regs.length], ['Cumplen', green], ['Atención', amber], ['Riesgo', red] ].map(x=>`<div class="stat-card"><span>${x[0]}</span><strong>${x[1]}</strong></div>`).join('');
  bindMapEvents();
}
function regionByName(name){ return aggregateRegions().find(r => r.region === name); }
function mexicoSvg(){
  const sel = selectedRegions();
  const rects = STATE_GRID.map(([ab,x,y,w,h]) => {
    const reg = REGION_BY_STATE.get(ab) || 'Sin Región'; const r = regionByName(reg); const active = !sel.length || sel.includes(reg);
    const col = r ? heatColor(r.difMeta) : '#cdd8d3'; const op = active ? 1 : .28;
    return `<g data-region="${reg}" data-state="${ab}"><rect class="state ${active?'active':''}" x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${col}" opacity="${op}"></rect><text class="state-label" x="${x+w/2}" y="${y+h/2+4}" text-anchor="middle">${ab}</text></g>`;
  }).join('');
  return `<svg class="mx-svg" viewBox="0 0 1050 610" role="img" aria-label="Mapa ejecutivo de México"><rect x="14" y="14" width="1022" height="582" rx="24" fill="transparent" stroke="#dbe6e1"/>${rects}<text class="region-label" x="65" y="28">Noroeste</text><text class="region-label" x="390" y="88">Norte</text><text class="region-label" x="310" y="158">Norte Centro</text><text class="region-label" x="290" y="286">Occidente</text><text class="region-label" x="420" y="250">Bajío</text><text class="region-label" x="525" y="320">Centro</text><text class="region-label" x="520" y="445">Sur</text><text class="region-label" x="815" y="430">Sureste</text></svg>`;
}
function centerSvg(){
  const sel = selectedRegions();
  const items = CENTER_MAP.map(([reg,x,y,w,h]) => { const r=regionByName(reg); const col=r?heatColor(r.difMeta):'#cdd8d3'; const active=sel.includes('Todas')||sel.includes(reg); return `<g data-region="${reg}"><rect class="state ${active?'active':''}" x="${x}" y="${y}" width="${w}" height="${h}" rx="26" fill="${col}" opacity="${active?1:.28}"></rect><text class="region-label" x="${x+w/2}" y="${y+h/2+5}" text-anchor="middle">${reg}</text></g>`; }).join('');
  return `<svg class="mx-svg" viewBox="0 0 760 430" role="img" aria-label="Zoom Centro CDMX EdoMex"><rect class="zoom-card" x="18" y="18" width="724" height="394" rx="28"/><text x="380" y="28" text-anchor="middle" class="state-label">ZOOM CENTRO · CDMX / ESTADO DE MÉXICO</text>${items}</svg>`;
}
function bindMapEvents(){
  const tt = $('#tooltip');
  document.querySelectorAll('#mexicoMap [data-region]').forEach(el => {
    el.addEventListener('mousemove', e => { const reg = el.dataset.region; const st=el.dataset.state; const r=regionByName(reg); tt.classList.remove('hidden'); tt.style.left=(e.clientX+16)+'px'; tt.style.top=(e.clientY+16)+'px'; tt.innerHTML = `<h4>${st?`${st} · `:''}${reg}</h4><p><b>${KPI_CONFIG[STATE.kpi].short}</b>: ${fmt(r?.real)}</p><p>Meta: ${fmt(r?.meta)} · Brecha: <b>${diffFmt(r?.difMeta)}</b></p><p>Score: <b>${r?.score ?? '--'}</b> · Tiendas: ${r?.stores ?? '--'}</p>`; });
    el.addEventListener('mouseleave', () => tt.classList.add('hidden'));
    el.addEventListener('click', () => { const reg=el.dataset.region; STATE.regions=[reg]; STATE.level='store'; STATE.selectedRegion=reg; render(); });
  });
}
function renderTable(){
  const k = currentKind(); let rows;
  if (STATE.level === 'store' || !STATE.regions.includes('Todas')) {
    rows = aggregateStoreRows(); $('#tableTitle').textContent = `Tabla ejecutiva por tienda`; $('#backLevelBtn').classList.toggle('hidden', STATE.regions.includes('Todas') && STATE.level!=='store');
  } else { rows = aggregateRegions(); $('#tableTitle').textContent = `Tabla ejecutiva por región`; $('#backLevelBtn').classList.add('hidden'); }
  if (STATE.search) rows = rows.filter(r => JSON.stringify(r).toLowerCase().includes(STATE.search));
  const {key, dir} = STATE.sort; rows.sort((a,b)=>{ const av=a[key], bv=b[key]; const res = (num(av) ?? String(av)).toString().localeCompare((num(bv) ?? String(bv)).toString(), 'es-MX', {numeric:true}); return dir==='asc'?res:-res; });
  $('#tableSubtitle').textContent = `${rows.length} registros · ${KPI_CONFIG[STATE.kpi].label} · ${KPI_CONFIG[STATE.kpi].axis}`;
  const isStore = rows[0]?.ceco !== undefined;
  const headers = isStore ? [['tienda','Tienda'],['ceco','CC'],['region','Región'],['estado','Estado'],['real','Real'],['meta','Meta'],['aa','AA'],['difMeta','Dif Meta'],['difAA','Dif AA'],['score','Score'],['status','Estado']] : [['region','Región'],['real','Real'],['meta','Meta'],['aa','AA'],['difMeta','Dif Meta'],['difAA','Dif AA'],['stores','Tiendas'],['complies','Cumplen'],['risk','Riesgo'],['score','Score'],['status','Estado']];
  $('#executiveTable').innerHTML = `<thead><tr><th>#</th>${headers.map(h=>`<th data-sort="${h[0]}">${h[1]}${STATE.sort.key===h[0]?(STATE.sort.dir==='asc'?' ▲':' ▼'):''}</th>`).join('')}</tr></thead><tbody>${rows.map((r,i)=>`<tr data-region="${r.region||''}" data-ceco="${r.ceco||''}"><td>${i+1}</td>${headers.map(([key])=>`<td class="${key==='region'||key==='tienda'?'main-name':''}">${cellValue(r,key,k)}</td>`).join('')}</tr>`).join('')}</tbody>`;
  document.querySelectorAll('#executiveTable th[data-sort]').forEach(th => th.onclick = () => { const k=th.dataset.sort; STATE.sort = {key:k, dir: STATE.sort.key===k && STATE.sort.dir==='desc' ? 'asc':'desc'}; renderTable(); });
  document.querySelectorAll('#executiveTable tr[data-region]').forEach(tr => tr.onclick = () => { if(tr.dataset.region){ STATE.regions=[tr.dataset.region]; STATE.level='store'; STATE.selectedRegion=tr.dataset.region; render(); } });
}
function cellValue(r,key,k){
  if(['real','meta','aa'].includes(key)) return fmt(r[key], k);
  if(['difMeta','difAA'].includes(key)) return `<span class="${num(r[key])<0?'txt-red':'txt-green'}">${diffFmt(r[key], k)}</span>`;
  if(key==='status') return `<span class="pill ${r.status}">${r.status==='green'?'Cumple':r.status==='red'?'Riesgo':'Atención'}</span>`;
  if(key==='score') return `<b class="${r.score>=80?'txt-green':r.score>=65?'txt-amber':'txt-red'}">${r.score}</b>`;
  return r[key] ?? '--';
}
function renderTrend(){
  const k=currentKind(); const months=availableMonths();
  const vals = months.map(m => { const regs=aggregateRegions(STATE.kpi,[m]).filter(r => selectedRegions().includes(r.region) || STATE.regions.includes('Todas')); return {m, real:avg(regs.map(r=>r.real)), meta:objective(STATE.kpi,m)}; });
  const all = vals.flatMap(v => [v.real, v.meta]).map(num).filter(v=>v!==null); const min=Math.min(...all), max=Math.max(...all); const span=Math.max(.0001, max-min);
  $('#trendTitle').textContent = `Tendencia dinámica · ${KPI_CONFIG[STATE.kpi].label}`;
  $('#axisHint').textContent = KPI_CONFIG[STATE.kpi].axis;
  $('#trendChart').innerHTML = `<span class="axis-note">Rango ${fmt(min,k)} → ${fmt(max,k)}</span>` + vals.map(v => { const h1 = 8 + ((v.real-min)/span)*92; const h2 = 8 + ((v.meta-min)/span)*92; return `<div class="bar-col"><div class="bar-wrap"><i class="bar" title="Real ${fmt(v.real,k)}" style="height:${h1}%"></i><i class="bar meta" title="Meta ${fmt(v.meta,k)}" style="height:${h2}%"></i></div><span class="bar-label">${v.m}</span></div>`; }).join('');
}
function renderRanks(){
  const rows = aggregateStoreRows().filter(r => num(r.metric)!==null); const max=Math.max(.001,...rows.map(r=>Math.abs(r.metric||0)));
  const top=[...rows].sort((a,b)=>b.metric-a.metric).slice(0,10); const bottom=[...rows].sort((a,b)=>a.metric-b.metric).slice(0,10);
  $('#topList').innerHTML = top.map((r,i)=>rankHtml(r,i,'top',max)).join('') || '<p class="map-note">Sin datos</p>';
  $('#bottomList').innerHTML = bottom.map((r,i)=>rankHtml(r,i,'bottom',max)).join('') || '<p class="map-note">Sin datos</p>';
}
function rankHtml(r,i,type,max){ const k=currentKind(); const value = STATE.kpi==='adt' ? diffFmt(r.metric,'number') : fmt(r.real,k); return `<button class="rank-card" data-ceco="${r.ceco}"><span class="rank-medal">${type==='top'?(i<3?['🥇','🥈','🥉'][i]:i+1):'⚠'}</span><span class="rank-info"><strong>${r.tienda}</strong><em>${r.ceco} · ${r.region}</em></span><span class="rank-value ${num(r.difMeta)<0?'txt-red':'txt-green'}">${value}</span></button>`; }
function renderInsights(){
  const regs=aggregateRegions(); const stores=aggregateStoreRows(); const k=currentKind();
  const best=[...regs].sort((a,b)=>b.real-a.real)[0]; const risk=[...regs].sort((a,b)=>(a.difMeta??999)-(b.difMeta??999))[0]; const growth=[...regs].sort((a,b)=>(b.difAA??-999)-(a.difAA??-999))[0]; const drop=[...regs].sort((a,b)=>(a.difAA??999)-(b.difAA??999))[0]; const top=[...stores].sort((a,b)=>b.metric-a.metric)[0]; const bottom=[...stores].sort((a,b)=>a.metric-b.metric)[0];
  const data=[
    ['green','Mejor desempeño', best?`${best.region} lidera ${KPI_CONFIG[STATE.kpi].short} con ${fmt(best.real,k)} (${diffFmt(best.difMeta,k)} vs meta).`:'Sin datos.'],
    ['red','Mayor oportunidad', risk?`${risk.region} requiere foco ejecutivo: ${diffFmt(risk.difMeta,k)} contra meta y score ${risk.score}.`:'Sin datos.'],
    ['green','Mayor avance vs AA', growth?`${growth.region} muestra el mejor avance vs ${priorYear()}: ${diffFmt(growth.difAA,k)}.`:'Sin datos.'],
    ['amber','Retroceso a vigilar', drop?`${drop.region} presenta la caída relativa más relevante vs AA: ${diffFmt(drop.difAA,k)}.`:'Sin datos.'],
    ['green','Tienda referente', top?`${top.tienda} (${top.region}) aparece como referencia del filtro actual.`:'Sin datos.'],
    ['red','Tienda crítica', bottom?`${bottom.tienda} (${bottom.region}) debe revisarse primero en el ranking Bottom.`:'Sin datos.']
  ];
  $('#insights').innerHTML = data.map(x=>`<article class="insight ${x[0]}"><strong>${x[1]}</strong><p>${x[2]}</p></article>`).join('');
}
function renderRecommendations(){
  const regs=[...aggregateRegions()].sort((a,b)=>(a.difMeta??999)-(b.difMeta??999));
  const worst=regs[0], best=[...regs].sort((a,b)=>b.real-a.real)[0], n=nationalAgg();
  const recs=[
    ['high','Prioridad 1', worst?`Intervenir ${worst.region}: brecha ${diffFmt(worst.difMeta)} vs meta. ${KPI_CONFIG[STATE.kpi].action}`:'Validar datos del KPI.'],
    ['medium','Seguimiento semanal', worst?`Revisar tiendas en riesgo de ${worst.region} y cerrar acciones antes del siguiente corte.`:'Sin región crítica.'],
    ['low','Replicar práctica', best?`Documentar rutina de ${best.region} y replicarla en regiones con brecha negativa.`:'Sin región líder.'],
    [n.score<65?'high':'medium','Impacto esperado',`Mover primero la brecha vs Meta; después AA y tendencia. Score actual: ${n.score}/100.`]
  ];
  $('#recommendations').innerHTML = recs.map(r=>`<article class="recommendation"><span class="priority ${r[0]}">${r[1]}</span><h4>${KPI_CONFIG[STATE.kpi].label}</h4><p>${r[2]}</p></article>`).join('');
}
boot().catch(err => { console.error(err); document.body.innerHTML = `<pre style="padding:30px;color:#b00000">Error cargando Centro Ejecutivo v4.9: ${err.message}</pre>`; });
