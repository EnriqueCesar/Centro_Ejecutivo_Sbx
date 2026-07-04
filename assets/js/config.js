export const CONFIG = {
  workbookPath: 'data/Centro_Ejecutivo_Sbx.xlsx',
  fallbackJsonPath: 'data/kpi-data.json',
  defaultMonth: 'Jun',
  defaultYear: '2026',
  months: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
  monthAliases: {
    ene:'Ene', enero:'Ene', jan:'Ene', january:'Ene',
    feb:'Feb', febrero:'Feb',
    mar:'Mar', marzo:'Mar',
    abr:'Abr', abril:'Abr', apr:'Abr', april:'Abr',
    may:'May', mayo:'May',
    jun:'Jun', junio:'Jun',
    jul:'Jul', julio:'Jul',
    ago:'Ago', agosto:'Ago', aug:'Ago', august:'Ago',
    sep:'Sep', sept:'Sep', septiembre:'Sep', september:'Sep',
    oct:'Oct', octubre:'Oct', october:'Oct',
    nov:'Nov', noviembre:'Nov', november:'Nov',
    dic:'Dic', diciembre:'Dic', dec:'Dic', december:'Dic'
  },
  kpiAliases: {
    cx: 'Conexión', conexion: 'Conexión', conexión: 'Conexión',
    bebida: 'Bebida', bebidas: 'Bebida', calidadbebidas: 'Bebida',
    tplh: 'TPLH',
    segundascx: 'Segundas Cx', segundas: 'Segundas Cx', segundasconexiones: 'Segundas Cx',
    adt: 'ADT', ordenes: 'ADT', ordenes_ppto: 'ADT'
  },
  systemSheets: ['Directorio','Base_Mes_Semana','Obj_Region_26'],
  currentYear: 2026,
  previousYear: 2025
};
