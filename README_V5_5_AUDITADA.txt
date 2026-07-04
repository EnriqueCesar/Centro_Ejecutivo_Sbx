Centro Ejecutivo SBX v5.5 PRODUCTION READY AUDITADA

Corrección aplicada:
- La función num() ya no interpreta null, undefined ni cadenas vacías como 0.
- La Tendencia Dinámica calcula Real sólo con meses que tienen captura válida.
- Los meses futuros sin dato real quedan como null y no muestran punto, línea ni etiqueta.
- Meta y AA continúan proyectadas cuando tienen datos.
- Los botones de series se conservan; el eje Y se calcula sólo con las series visibles.
- Excel actualizado integrado en data/Centro_Ejecutivo_Sbx.xlsx.
- kpi-data.json regenerado desde el Excel actualizado.
- .nojekyll incluido para GitHub Pages.

Alcance controlado:
No se modificaron tarjetas KPI, tabla ejecutiva, insights, filtros generales ni Top/Bottom salvo la corrección necesaria para evitar ceros artificiales desde celdas vacías.
