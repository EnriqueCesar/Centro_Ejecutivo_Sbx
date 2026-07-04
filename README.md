# Centro Ejecutivo SBX - Fase 4

Versión lista para GitHub Pages con una sola pestaña dinámica tipo dashboard ejecutivo.

## Qué incluye

- Una sola vista Centro Ejecutivo dinámica.
- Selector de KPI, Mes, Región y Año.
- Executive Summary dinámico.
- KPI Cards estilo tablero ejecutivo.
- Executive Score.
- Desempeño por región YTD.
- Top 10 y Bottom 10 dinámicos.
- Tendencia mensual Real vs Meta vs AA.
- Mapa ejecutivo por región como filtro.
- Insights automáticos.
- Recomendaciones automáticas.
- Drill Down por región mediante clic.
- Modo Ejecutivo / Modo Analista.
- Exportación a PDF usando imprimir del navegador.
- PWA compatible con GitHub Pages.

## Estructura

```text
Centro_Ejecutivo_Sbx_Fase4/
  index.html
  manifest.json
  sw.js
  .nojekyll
  assets/
    css/styles.css
    js/app.js
    js/model/
    js/utils/
    img/centro-ejecutivo-logo.jpg
  data/
    kpi-data.json
    Centro_Ejecutivo_Sbx.xlsx
```

## Publicar en GitHub Pages

1. Descomprime el ZIP.
2. Sube el contenido a tu repositorio.
3. En GitHub, entra a Settings > Pages.
4. Selecciona Branch `main` y folder `/root`.
5. Abre la URL publicada.

## Ajustar datos

La app consume `data/kpi-data.json`. El archivo Excel queda incluido como fuente de referencia en `data/Centro_Ejecutivo_Sbx.xlsx`.

## Nota de diseño

La fase 4 toma como inspiración los ejemplos compartidos, pero mantiene una sola pestaña dinámica. Al cambiar el KPI, se actualizan título, tarjetas, tabla regional, rankings, tendencia, insights, recomendaciones y mapa.


## Correccion urgente

Si GitHub muestra texto como `export class Router`, significa que el archivo `index.html` del repositorio fue reemplazado por un JS. Borra el contenido del repositorio y sube TODO el contenido de este ZIP en la raiz, dejando `index.html` en la raiz junto a `assets/`, `data/`, `manifest.json` y `sw.js`.
