import { CONFIG } from '../config.js';

export function normalizeText(value){
  return String(value ?? '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').toLowerCase();
}
export function normalizeKey(value){
  return normalizeText(value).replace(/[^a-z0-9]/g,'');
}
export function toNumber(value){
  if(value === null || value === undefined || value === '') return null;
  if(typeof value === 'number' && Number.isFinite(value)) return value;
  const s = String(value).replace('%','').replace(/,/g,'').trim();
  if(!s) return null;
  const n = Number(s);
  if(!Number.isFinite(n)) return null;
  return String(value).includes('%') ? n / 100 : n;
}
export function isMonthHeader(header){
  return Boolean(CONFIG.monthAliases[normalizeKey(header)]);
}
export function monthName(header){
  return CONFIG.monthAliases[normalizeKey(header)] || null;
}
export function monthIndex(m){
  const x = monthName(m) || m;
  const i = CONFIG.months.indexOf(x);
  return i < 0 ? 99 : i;
}
export function inferYearFromText(text, fallback=null){
  const m = String(text ?? '').match(/(?:^|[^0-9])(20\d{2}|\d{2})(?:$|[^0-9])/);
  if(!m) return fallback;
  const raw = m[1];
  return raw.length === 2 ? Number(`20${raw}`) : Number(raw);
}
export function isYTDHeader(header){
  return /^ytd/i.test(String(header ?? '').trim());
}
export function detectHeaderRow(rows){
  let best = { index: 0, score: -1 };
  rows.slice(0, 15).forEach((row, idx) => {
    const values = row.map(x => String(x ?? '').trim()).filter(Boolean);
    const score = values.length + values.filter(v => /ceco|mes|semana|region|región|tienda|ytd/i.test(v)).length * 4 + values.filter(isMonthHeader).length * 3;
    if(score > best.score) best = { index: idx, score };
  });
  return best.index;
}
export function buildHeaderMap(headers){
  const map = new Map();
  headers.forEach((h,i) => map.set(normalizeKey(h), { index:i, original:h }));
  return map;
}
export function getByAliases(row, aliases){
  const keys = Object.keys(row || {});
  for(const alias of aliases){
    const target = normalizeKey(alias);
    const found = keys.find(k => normalizeKey(k) === target);
    if(found !== undefined) return row[found];
  }
  return null;
}
export function unique(values){
  return [...new Set(values.filter(v => v !== null && v !== undefined && v !== ''))];
}
export function groupBy(list, keyFn){
  return list.reduce((acc,item) => { const k = keyFn(item); (acc[k] ||= []).push(item); return acc; }, {});
}
export function average(values){
  const nums = values.map(toNumber).filter(v => v !== null);
  return nums.length ? nums.reduce((a,b)=>a+b,0)/nums.length : null;
}
export function sum(values){
  const nums = values.map(toNumber).filter(v => v !== null);
  return nums.length ? nums.reduce((a,b)=>a+b,0) : null;
}
export function round(value, digits=1){
  const n = toNumber(value);
  if(n === null) return null;
  return Number(n.toFixed(digits));
}
export function fmt(value, kpi=''){
  const n = toNumber(value);
  if(n === null) return '—';
  if(['Conexión','Bebida'].includes(kpi)) return `${(n*100).toFixed(1)}%`;
  if(String(kpi).includes('Cx')) return n.toFixed(1);
  if(kpi === 'TPLH') return n.toFixed(1);
  if(kpi === 'ADT') return n.toFixed(0);
  return n.toFixed(1);
}
export function download(filename, text){
  const blob = new Blob([text], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
