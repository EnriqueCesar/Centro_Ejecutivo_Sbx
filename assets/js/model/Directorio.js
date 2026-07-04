import { getByAliases, normalizeKey } from '../utils/Helpers.js';

export class Directorio {
  constructor(sheet){
    this.sheet = sheet;
    this.records = [];
    this.byCeCo = new Map();
    if(sheet) this.load(sheet.rows);
  }
  load(rows){
    this.records = rows.map(r => {
      const ceco = getByAliases(r, ['CeCo','Centro Costo','CC']);
      const record = {
        CeCo: ceco === null ? null : String(ceco).trim(),
        Tienda: getByAliases(r, ['Tienda','Nombre','Store']) || 'Tienda sin nombre',
        Region: getByAliases(r, ['Región','Region']) || 'Región sin Directorio',
        DM: getByAliases(r, ['DM','District Manager']) || null,
        Estado: getByAliases(r, ['Estado','State']) || null,
        Formato: getByAliases(r, ['Formato','Format']) || null,
        raw: r
      };
      return record;
    }).filter(r => r.CeCo && normalizeKey(r.CeCo) !== 'ytd25' && normalizeKey(r.CeCo) !== 'ytd26');
    this.byCeCo = new Map(this.records.map(r => [String(r.CeCo), r]));
  }
  enrich(record){
    const ceco = record.CeCo === null || record.CeCo === undefined ? null : String(record.CeCo).trim();
    const dim = ceco ? this.byCeCo.get(ceco) : null;
    return {
      ...record,
      Tienda: record.Tienda || dim?.Tienda || 'CeCo sin Directorio',
      Region: record.Region || dim?.Region || 'CeCo sin Directorio',
      DM: record.DM || dim?.DM || null,
      Estado: record.Estado || dim?.Estado || null,
      Formato: record.Formato || dim?.Formato || null
    };
  }
  regiones(){ return [...new Set(this.records.map(r => r.Region).filter(Boolean))].sort(); }
}
