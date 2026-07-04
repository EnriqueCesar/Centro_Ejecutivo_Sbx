import { CONFIG } from '../config.js';
import { getByAliases, inferYearFromText, isMonthHeader, isYTDHeader, monthName, normalizeKey, toNumber } from '../utils/Helpers.js';

export class KPIFactory {
  constructor(){ this.months = CONFIG.months; }
  isSystemSheet(name){ return CONFIG.systemSheets.map(normalizeKey).includes(normalizeKey(name)); }
  canonicalKPI(sheetName, header=null){
    const key = normalizeKey(header || sheetName).replace(/20\d{2}|\d{2}|ytd/g,'');
    for(const [alias, name] of Object.entries(CONFIG.kpiAliases)){
      if(key.includes(alias)) return name;
    }
    return String(sheetName).replace(/_?\d{2,4}$/,'').replace(/_/g,' ').trim();
  }
  extractYear(sheetName, header=null){
    return inferYearFromText(header, inferYearFromText(sheetName, CONFIG.currentYear));
  }
  recordsFromSheet(sheet){
    if(this.isSystemSheet(sheet.name)) return [];
    const headers = sheet.headers || [];
    const hasSemana = headers.some(h => normalizeKey(h) === 'semana');
    const monthHeaders = headers.filter(isMonthHeader);
    const ytdHeaders = headers.filter(isYTDHeader);
    if(hasSemana) return this.weeklyRecords(sheet);
    if(monthHeaders.length) return this.wideMonthlyRecords(sheet, monthHeaders, ytdHeaders);
    return this.longRecords(sheet);
  }
  wideMonthlyRecords(sheet, monthHeaders, ytdHeaders){
    const out = [];
    const kpi = this.canonicalKPI(sheet.name);
    const year = this.extractYear(sheet.name);
    for(const row of sheet.rows){
      const ceco = getByAliases(row, ['CeCo','CC','Centro Costo']);
      if(!ceco || /^ytd/i.test(String(ceco))) continue;
      for(const mh of monthHeaders){
        const val = toNumber(row[mh]);
        if(val === null) continue;
        out.push({ sourceSheet: sheet.name, Año: year, Mes: monthName(mh), Semana:null, CeCo:String(ceco).trim(), KPI:kpi, Valor:val, Tipo:'Mensual', raw:row });
      }
      for(const yh of ytdHeaders){
        const val = toNumber(row[yh]);
        if(val === null) continue;
        out.push({ sourceSheet: sheet.name, Año:this.extractYear(sheet.name, yh), Mes:'YTD', Semana:null, CeCo:String(ceco).trim(), KPI:kpi, Valor:val, Tipo:'YTD', raw:row });
      }
    }
    return out;
  }
  weeklyRecords(sheet){
    const out = [];
    const cecoAliases = ['CeCo','CC','Centro Costo'];
    const valueHeaders = sheet.headers.filter(h => !['ceco','tienda','semana','region','región'].includes(normalizeKey(h)));
    const kpiHeader = valueHeaders[0] || this.canonicalKPI(sheet.name);
    const kpi = this.canonicalKPI(sheet.name, kpiHeader);
    const year = this.extractYear(sheet.name);
    for(const row of sheet.rows){
      const ceco = getByAliases(row, cecoAliases);
      const semana = getByAliases(row, ['Semana','Week']);
      const value = toNumber(row[kpiHeader]);
      if(!ceco || !semana || value === null) continue;
      out.push({ sourceSheet: sheet.name, Año:year, Mes:null, Semana:Number(semana), CeCo:String(ceco).trim(), KPI:kpi, Valor:value, Tipo:'Semanal', raw:row });
    }
    return out;
  }
  longRecords(sheet){
    const out = [];
    const headers = sheet.headers || [];
    const cecoHeader = headers.find(h => normalizeKey(h) === 'ceco');
    const mesHeader = headers.find(h => normalizeKey(h) === 'mes');
    if(!cecoHeader || !mesHeader) return out;
    const valueHeaders = headers.filter(h => !['ceco','tienda','region','región','mes','año','ano','semana'].includes(normalizeKey(h)));
    for(const row of sheet.rows){
      const ceco = row[cecoHeader];
      if(!ceco) continue;
      for(const vh of valueHeaders){
        const val = toNumber(row[vh]);
        if(val === null) continue;
        out.push({ sourceSheet: sheet.name, Año:this.extractYear(sheet.name), Mes:monthName(row[mesHeader]) || row[mesHeader], Semana:null, CeCo:String(ceco).trim(), KPI:this.canonicalKPI(sheet.name, vh), Valor:val, Tipo:'Mensual', raw:row });
      }
    }
    return out;
  }
}
