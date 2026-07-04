import { monthName, normalizeKey, toNumber } from '../utils/Helpers.js';

export class Objetivos {
  constructor(sheet){
    this.sheet = sheet;
    this.byMonthKpi = new Map();
    this.kpis = [];
    if(sheet) this.load(sheet);
  }
  load(sheet){
    const headers = sheet.headers.filter(h => normalizeKey(h) !== 'mes');
    this.kpis = headers;
    for(const row of sheet.rows){
      const mesHeader = Object.keys(row).find(k => normalizeKey(k) === 'mes');
      const mes = monthName(row[mesHeader]) || row[mesHeader];
      if(!mes) continue;
      for(const kpi of headers){
        const value = toNumber(row[kpi]);
        if(value !== null) this.byMonthKpi.set(`${mes}::${normalizeKey(kpi)}`, value);
      }
    }
  }
  get(mes, kpi){
    const key = `${monthName(mes) || mes}::${normalizeKey(kpi)}`;
    return this.byMonthKpi.has(key) ? this.byMonthKpi.get(key) : null;
  }
  enrich(record){
    const meta = this.get(record.Mes, record.KPI);
    const variacion = meta === null || record.Valor === null ? null : record.Valor - meta;
    const cumplimiento = meta === null || !meta || record.Valor === null ? null : record.Valor / meta;
    return { ...record, Meta: meta, VariacionMeta: variacion, Cumplimiento: cumplimiento };
  }
}
