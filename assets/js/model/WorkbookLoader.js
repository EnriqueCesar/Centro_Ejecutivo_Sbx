import { CONFIG } from '../config.js';
import { ExcelReader } from '../utils/ExcelReader.js';

export class WorkbookLoader {
  constructor(path = CONFIG.workbookPath){
    this.path = path;
    this.reader = new ExcelReader();
  }
  async load(){
    return await this.reader.readWorkbook(this.path);
  }
}
