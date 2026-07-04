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
  const selectedRegion = state.region;
  const maxReal = Math.max(1, ...regs.map(r => Math.abs(safeNum(r.real) || 0)));
  const maxGap = Math.max(1, ...regs.map(r => Math.abs(safeNum(r.difMeta) || 0)));

  $('#regionBars').innerHTML = regs.map((r, idx) => {
    const status = statusClass(r.difMeta, k);
    const realWidth = Math.max(3, Math.min(100, Math.abs(safeNum(r.real) || 0) / maxReal * 100));
    const gapWidth = Math.max(3, Math.min(100, Math.abs(safeNum(r.difMeta) || 0) / maxGap * 100));
    const isActive = selectedRegion === r.region;
    return `
      <button class="region-bar-row ${isActive ? 'active' : ''}" data-region="${r.region}" style="--w:${realWidth}%;--gap:${gapWidth}%">
        <div class="rb-head">
          <b>${idx + 1}. ${r.region}</b>
          <span>${fmt(r.real, k)}</span>
        </div>
        <div class="rb-track"><i class="rb-fill ${status}"></i></div>
        <div class="rb-foot">
          <span>Meta ${fmt(r.meta, k)}</span>
          <strong class="${r.difMeta < 0 ? 'txt-red' : 'txt-green'}">${diffFmt(r.difMeta, k)}</strong>
        </div>
      </button>`;
  }).join('') || '<div class="empty">Sin regiones para comparar</div>';

  $('#regionBars').onclick = e => {
    const row = e.target.closest('[data-region]');
    if (!row) return;
    state.region = row.dataset.region;
    render();
  };

  $('#regionTable').innerHTML = `<thead><tr><th>Región</th><th>${META[state.kpi].short} Real</th><th>Meta</th><th>AA</th><th>Dif Meta</th><th>Dif AA</th><th>Semáforo</th></tr></thead><tbody>` +
    regs.map(r => `<tr data-region="${r.region}" class="${selectedRegion === r.region ? 'selected' : ''}"><td>${r.region}</td><td>${fmt(r.real,k)}</td><td>${fmt(r.meta,k)}</td><td>${fmt(r.aa,k)}</td><td class="${r.difMeta < 0 ? 'txt-red':'txt-green'}">${diffFmt(r.difMeta,k)}</td><td class="${r.difAA < 0 ? 'txt-red':'txt-green'}">${diffFmt(r.difAA,k)}</td><td><i class="semaforo ${statusClass(r.difMeta,k)}"></i></td></tr>`).join('') +
    `<tr class="national"><td>NACIONAL</td><td>${fmt(national.real,k)}</td><td>${fmt(national.meta,k)}</td><td>${fmt(national.aa,k)}</td><td>${diffFmt(national.dMeta,k)}</td><td>${diffFmt(national.dAA,k)}</td><td><i class="semaforo ${statusClass(national.dMeta,k)}"></i></td></tr></tbody>`;

  $('#regionTable').onclick = e => {
    const tr = e.target.closest('tr[data-region]');
    if (!tr) return;
    state.region = tr.dataset.region;
    render();
  };
}
function rankMetric(row, kpi = state.kpi) {
  const value = safeNum(row.value);
  const aa = safeNum(row.aa);
  if (value === null) return null;
  // Regla ejecutiva: ADT se evalúa como diferencia ADT_26 - ADT_25.
  if (kpi === 'adt') return aa === null ? null : value - aa;
  return value;
}
function medal(i, type) {
  if (i === 0) return type === 'top' ? '🥇' : '⚠';
  if (i === 1) return type === 'top' ? '🥈' : '⚠';
  if (i === 2) return type === 'top' ? '🥉' : '⚠';
  return String(i + 1);
}
function enrichRankRows(month = state.month) {
  const k = META[state.kpi].kind;
  const meta = objective(state.kpi, month);
  return valuesFor(state.kpi, state.year, month, state.region)
    .map(r => {
      const metric = rankMetric(r);
      const value = safeNum(r.value);
      const aa = safeNum(r.aa);
      const difMeta = meta === null || value === null ? null : value - meta;
      const difAA = aa === null || value === null ? null : value - aa;
      return { ...r, metric, meta, difMeta, difAA, value, aa, status: statusClass(difMeta, k) };
    })
    .filter(r => safeNum(r.metric) !== null);
}
function renderRankList(target, rows, type, maxAbs) {
  const k = META[state.kpi].kind;
  const label = state.kpi === 'adt' ? 'Δ ADT' : 'Real';
  const item = (x, i) => {
    const width = Math.max(4, Math.min(100, Math.abs(x.metric || 0) / Math.max(maxAbs, .0001) * 100));
    const good = type === 'top';
    const deltaClass = (x.difMeta ?? x.difAA ?? x.metric) < 0 ? 'txt-red' : 'txt-green';
    const mainValue = state.kpi === 'adt' ? diffFmt(x.metric, 'number') : fmt(x.value, k);
    const secondary = state.kpi === 'adt'
      ? `Real ${fmt(x.value,'number')} · AA ${fmt(x.aa,'number')}`
      : `Meta ${fmt(x.meta,k)} · vs Meta ${diffFmt(x.difMeta,k)}`;
    return `<button class="rank-card ${type}" data-ceco="${x.ceco}" title="${x.tienda}">
      <span class="rank-medal">${medal(i, type)}</span>
      <span class="rank-info"><strong>${x.tienda}</strong><em>${x.ceco} · ${x.region}</em></span>
      <span class="rank-value ${deltaClass}">${mainValue}</span>
      <span class="rank-track"><i class="${good ? 'green' : 'red'}" style="--rank-w:${width}%"></i></span>
      <span class="rank-sub">${label} · ${secondary} · vs AA ${diffFmt(x.difAA,k)}</span>
    </button>`;
  };
  $(target).innerHTML = rows.map(item).join('') || '<div class="empty">Sin datos para el filtro actual</div>';
}
function renderRanks() {
  const rows = enrichRankRows(state.month);
  const sorted = [...rows].sort((a,b) => b.metric - a.metric);
  const top = sorted.slice(0,10);
  const bottom = [...rows].sort((a,b) => a.metric - b.metric).slice(0,10);
  const maxAbs = Math.max(1, ...rows.map(r => Math.abs(safeNum(r.metric) || 0)));
  const scope = `${state.region === 'Nacional' ? 'Nacional' : state.region} · ${state.month} ${state.year}`;
  document.querySelector('.ranking.top .panel-title span').textContent = `Top 10 · ${scope}`;
  document.querySelector('.ranking.bottom .panel-title span').textContent = `Bottom 10 · ${scope}`;
  renderRankList('#topList', top, 'top', maxAbs);
  renderRankList('#bottomList', bottom, 'bottom', maxAbs);

  const clickHandler = e => {
    const card = e.target.closest('[data-ceco]');
    if (!card) return;
    const name = card.querySelector('strong')?.textContent || card.dataset.ceco;
    const value = card.querySelector('.rank-value')?.textContent || '';
    $('#summaryText').innerHTML = `Drill Down preparado: <b>${name}</b> (${card.dataset.ceco}) · ${META[state.kpi].short} ${value}.`;
    document.querySelectorAll('.rank-card.selected').forEach(x => x.classList.remove('selected'));
    card.classList.add('selected');
  };
  $('#topList').onclick = clickHandler;
  $('#bottomList').onclick = clickHandler;
}
function trendStats(vals) {
  const valid = vals.filter(v => safeNum(v.real) !== null);
  const first = valid[0]?.real ?? null;
  const last = valid.at(-1)?.real ?? null;
  const prev = valid.length > 1 ? valid.at(-2).real : null;
  const best = valid.length ? [...valid].sort((a,b) => b.real - a.real)[0] : null;
  const worst = valid.length ? [...valid].sort((a,b) => a.real - b.real)[0] : null;
  return {
    first, last, prev, best, worst,
    change: first === null || last === null ? null : last - first,
    mom: prev === null || last === null ? null : last - prev,
    avg: avg(valid, 'real')
  };
}
function svgPath(points) {
  return points.map((p,i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
}
function renderTrend() {
  const k = META[state.kpi].kind;
  const months = availableMonths(state.kpi);
  const vals = months.map(m => ({
    m,
    real: avg(valuesFor(state.kpi, state.year, m, state.region)),
    meta: objective(state.kpi, m)
  }));
  const realVals = vals.map(v => safeNum(v.real)).filter(v => v !== null);
  const metaVals = vals.map(v => safeNum(v.meta)).filter(v => v !== null);
  const all = [...realVals, ...metaVals];
  const min = all.length ? Math.min(...all) : 0;
  const max = all.length ? Math.max(...all) : 1;
  const pad = (max - min) * 0.14 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const w = 760, h = 268, left = 46, right = 18, top = 22, bottom = 42;
  const innerW = w - left - right;
  const innerH = h - top - bottom;
  const x = i => left + (months.length <= 1 ? innerW/2 : i * innerW / (months.length - 1));
  const y = v => top + (hi - v) * innerH / (hi - lo);
  const realPts = vals.map((v,i) => safeNum(v.real) === null ? null : ({x:x(i), y:y(v.real), value:v.real, m:v.m})).filter(Boolean);
  const metaPts = vals.map((v,i) => safeNum(v.meta) === null ? null : ({x:x(i), y:y(v.meta), value:v.meta, m:v.m})).filter(Boolean);
  const s = trendStats(vals);
  const cards = [
    ['Promedio', fmt(s.avg, k), 'Promedio mensual real'],
    ['Último mes', fmt(s.last, k), `${months.at(-1) || state.month} ${state.year}`],
    ['Cambio periodo', diffFmt(s.change, k), `${months[0] || 'Inicio'} vs ${months.at(-1) || 'Fin'}`],
    ['MoM', diffFmt(s.mom, k), 'Variación vs mes anterior']
  ];
  const area = realPts.length > 1 ? `${svgPath(realPts)} L ${realPts.at(-1).x.toFixed(1)} ${h-bottom} L ${realPts[0].x.toFixed(1)} ${h-bottom} Z` : '';
  $('#trendTitle').textContent = `TENDENCIA MENSUAL ${META[state.kpi].short.toUpperCase()}`;
  $('#trendChart').innerHTML = `
    <div class="trend-kpis">${cards.map(c => `<div class="trend-mini ${String(c[1]).startsWith('-') ? 'bad' : ''}"><span>${c[0]}</span><strong>${c[1]}</strong><em>${c[2]}</em></div>`).join('')}</div>
    <div class="trend-svg-wrap">
      <svg class="trend-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Tendencia mensual real y meta">
        <defs><linearGradient id="trendArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#006241" stop-opacity=".20"/><stop offset="100%" stop-color="#006241" stop-opacity="0"/></linearGradient></defs>
        <line x1="${left}" y1="${top}" x2="${left}" y2="${h-bottom}" class="axis"/>
        <line x1="${left}" y1="${h-bottom}" x2="${w-right}" y2="${h-bottom}" class="axis"/>
        ${[0,.25,.5,.75,1].map(t => `<line x1="${left}" x2="${w-right}" y1="${top + innerH*t}" y2="${top + innerH*t}" class="gridline"/>`).join('')}
        ${area ? `<path d="${area}" class="area"/>` : ''}
        ${metaPts.length > 1 ? `<path d="${svgPath(metaPts)}" class="meta-line"/>` : ''}
        ${realPts.length > 1 ? `<path d="${svgPath(realPts)}" class="real-line"/>` : ''}
        ${vals.map((v,i) => `<text x="${x(i)}" y="${h-16}" text-anchor="middle" class="month-tick">${v.m}</text>`).join('')}
        ${realPts.map(p => `<g class="point"><circle cx="${p.x}" cy="${p.y}" r="5"/><title>${p.m}: ${fmt(p.value,k)}</title></g>`).join('')}
        ${metaPts.map(p => `<circle class="meta-point" cx="${p.x}" cy="${p.y}" r="3.5"><title>Meta ${p.m}: ${fmt(p.value,k)}</title></circle>`).join('')}
      </svg>
      <div class="trend-legend"><span><i class="solid"></i>Real</span><span><i class="dash"></i>Meta</span><span class="trend-note">${s.best ? `Mejor mes: ${s.best.m} · ${fmt(s.best.real,k)}` : 'Sin datos mensuales'}</span></div>
    </div>
    <div class="trend-gap">${vals.map(v => { const gap = safeNum(v.real) === null || safeNum(v.meta) === null ? null : v.real - v.meta; const cls = statusClass(gap,k); const width = Math.max(4, Math.min(100, Math.abs(gap || 0) / Math.max(.0001, Math.max(...vals.map(x => Math.abs((safeNum(x.real) || 0) - (safeNum(x.meta) || 0))), .0001)) * 100)); return `<div><b>${v.m}</b><span class="gap-pill ${cls}" style="--w:${width}%"><i></i>${diffFmt(gap,k)}</span></div>`; }).join('')}</div>
  `;
}

const REGION_LAYOUT = {
  'Noroeste':      { x: 42,  y: 58,  w: 168, h: 102, poly: '42,58 210,42 230,122 184,162 60,150' },
  'Norte':         { x: 238, y: 45,  w: 164, h: 96,  poly: '238,55 390,40 416,108 352,150 250,132' },
  'Norte Centro':  { x: 430, y: 70,  w: 170, h: 96,  poly: '430,78 584,62 612,130 545,174 438,148' },
  'Occidente':     { x: 92,  y: 184, w: 168, h: 98,  poly: '96,194 238,172 270,236 218,288 92,270' },
  'Centro Norte':  { x: 284, y: 174, w: 154, h: 96,  poly: '286,184 426,166 454,230 398,276 286,258' },
  'Bajío':         { x: 462, y: 194, w: 132, h: 86,  poly: '466,204 586,186 612,244 558,292 468,272' },
  'Centro Poniente': { x: 168, y: 308, w: 162, h: 86, poly: '170,318 312,300 338,354 288,404 178,388' },
  'Centro Centro': { x: 350, y: 306, w: 144, h: 84,  poly: '354,316 480,300 504,350 458,400 356,384' },
  'Centro Sur':    { x: 518, y: 310, w: 146, h: 88,  poly: '522,320 650,302 682,362 622,410 522,390' },
  'Sur':           { x: 282, y: 430, w: 176, h: 92,  poly: '286,438 430,420 468,482 408,536 288,510' },
  'Sureste':       { x: 492, y: 428, w: 188, h: 94,  poly: '496,438 650,420 690,480 630,542 504,514' }
};

function regionByName(regs) {
  return new Map((regs || []).map(r => [r.region, r]));
}
function mapStatusLabel(scoreVal) {
  return scoreVal >= 80 ? 'Cumple' : scoreVal >= 65 ? 'Atención' : 'Riesgo';
}
function renderMap(regs, nationalScore) {
  const k = META[state.kpi].kind;
  const byRegion = regionByName(regs);
  const total = regs.length;
  const counts = regs.reduce((acc, r) => {
    acc[statusClass(r.difMeta, k)] = (acc[statusClass(r.difMeta, k)] || 0) + 1;
    return acc;
  }, { green: 0, amber: 0, red: 0 });
  $('#mapSubtitle').textContent = `${META[state.kpi].short} · ${state.month} ${state.year}`;
  $('#mapScore').textContent = nationalScore;
  $('#mapStatus').textContent = mapStatusLabel(nationalScore);
  $('#mapStats').innerHTML = `
    <div><strong>${total}</strong><span>Regiones</span></div>
    <div><strong>${counts.green || 0}</strong><span>Cumplen</span></div>
    <div><strong>${counts.amber || 0}</strong><span>Atención</span></div>
    <div><strong>${counts.red || 0}</strong><span>Riesgo</span></div>`;

  const shapes = Object.entries(REGION_LAYOUT).map(([region, box]) => {
    const r = byRegion.get(region) || { region, real: null, meta: null, aa: null, difMeta: null, difAA: null };
    const st = statusClass(r.difMeta, k);
    const active = state.region === region ? ' active' : '';
    const title = `${region}\n${META[state.kpi].short}: ${fmt(r.real,k)}\nMeta: ${fmt(r.meta,k)}\nvs Meta: ${diffFmt(r.difMeta,k)}\nAA: ${fmt(r.aa,k)}\nvs AA: ${diffFmt(r.difAA,k)}`;
    return `<g class="map-region ${st}${active}" data-region="${region}" tabindex="0" role="button" aria-label="${region}">
      <polygon points="${box.poly}"></polygon>
      <text x="${box.x + box.w/2}" y="${box.y + box.h/2 - 6}" text-anchor="middle">${region}</text>
      <text class="map-value" x="${box.x + box.w/2}" y="${box.y + box.h/2 + 17}" text-anchor="middle">${fmt(r.real,k)}</text>
      <title>${title}</title>
    </g>`;
  }).join('');

  $('#mexicoSvgMap').innerHTML = `
    <svg class="operational-map" viewBox="0 0 730 585" role="img" aria-label="Mapa operativo de regiones Starbucks México">
      <defs>
        <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#003b2b" flood-opacity=".12"/></filter>
      </defs>
      <path class="map-backdrop" d="M42 58 C160 0 320 20 410 42 C520 70 644 72 688 140 C736 214 676 318 694 414 C710 504 606 562 510 552 C410 542 334 576 238 530 C144 486 62 434 52 330 C42 224 8 132 42 58 Z"/>
      ${shapes}
    </svg>`;
  const go = (el) => {
    if (!el) return;
    state.region = el.dataset.region;
    render();
  };
  $('#mexicoSvgMap').onclick = e => go(e.target.closest('[data-region]'));
  $('#mexicoSvgMap').onkeydown = e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const g = e.target.closest('[data-region]');
    if (!g) return;
    e.preventDefault();
    go(g);
  };
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
  renderMap(regs, sc);
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
