# Centro Ejecutivo SBX - v5.6 Ejecutiva PWA

Versión actualizada desde `Centro_Ejecutivo_Sbx.xlsx`.

## Validación ejecutiva
- Tabla ejecutiva por región conectada a `data/kpi-data.json`.
- `ADT 26` proviene de la pestaña `ADT_26`.
- `Ordenes ppto 26` proviene de la pestaña `Ordenes_ppto_26`.
- Periodo validado: Enero a Junio.
- Blancos en `Ordenes_ppto_26`: ignorados; no se convierten en cero ni se marcan como error.

## PWA
Incluye `manifest.json`, `service-worker.js`, `sw.js` de compatibilidad e iconos PNG para instalación.

## Publicación GitHub Pages
Subir el contenido completo del repositorio. La app abre desde `index.html` y carga datos desde `data/kpi-data.json`.
