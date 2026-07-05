# Centro Ejecutivo SBX - v5.7 Ejecutiva PWA

Versión actualizada desde `Centro_Ejecutivo_Sbx.xlsx`.

## Ajuste aplicado
- `ADT 26` proviene exclusivamente de la pestaña `ADT_26`.
- `Ordenes ppto 26` proviene exclusivamente de la pestaña `Ordenes_ppto_26`.
- En vista mensual, `Ordenes ppto 26` usa el mes seleccionado desde `Ordenes_ppto_26`.
- En vista Todos/YTD, `Ordenes ppto 26` usa `YTD_26` si existe; si está vacío, promedia sólo meses válidos.
- Las celdas blancas en `Ordenes_ppto_26` se omiten como `null`; no se convierten en cero.
- La Tabla Ejecutiva por Región conserva `ADT 26`, `Ordenes ppto 26`, `ADT 25`, `DIF AA` y semáforo contra presupuesto.

## PWA
Incluye `manifest.json`, `service-worker.js`, `sw.js` de compatibilidad e iconos PNG para instalación.

## Publicación GitHub Pages
Subir el contenido completo del repositorio. La app abre desde `index.html` y carga datos desde `data/kpi-data.json`.
