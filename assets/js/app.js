const MONTH_ORDER = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

let DB = null;
let META = {};
let state = { kpi: null, month: 'Jun', region: 'Nacional', year: '2026', view: 'nacional' };

const $ = (s) => document.querySelector(s);
const safeNum = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const norm = (v) => String(v ?? '').trim();

function buildMeta() {
  const fallbackTitles = {
    conexion: 'RESUMEN CONEXIÓN | CONEXIÓN CON EL CLIENTE',
    bebida: 'RESUMEN BEBIDA | CALIDAD DE BEBIDAS',
    tplh: 'RESUMEN PRODUCTIVIDAD | TPLH',
    segundas: 'RESUMEN SEGUNDAS VENTAS |',
    adt: 'RESUMEN ADTS | TIENDAS COMPARABLES'
  };
  META = Object.fromEntries(Object.entries(DB.kpis || {}).map(([id, k]) => {
    const label = k.label || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const isPercent = Boolean(k.isPercent || k.unit === '%');
    return [id, {
      id,
      title: fallbackTitles[id] || `RESUMEN ${label.toUpperCase()} | CENTRO EJECUTIVO`,
      short: label,
      goal: k.goalKey || k.objective || label,
      unit: k.unit || (isPercent ? '%' : ''),
      kind: isPercent ? 'percent' : 'number',
      months: (k.months && k.months.length ? k.months : MONTH_ORDER).filter(m => MONTH_ORDER.includes(m)),
      direction: k.direction || 'higher_is_better'
    }];
  }));
}

function getYearsForKpi(kpi) {
  const years = new Set();
  Object.values(DB.kpis?.[kpi]?.records || {}).forEach(rec => Object.keys(rec || {}).forEach(y => years.add(y)));
  return [...years].sort();
}
function latestYearFor(kpi) { return getYearsForKpi(kpi).at(-1) || '2026'; }
function priorYearFor(kpi) {
  const years = getYearsForKpi(kpi);
  const latest = state.year || years.at(-1);
  const idx = years.indexOf(latest);
  return idx > 0 ? years[idx - 1] : String(Number(latest) - 1);
}
function availableMonths(kpi) {
  const m = META[kpi]?.months?.length ? META[kpi].months : (DB.months || MONTH_ORDER);
  return m.filter(x => MONTH_ORDER.includes(x));
}
function storeMap() { return new Map((DB.stores || []).map(s => [norm(s.ceco), s])); }

function objective(kpi, month) {
  const meta = META[kpi];
  if (!meta) return null;
  const row = DB.objectives?.[month] || {};
  const direct = row[meta.goal] ?? row[meta.short] ?? row[kpi];
  return safeNum(direct);
}

function valuesFor(kpi, year = state.year, month = 'YTD', region = state.region) {
  const kp = DB.kpis?.[kpi];
  if (!kp) return [];
  const sm = storeMap();
  const out = [];
  Object.entries(kp.records || {}).forEach(([ceco, years]) => {
    const y = years?.[year];
    if (!y) return;
    const value = safeNum(y[month]);
    if (value === null) return;
    const s = sm.get(norm(ceco)) || {};
    const storeRegion = s.region || 'Sin Región';
    if (region !== 'Nacional' && storeRegion !== region) return;
    const aa = safeNum(years?.[priorYearFor(kpi)]?.[month]);
    out.push({ ceco, tienda: s.tienda || ceco, region: storeRegion, value, aa });
  });
  return out;
}
function avg(arr, field = 'value') {
  const vals = arr.map(x => safeNum(x[field])).filter(v => v !== null);
  return vals.length ? vals.reduce((a,b) => a + b, 0) / vals.length : null;
}
function fmt(v, k) {
  const n = safeNum(v);
  if (n === null) return '--';
  if (k === 'percent') return `${(n * 100).toFixed(1)}%`;
  if (Math.abs(n) >= 100) return Math.round(n).toLocaleString('es-MX');
  return (Math.round(n * 10) / 10).toLocaleString('es-MX');
}
function diffFmt(v, k) {
  const n = safeNum(v);
  if (n === null) return '--';
  const sign = n > 0 ? '+' : '';
  if (k === 'percent') return `${sign}${(n * 100).toFixed(1)} pp`;
  return `${sign}${Math.round(n * 10) / 10}`;
}
function statusClass(d, k) {
  const n = safeNum(d);
  if (n === null) return 'amber';
  const t = k === 'percent' ? 0.005 : 0.5;
  return n >= 0 ? 'green' : (n >= -t ? 'amber' : 'red');
}
function score(real, meta, aa, kpi) {
  const r = safeNum(real);
  if (r === null) return 0;
  const kind = META[kpi]?.kind || 'number';
  let s = 60;
  if (safeNum(meta) !== null) {
    const d = r - meta;
    s += d >= 0 ? 30 : Math.max(-30, d * (kind === 'percent' ? 900 : 25));
  }
  if (safeNum(aa) !== null) {
    const d = r - aa;
    s += d >= 0 ? 10 : Math.max(-10, d * (kind === 'percent' ? 250 : 8));
  }
  return Math.max(0, Math.min(100, Math.round(s)));
}
function regionAgg(kpi, month = 'YTD') {
  return (DB.regions || []).map(r => {
    const rows = valuesFor(kpi, state.year, month, r);
    const aaRows = valuesFor(kpi, priorYearFor(kpi), month, r);
    const real = avg(rows);
    const aa = avg(aaRows);
    const meta = objective(kpi, state.month);
    return { region: r, real, meta, aa, difMeta: meta === null || real === null ? null : real - meta, difAA: aa === null || real === null ? null : real - aa, count: rows.length };
  }).filter(x => x.real !== null).sort((a,b) => b.real - a.real);
}

function ensureState() {
  const kpis = Object.keys(DB.kpis || {});
  if (!state.kpi || !DB.kpis[state.kpi]) state.kpi = kpis[0];
  state.year = latestYearFor(state.kpi);
  const months = availableMonths(state.kpi);
  if (!months.includes(state.month)) state.month = months.at(-1) || 'Jun';
  if (state.region !== 'Nacional' && !(DB.regions || []).includes(state.region)) state.region = 'Nacional';
}

function renderControls() {
  const kpis = Object.keys(DB.kpis || {});
  $('#kpiTabs').innerHTML = kpis.map(k => `
    <button class="tab ${k === state.kpi ? 'active' : ''}" data-kpi="${k}" title="Cambiar a ${META[k]?.short || k}">
      <span class="tab-dot"></span>${META[k]?.short || k}
    </button>`).join('');
  $('#kpiTabs').onclick = e => {
    const b = e.target.closest('button[data-kpi]');
    if (!b) return;
    state.kpi = b.dataset.kpi;
    ensureState();
    render();
  };
  $('#monthSelect').innerHTML = availableMonths(state.kpi).map(m => `<option ${m === state.month ? 'selected' : ''}>${m}</option>`).join('');
  $('#regionSelect').innerHTML = ['Nacional', ...(DB.regions || [])].map(r => `<option ${r === state.region ? 'selected' : ''}>${r}</option>`).join('');
  $('#viewMode').value = state.view;
  $('#monthSelect').onchange = e => { state.month = e.target.value; render(); };
  $('#regionSelect').onchange = e => { state.region = e.target.value; render(); };
  $('#viewMode').onchange = e => { state.view = e.target.value; document.body.dataset.mode = state.view; };
}
function renderCards(real, meta, aa, dMeta, dAA, scoreVal) {
  const k = META[state.kpi].kind;
  const status = scoreVal >= 80 ? 'CUMPLE' : scoreVal >= 65 ? 'CERCA' : 'RIESGO';
  const cards = [
    ['REAL YTD', fmt(real,k), 'Resultado acumulado', ''],
    ['META YTD', fmt(meta,k), 'Objetivo dinámico', ''],
    ['DIF vs META', diffFmt(dMeta,k), 'Brecha', dMeta >= 0 ? 'positive' : dMeta < 0 ? 'negative' : 'warning'],
    [`AA YTD ${priorYearFor(state.kpi)}`, fmt(aa,k), 'Año anterior', ''],
    ['DIF vs AA', diffFmt(dAA,k), 'Comparativo', dAA >= 0 ? 'positive' : dAA < 0 ? 'negative' : 'warning'],
    ['SCORE', `${scoreVal}`, status, scoreVal >= 80 ? 'positive' : scoreVal >= 65 ? 'warning' : 'negative']
  ];
  $('#kpiCards').innerHTML = cards.map(c => `<article class="metric-card ${c[3]}"><header>${c[0]}</header><strong>${c[1]}</strong><em>${c[2]}</em></article>`).join('');
}
function renderRegionTable(regs, national) {
  const k = META[state.kpi].kind;
  $('#regionTable').innerHTML = `<thead><tr><th>Región</th><th>${META[state.kpi].short} Real</th><th>Meta</th><th>AA</th><th>Dif Meta</th><th>Dif AA</th><th>Semáforo</th></tr></thead><tbody>` +
    regs.map(r => `<tr data-region="${r.region}"><td>${r.region}</td><td>${fmt(r.real,k)}</td><td>${fmt(r.meta,k)}</td><td>${fmt(r.aa,k)}</td><td class="${r.difMeta < 0 ? 'txt-red':'txt-green'}">${diffFmt(r.difMeta,k)}</td><td class="${r.difAA < 0 ? 'txt-red':'txt-green'}">${diffFmt(r.difAA,k)}</td><td><i class="semaforo ${statusClass(r.difMeta,k)}"></i></td></tr>`).join('') +
    `<tr class="national"><td>NACIONAL</td><td>${fmt(national.real,k)}</td><td>${fmt(national.meta,k)}</td><td>${fmt(national.aa,k)}</td><td>${diffFmt(national.dMeta,k)}</td><td>${diffFmt(national.dAA,k)}</td><td><i class="semaforo ${statusClass(national.dMeta,k)}"></i></td></tr></tbody>`;
}
function renderRanks() {
  const k = META[state.kpi].kind;
  const rows = valuesFor(state.kpi, state.year, 'YTD', state.region).filter(x => x.value !== null);
  const top = [...rows].sort((a,b) => b.value - a.value).slice(0,10);
  const bottom = [...rows].sort((a,b) => a.value - b.value).slice(0,10);
  const row = x => `<div class="rank-row"><b>${x.i}</b><div><div class="name">${x.tienda}</div><div class="meta">${x.ceco} · ${x.region}</div></div><div class="value">${fmt(x.value,k)}</div></div>`;
  $('#topList').innerHTML = top.map((x,i) => row({...x, i:i+1})).join('') || '<div class="empty">Sin datos</div>';
  $('#bottomList').innerHTML = bottom.map((x,i) => row({...x, i:i+1})).join('') || '<div class="empty">Sin datos</div>';
}
function renderTrend() {
  const k = META[state.kpi].kind;
  const vals = availableMonths(state.kpi).map(m => ({ m, real: avg(valuesFor(state.kpi, state.year, m, state.region)), meta: objective(state.kpi, m) }));
  const max = Math.max(1, ...vals.flatMap(v => [v.real || 0, v.meta || 0]));
  $('#trendTitle').textContent = `TENDENCIA MENSUAL ${META[state.kpi].short.toUpperCase()}`;
  $('#trendChart').innerHTML = vals.map(v => `<div class="bar-col"><div class="bar-wrap"><div title="Real ${fmt(v.real,k)}" class="bar" style="height:${Math.max(4,(v.real || 0)/max*210)}px"></div><div title="Meta ${fmt(v.meta,k)}" class="bar meta" style="height:${Math.max(4,(v.meta || 0)/max*210)}px"></div></div><div class="bar-label">${v.m}</div></div>`).join('');
}
function renderInsights(regs, national, scoreVal) {
  const k = META[state.kpi].kind;
  const best = regs[0];
  const worst = regs[regs.length - 1];
  const items = [
    ['Desempeño nacional', `${META[state.kpi].short} alcanza ${fmt(national.real,k)} YTD, ${national.dMeta >= 0 ? 'por arriba' : 'por debajo'} de meta en ${diffFmt(national.dMeta,k)}.`],
    ['Región líder', `${best?.region || '--'} lidera el desempeño con ${fmt(best?.real,k)}.`],
    ['Mayor oportunidad', `${worst?.region || '--'} concentra la brecha más relevante con ${fmt(worst?.real,k)}.`],
    ['KPI dinámico', `La vista está leyendo ${META[state.kpi].short} desde el modelo; al cambiar KPI se actualizan tarjetas, rankings, tendencia e insights.`]
  ];
  $('#insights').innerHTML = items.map((it,i) => `<div class="insight"><div class="icon">${i+1}</div><div><h4>${it[0]}</h4><p>${it[1]}</p></div></div>`).join('');
  $('#recommendations').innerHTML = [
    ['Prioridad regional', `Enfocar seguimiento en ${worst?.region || 'la región con menor desempeño'}.`],
    ['Replicar prácticas', `Documentar acciones de ${best?.region || 'la región líder'} y escalar al resto.`],
    ['Cambio de KPI', 'Usar el selector superior para comparar ADT, Conexión, Bebida, TPLH y Segundas sin cambiar de pestaña.'],
    ['Drill Down', 'Usar filtro de región para profundizar por tienda y CeCo.']
  ].map(r => `<div class="rec"><b>${r[0]}</b><p>${r[1]}</p></div>`).join('');
}
function render() {
  ensureState();
  renderControls();
  const meta = META[state.kpi];
  document.body.dataset.kpi = state.kpi;
  $('#viewTitle').textContent = meta.title;
  $('#periodPill').textContent = `YTD ${state.month.toUpperCase()} ${state.year}`;
  $('#scopeLabel').textContent = `${state.region.toUpperCase()} · ${state.month.toUpperCase()} · ${meta.short.toUpperCase()}`;
  const real = avg(valuesFor(state.kpi, state.year, 'YTD', state.region));
  const aa = avg(valuesFor(state.kpi, priorYearFor(state.kpi), 'YTD', state.region));
  const obj = objective(state.kpi, state.month);
  const dMeta = obj === null || real === null ? null : real - obj;
  const dAA = aa === null || real === null ? null : real - aa;
  const sc = score(real, obj, aa, state.kpi);
  $('#summaryHeadline').innerHTML = `${meta.short} alcanza <span>${fmt(real,meta.kind)}</span> YTD`;
  $('#summaryText').innerHTML = `${dMeta === null ? 'Sin objetivo disponible' : (dMeta >= 0 ? 'Por arriba de la meta en ' : 'Por debajo de la meta en ') + diffFmt(dMeta,meta.kind)} y ${dAA === null ? 'sin comparativo AA' : (dAA >= 0 ? 'por arriba del AA en ' : 'por debajo del AA en ') + diffFmt(dAA,meta.kind)}.`;
  renderCards(real, obj, aa, dMeta, dAA, sc);
  const regs = regionAgg(state.kpi, 'YTD');
  renderRegionTable(regs, { real, meta: obj, aa, dMeta, dAA });
  renderRanks();
  renderTrend();
  renderInsights(regs, { real, meta: obj, aa, dMeta, dAA }, sc);
  $('#regionCount').textContent = `${regs.length} regiones`;
}

fetch('data/kpi-data.json', { cache: 'no-store' })
  .then(r => r.json())
  .then(j => { DB = j; buildMeta(); ensureState(); render(); })
  .catch(err => { document.body.innerHTML = '<pre>Error cargando data/kpi-data.json\n' + err + '</pre>'; });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
