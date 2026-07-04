import { detectHeaderRow } from './Helpers.js';

export class ExcelReader {
  constructor(XLSXRef = globalThis.XLSX){
    if(!XLSXRef) throw new Error('SheetJS XLSX no está cargado. Revisa la conexión al CDN.');
    this.XLSX = XLSXRef;
  }
  async fetchArrayBuffer(path){
    const response = await fetch(path, { cache: 'no-store' });
    if(!response.ok) throw new Error(`No se pudo leer el archivo: ${path}`);
    return await response.arrayBuffer();
  }
  async readWorkbook(path){
    const buffer = await this.fetchArrayBuffer(path);
    const wb = this.XLSX.read(buffer, { type: 'array', cellDates: false, raw: true });
    return this.toPlainWorkbook(wb);
  }
  toPlainWorkbook(workbook){
    const sheets = {};
    for(const sheetName of workbook.SheetNames){
      const sheet = workbook.Sheets[sheetName];
      const rows = this.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
      const headerRowIndex = detectHeaderRow(rows);
      const headers = (rows[headerRowIndex] || []).map((h, i) => String(h ?? `Col_${i+1}`).trim() || `Col_${i+1}`);
      const dataRows = rows.slice(headerRowIndex + 1)
        .filter(r => r && r.some(c => c !== null && c !== undefined && c !== ''))
        .map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? null])));
      sheets[sheetName] = { name: sheetName, headerRowIndex, headers, rows: dataRows, rawRows: rows };
    }
    return { sheetNames: workbook.SheetNames, sheets };
  }
}
