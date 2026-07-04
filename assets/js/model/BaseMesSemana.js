import { getByAliases, monthName } from '../utils/Helpers.js';

export class BaseMesSemana {
  constructor(sheet){
    this.sheet = sheet;
    this.bySemana = new Map();
    if(sheet) this.load(sheet.rows);
  }
  load(rows){
    for(const r of rows){
      const semana = getByAliases(r, ['Semana','Week']);
      if(semana === null || semana === undefined || semana === '') continue;
      const mesRaw = getByAliases(r, ['Mes','Month']);
      this.bySemana.set(String(semana).trim(), {
        Semana: Number(semana),
        Mes: monthName(mesRaw) || mesRaw,
        Año: Number(getByAliases(r, ['Año','Ano','Year'])) || null
      });
    }
  }
  enrich(record){
    if(record.Semana === null || record.Semana === undefined) return record;
    const found = this.bySemana.get(String(record.Semana).trim());
    if(!found) return { ...record, Mes: record.Mes || 'Sin Mes asignado', Año: record.Año || null };
    return { ...record, Mes: record.Mes || found.Mes, Año: record.Año || found.Año };
  }
}
