# Centro Ejecutivo SBX - Fase 4.2 KPI Dinámico

Esta entrega mantiene la estructura de Fase 4.1 y agrega selector de KPI realmente dinámico.

## Qué cambia

- Lee los KPIs disponibles desde `data/kpi-data.json`.
- Genera las pestañas de KPI automáticamente.
- Al cambiar KPI se actualizan: título, periodo, summary, cards, tabla regional, Top 10, Bottom 10, tendencia, insights y recomendaciones.
- Usa años disponibles del modelo y compara contra el año anterior detectado.
- Respeta el modelo base: una sola pestaña ejecutiva.

## Publicación

Subir el contenido del ZIP a la raíz del repositorio GitHub Pages.

Estructura esperada:

```text
index.html
assets/
data/
manifest.json
sw.js
README.md
```
