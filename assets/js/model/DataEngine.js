import { CONFIG } from '../config.js';
import { WorkbookLoader } from './WorkbookLoader.js';
import { Directorio } from './Directorio.js';
import { BaseMesSemana } from './BaseMesSemana.js';
import { Objetivos } from './Objetivos.js';
import { KPIFactory } from './KPIFactory.js';
import { average, groupBy, monthIndex, normalizeKey, round, unique } from '../utils/Helpers.js';

export class DataEngine {
  constructor(options = {}){
    this.path = options.path || CONFIG.workbookPath;
    this.loader = new WorkbookLoader(this.path);
    this.factory = new KPIFactory();
    this.logs = [];
    this.reset();
  }
  reset(){
    this.workbook = null;
    this.directorio = null;
    this.baseMesSemana = null;
    this.objetivos = null;
    this.records = [];
    this.diagnostics = { sheets: [], kpis: [], warnings: [] };
  }
  log(message){ this.logs.push(`[${new Date().toLocaleTimeString()}] ${message}`); }
  async load(){
    this.reset();
    this.log('Iniciando lectura del Excel...');
    this.workbook = await this.loader.load();
    this.log(`Workbook cargado con ${this.workbook.sheetNames.length} hojas.`);
    const sheets = this.workbook.sheets;
    this.directorio = new Directorio(sheets['Directorio']);
    this.baseMesSemana = new BaseMesSemana(sheets['Base_Mes_Semana']);
    this.objetivos = new Objetivos(sheets['Obj_Region_26']);
    this.log(`Directorio: ${this.directorio.records.length} CeCos detectados.`);
    this.log(`Objetivos: ${this.objetivos.kpis.length} KPIs con meta mensual.`);
    this.buildUnifiedModel();
    return this.snapshot();
  }
  buildUnifiedModel(){
    const all = [];
    for(const sheetName of this.workbook.sheetNames){
      const sheet = this.workbook.sheets[sheetName];
      const records = this.factory.recordsFromSheet(sheet);
      const monthHeaders = sheet.headers.filter(h => monthIndex(h) < 99);
      this.diagnostics.sheets.push({
        Hoja: sheetName,
        Filas: sheet.rows.length,
        Encabezados: sheet.headers.length,
        Meses: monthHeaders.map(h => monthIndex(h) < 99 ? h : null).filter(Boolean).join(', '),
        RegistrosModelo: records.length
      });
      all.push(...records);
    }
    this.records = all
      .map(r => this.baseMesSemana.enrich(r))
      .map(r => this.directorio.enrich(r))
      .map(r => this.objetivos.enrich(r))
      .map(r => ({
        ...r,
        VariacionAA: null,
        Estado: this.estado(r.Valor, r.Meta)
      }));
    this.addYearOverYear();
    this.diagnostics.kpis = this.kpis().map(kpi => ({ KPI:kpi, Registros:this.records.filter(r => r.KPI === kpi).length }));
    this.log(`Modelo unificado creado: ${this.records.length.toLocaleString('es-MX')} registros.`);
  }
  addYearOverYear(){
    const map = new Map();
    for(const r of this.records){
      if(r.Mes === 'YTD') continue;
      map.set(`${r.CeCo}::${r.KPI}::${r.Mes}::${r.Año}`, r.Valor);
    }
    this.records = this.records.map(r => {
      const previous = map.get(`${r.CeCo}::${r.KPI}::${r.Mes}::${Number(r.Año)-1}`);
      return { ...r, AA: previous ?? null, VariacionAA: previous === undefined || previous === null ? null : r.Valor - previous };
    });
  }
  estado(valor, meta){
    if(meta === null || meta === undefined || valor === null || valor === undefined) return 'Sin meta';
    const diff = valor - meta;
    if(diff >= 0) return 'Cumple';
    if(diff >= -0.005 || Math.abs(diff / (meta || 1)) <= 0.02) return 'Atención';
    return 'Riesgo';
  }
  snapshot(){
    return { records:this.records, diagnostics:this.diagnostics, logs:this.logs, meta:this.meta() };
  }
  meta(){
    return { totalRecords:this.records.length, sheets:this.workbook?.sheetNames || [], kpis:this.kpis(), months:this.months(), years:this.years(), regions:this.regions() };
  }
  kpis(){ return unique(this.records.map(r => r.KPI)).sort(); }
  months(){ return unique(this.records.map(r => r.Mes)).sort((a,b)=>monthIndex(a)-monthIndex(b)); }
  years(){ return unique(this.records.map(r => String(r.Año))).sort(); }
  regions(){ return unique(this.records.map(r => r.Region)).sort(); }
  filter({kpi=null, mes=null, region=null, year=null, tipo='Mensual'} = {}){
    return this.records.filter(r =>
      (!kpi || r.KPI === kpi) &&
      (!mes || r.Mes === mes) &&
      (!region || r.Region === region) &&
      (!year || String(r.Año) === String(year)) &&
      (!tipo || r.Tipo === tipo)
    );
  }
  summary(filters={}){
    const rows = this.filter(filters);
    const real = average(rows.map(r => r.Valor));
    const meta = average(rows.map(r => r.Meta));
    const aa = average(rows.map(r => r.AA));
    const vsMeta = real === null || meta === null ? null : real - meta;
    const vsAA = real === null || aa === null ? null : real - aa;
    const score = this.executiveScore(real, meta, aa);
    return { real, meta, aa, vsMeta, vsAA, score, count: rows.length, estado: this.estado(real, meta) };
  }
  executiveScore(real, meta, aa){
    if(real === null) return null;
    let score = 60;
    if(meta !== null){ score += Math.max(-35, Math.min(35, ((real - meta) / Math.abs(meta || 1)) * 100)); }
    if(aa !== null){ score += Math.max(-20, Math.min(20, ((real - aa) / Math.abs(aa || 1)) * 60)); }
    return Math.round(Math.max(0, Math.min(100, score)));
  }
  regional(filters={}){
    const rows = this.filter(filters);
    const groups = groupBy(rows, r => r.Region || 'Sin región');
    return Object.entries(groups).map(([region, list]) => {
      const real = average(list.map(r => r.Valor));
      const meta = average(list.map(r => r.Meta));
      const aa = average(list.map(r => r.AA));
      return { Region:region, Real:round(real,4), Meta:round(meta,4), AA:round(aa,4), VsMeta:round(real!==null&&meta!==null?real-meta:null,4), VsAA:round(real!==null&&aa!==null?real-aa:null,4), Tiendas:unique(list.map(r=>r.CeCo)).length };
    }).sort((a,b)=>(b.VsMeta ?? -999)-(a.VsMeta ?? -999));
  }
}
