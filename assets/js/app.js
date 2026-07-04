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
let DEFERRED_INSTALL_PROMPT = null;
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

    let real, aa, comparableMonths = months;
    if (kpi === 'adt') {
      // V5.1: ADT sólo considera tiendas comparables.
      // Una tienda entra al cálculo sólo si tiene dato 2026 y 2025 en el mismo mes seleccionado.
      comparableMonths = months.filter(m => valueFor(kpi, ceco, year, m) !== null && valueFor(kpi, ceco, aaYear, m) !== null);
      if (!comparableMonths.length) return;
      real = avg(comparableMonths.map(m => valueFor(kpi, ceco, year, m)));
      aa = avg(comparableMonths.map(m => valueFor(kpi, ceco, aaYear, m)));
    } else {
      real = avg(months.map(m => valueFor(kpi, ceco, year, m)));
      aa = avg(months.map(m => valueFor(kpi, ceco, aaYear, m)));
    }
    if (real === null) return;
    const meta = avg(comparableMonths.map(m => objective(kpi, m)));
    const difMeta = meta === null ? null : real-meta;
    const difAA = aa === null ? null : real-aa;
    const metric = kpi === 'adt' ? real-aa : real;
    out.push({ceco, tienda:info.tienda || ceco, region, estado:info.estado || '', ciudad:info.ciudad || '', real, aa, meta, difMeta, difAA, metric, comparableMonths: comparableMonths.length, score:scoreFor(real, meta, aa, kpi), status:statusFromGap(difMeta)});
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
  const resetBtn = $('#resetBtn');
  const backLevelBtn = $('#backLevelBtn');
  const centerZoomBtn = $('#centerZoomBtn');
  const tableSearch = $('#tableSearch');
  const exportBtn = $('#exportBtn');
  const installBtn = $('#installBtn');
  if (resetBtn) resetBtn.onclick = () => { STATE.regions=['Todas']; STATE.level='region'; STATE.selectedRegion=null; render(); };
  if (backLevelBtn) backLevelBtn.onclick = () => { STATE.level='region'; STATE.selectedRegion=null; render(); };
  if (centerZoomBtn) centerZoomBtn.onclick = () => { STATE.regions = ['Centro Centro','Centro Norte','Centro Poniente','Centro Sur']; STATE.level='region'; render(); };
  if (tableSearch) tableSearch.oninput = e => { STATE.search = e.target.value.trim().toLowerCase(); renderTable(); };
  if (exportBtn) exportBtn.onclick = () => window.print();
  if (installBtn) installBtn.onclick = async () => {
    if (!DEFERRED_INSTALL_PROMPT) return;
    DEFERRED_INSTALL_PROMPT.prompt();
    await DEFERRED_INSTALL_PROMPT.userChoice.catch(() => null);
    DEFERRED_INSTALL_PROMPT = null;
    installBtn.classList.add('hidden');
  };
}
function render(){ ensureState(); renderControls(); renderBreadcrumb(); renderSummary(); renderCards(); renderTable(); renderTrend(); renderRanks(); renderInsights(); renderRecommendations(); }
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
  const active = reg => sel.includes('Todas') || sel.includes(reg);
  const fill = reg => { const r = regionByName(reg); return r ? heatColor(r.difMeta) : '#cdd8d3'; };
  const op = reg => active(reg) ? 1 : .20;
  const paths = [
    ['Noroeste','M92 74 C122 42 177 36 219 70 L278 124 L305 197 L284 271 L222 293 L160 240 L118 168 Z','Noroeste',188,154],
    ['Norte','M288 65 C362 42 441 58 501 105 L552 162 L535 232 L456 245 L373 214 L315 160 Z','Norte',423,145],
    ['Norte Centro','M314 218 L458 246 L544 238 L598 306 L561 369 L441 360 L335 313 Z','Norte Centro',461,301],
    ['Occidente','M214 294 L327 318 L438 365 L418 438 L318 475 L229 423 L172 344 Z','Occidente',315,391],
    ['Bajío','M444 363 L560 370 L626 422 L596 487 L496 491 L420 440 Z','Bajío',526,428],
    ['Centro Poniente','M590 365 L654 387 L650 442 L596 485 L565 427 Z','Centro Poniente',616,412],
    ['Centro Norte','M641 340 L706 354 L710 413 L654 442 L650 386 Z','Centro Norte',680,386],
    ['Centro Centro','M659 444 L714 425 L761 455 L737 508 L681 502 Z','Centro Centro',710,465],
    ['Centro Sur','M583 493 L676 504 L731 545 L695 602 L584 573 L526 520 Z','Centro Sur',625,543],
    ['Sur','M692 510 L770 462 L881 478 L965 545 L916 620 L790 630 L699 596 Z','Sur',814,548],
    ['Sureste','M876 444 L1000 396 L1145 416 L1268 498 L1216 582 L1061 560 L954 523 Z','Sureste',1082,478]
  ];
  const shapes = paths.map(([reg,d,label,x,y]) => `<g class="mx-region" data-region="${reg}"><path class="map-region ${active(reg)?'active':''}" d="${d}" fill="${fill(reg)}" opacity="${op(reg)}"></path><text class="map-region-label" x="${x}" y="${y}" text-anchor="middle">${label}</text></g>`).join('');
  return `<svg class="mx-svg premium-map" viewBox="0 0 1340 710" role="img" aria-label="Mapa ejecutivo premium de México por región"><defs><filter id="mapShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="12" flood-color="#002f22" flood-opacity=".18"/></filter><linearGradient id="waterGlow" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#f7fcfa"/><stop offset="1" stop-color="#e8f4ef"/></linearGradient></defs><rect x="20" y="20" width="1300" height="670" rx="30" fill="url(#waterGlow)" stroke="#dbe6e1"/><path class="country-backdrop" d="M78 83 C162 10 259 30 325 78 C414 19 541 66 602 150 C711 173 773 243 806 338 C972 331 1133 358 1279 481 C1240 610 1097 662 911 644 C787 677 602 641 509 567 C379 526 241 515 166 410 C76 325 45 183 78 83Z"/><g filter="url(#mapShadow)">${shapes}</g><g class="map-pin" transform="translate(650 452)"><circle r="16"/><circle r="6"/></g></svg>`;
}
function centerSvg(){
  const sel = selectedRegions();
  const active = reg => sel.includes('Todas') || sel.includes(reg);
  const fill = reg => { const r = regionByName(reg); return r ? heatColor(r.difMeta) : '#cdd8d3'; };
  const op = reg => active(reg) ? 1 : .22;
  const items = [
    ['Centro Norte','M114 68 C180 30 303 34 368 91 L346 186 L204 194 L105 143 Z',238,128],
    ['Centro Poniente','M93 165 L202 207 L337 198 L357 300 L225 353 L82 290 Z',215,270],
    ['Centro Centro','M372 103 L522 78 L630 151 L605 261 L437 276 L348 196 Z',488,178],
    ['Centro Sur','M355 309 L500 283 L632 286 L689 391 L581 491 L411 465 L302 389 Z',497,383]
  ].map(([reg,d,x,y]) => `<g class="mx-region" data-region="${reg}"><path class="map-region ${active(reg)?'active':''}" d="${d}" fill="${fill(reg)}" opacity="${op(reg)}"></path><text class="map-region-label center" x="${x}" y="${y}" text-anchor="middle">${reg}</text></g>`).join('');
  return `<svg class="mx-svg premium-map center-premium" viewBox="0 0 780 560" role="img" aria-label="Zoom premium Centro CDMX EdoMex"><defs><filter id="centerShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="12" flood-color="#002f22" flood-opacity=".18"/></filter></defs><rect x="18" y="18" width="744" height="524" rx="32" fill="#f7fcfa" stroke="#dbe6e1"/><text x="390" y="54" text-anchor="middle" class="map-title">ZOOM CENTRO · CDMX / ESTADO DE MÉXICO</text><path class="country-backdrop center" d="M82 122 C145 58 256 38 355 75 C461 37 604 80 675 166 C742 253 730 376 643 459 C545 540 391 526 283 488 C168 448 66 352 62 241 C60 195 63 154 82 122Z"/><g filter="url(#centerShadow)">${items}</g></svg>`;
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
  const isStore = rows[0]?.ceco !== undefined;
  $('#tableSubtitle').textContent = `${rows.length} registros · ${KPI_CONFIG[STATE.kpi].label} · ${KPI_CONFIG[STATE.kpi].axis}${isStore ? ' · vista limpia sin Región/Ciudad' : ''}`;
  const headers = isStore ? [['tienda','Tienda'],['ceco','CC'],['real','Real'],['meta','Meta'],['aa','AA'],['difMeta','Dif Meta'],['difAA','Dif AA'],['score','Score'],['status','Estado']] : [['region','Región'],['real','Real'],['meta','Meta'],['aa','AA'],['difMeta','Dif Meta'],['difAA','Dif AA'],['stores','Tiendas'],['complies','Cumplen'],['risk','Riesgo'],['score','Score'],['status','Estado']];
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
  const regsFilter = selectedRegions();
  const vals = months.map(m => {
    const regs=aggregateRegions(STATE.kpi,[m]).filter(r => regsFilter.includes(r.region) || STATE.regions.includes('Todas'));
    return {m, real:avg(regs.map(r=>r.real)), meta:objective(STATE.kpi,m), aa:avg(regs.map(r=>r.aa))};
  });
  const series = STATE.kpi === 'adt'
    ? [{key:'real',label:'ADT Real',cls:'real'},{key:'aa',label:'ADT AA',cls:'aa'},{key:'gap',label:'Dif vs AA',cls:'gap'}]
    : STATE.kpi === 'segundas'
      ? [{key:'real',label:'Real',cls:'real'},{key:'meta',label:'Meta',cls:'meta'},{key:'aa',label:'AA',cls:'aa'}]
      : [{key:'real',label:'Real',cls:'real'},{key:'meta',label:'Meta',cls:'meta'}];
  const points = vals.map(v => ({...v, gap: (v.real!==null && v.aa!==null) ? v.real-v.aa : null}));
  const all = points.flatMap(v => series.map(s=>v[s.key])).map(num).filter(v=>v!==null);
  if (!all.length) { $('#trendChart').innerHTML = '<p class="map-note">Sin datos suficientes para construir tendencia.</p>'; return; }
  let min=Math.min(...all), max=Math.max(...all); if (min===max) { min-=1; max+=1; }
  const pad=(max-min)*.12; min-=pad; max+=pad; const span=max-min;
  const W=920,H=300, left=58, top=22, right=28, bottom=52, cw=W-left-right, ch=H-top-bottom;
  const x=i => left + (points.length<=1?0:i*(cw/(points.length-1)));
  const y=v => top + ch - (((v-min)/span)*ch);
  const pathFor = key => points.map((p,i)=> num(p[key])===null ? null : `${i===0?'M':'L'} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).filter(Boolean).join(' ');
  const dotFor = (key,cls) => points.map((p,i)=> num(p[key])===null ? '' : `<circle class="line-dot ${cls}" cx="${x(i)}" cy="${y(p[key])}" r="4"><title>${p.m}: ${key==='gap'?diffFmt(p[key],k):fmt(p[key],k)}</title></circle>`).join('');
  $('#trendTitle').textContent = `Tendencia dinámica · ${KPI_CONFIG[STATE.kpi].label}`;
  $('#axisHint').textContent = KPI_CONFIG[STATE.kpi].axis;
  const legend = series.map(s=>`<span class="legend-dot ${s.cls}"></span>${s.label}`).join(' ');
  $('#trendChart').innerHTML = `<div class="line-legend">${legend}</div><span class="axis-note">Rango ${fmt(min,k)} → ${fmt(max,k)}</span><svg class="line-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <g class="grid-lines">${[0,1,2,3].map(i=>`<line x1="${left}" x2="${W-right}" y1="${top+i*ch/3}" y2="${top+i*ch/3}"/>`).join('')}</g>
    <g class="month-labels">${points.map((p,i)=>`<text x="${x(i)}" y="${H-18}" text-anchor="middle">${p.m}</text>`).join('')}</g>
    ${series.map(s=>`<path class="line-path ${s.cls}" d="${pathFor(s.key)}"></path>${dotFor(s.key,s.cls)}`).join('')}
  </svg>`;
}
function renderRanks(){
  const rows = aggregateStoreRows().filter(r => num(r.metric)!==null);
  const max=Math.max(.001,...rows.map(r=>Math.abs(r.metric||0)));
  const top=[...rows].sort((a,b)=>b.metric-a.metric).slice(0,10);
  const bottom=[...rows].sort((a,b)=>a.metric-b.metric).slice(0,10);
  $('#topList').innerHTML = top.map((r,i)=>rankHtml(r,i,'top',max)).join('') || '<p class="map-note">Sin datos</p>';
  $('#bottomList').innerHTML = bottom.map((r,i)=>rankHtml(r,i,'bottom',max)).join('') || '<p class="map-note">Sin datos</p>';
}
function rankHtml(r,i,type,max){ const k=currentKind(); const value = STATE.kpi==='adt' ? diffFmt(r.metric,'number') : fmt(r.real,k); return `<button class="rank-card" data-ceco="${r.ceco}"><span class="rank-medal">${type==='top'?(i<3?['🥇','🥈','🥉'][i]:i+1):'⚠'}</span><span class="rank-info"><strong>${r.tienda}</strong><em>${r.ceco} · ${r.region}</em></span><span class="rank-value ${num(r.difMeta)<0?'txt-red':'txt-green'}">${value}</span></button>`; }
function renderInsights(){
  const regs=aggregateRegions(); const stores=aggregateStoreRows(); const k=currentKind();
  const best=[...regs].sort((a,b)=>b.real-a.real)[0]; const risk=[...regs].sort((a,b)=>(a.difMeta??999)-(b.difMeta??999))[0]; const growth=[...regs].sort((a,b)=>(b.difAA??-999)-(a.difAA??-999))[0]; const drop=[...regs].sort((a,b)=>(a.difAA??999)-(b.difAA??999))[0]; const top=[...stores].sort((a,b)=>b.metric-a.metric)[0]; const bottom=[...stores].sort((a,b)=>a.metric-b.metric)[0];
  const totalStores = Object.keys(DB.kpis?.[STATE.kpi]?.records || {}).length;
  const comparableNote = STATE.kpi === 'adt' ? ['amber','Tiendas comparables',`ADT considera ${stores.length} de ${totalStores} tiendas con dato en 2026 y 2025 para el mismo mes seleccionado. Las tiendas nuevas sin AA quedan fuera de Top, Bottom, Score, tendencia y promedios.`] : null;
  const data=[
    comparableNote,
    ['green','Mejor desempeño', best?`${best.region} lidera ${KPI_CONFIG[STATE.kpi].short} con ${fmt(best.real,k)} (${diffFmt(best.difMeta,k)} vs meta).`:'Sin datos.'],
    ['red','Mayor oportunidad', risk?`${risk.region} requiere foco ejecutivo: ${diffFmt(risk.difMeta,k)} contra meta y score ${risk.score}.`:'Sin datos.'],
    ['green','Mayor avance vs AA', growth?`${growth.region} muestra el mejor avance vs ${priorYear()}: ${diffFmt(growth.difAA,k)}.`:'Sin datos.'],
    ['amber','Retroceso a vigilar', drop?`${drop.region} presenta la caída relativa más relevante vs AA: ${diffFmt(drop.difAA,k)}.`:'Sin datos.'],
    ['green','Tienda referente', top?`${top.tienda} (${top.region}) aparece como referencia del filtro actual.`:'Sin datos.'],
    ['red','Tienda crítica', bottom?`${bottom.tienda} (${bottom.region}) debe revisarse primero en el ranking Bottom.`:'Sin datos.']
  ].filter(Boolean);
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

function setupPWA(){
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW no registrado', err));
    });
  }
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    DEFERRED_INSTALL_PROMPT = event;
    const btn = $('#installBtn');
    if (btn) btn.classList.remove('hidden');
  });
  window.addEventListener('appinstalled', () => {
    DEFERRED_INSTALL_PROMPT = null;
    const btn = $('#installBtn');
    if (btn) btn.classList.add('hidden');
  });
}
setupPWA();

boot().catch(err => { console.error(err); document.body.innerHTML = `<pre style="padding:30px;color:#b00000">Error cargando Centro Ejecutivo v5.2 Pro: ${err.message}</pre>`; });
