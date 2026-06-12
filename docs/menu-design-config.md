# Configuración del diseño del menú (PDF del plan)

## Dónde se genera el PDF

- **Template**: `src/templates/plan.ejs` (HTML + EJS, una sola plantilla para todo el documento).
- **Servicio de render**: `src/services/pdf.service.js` (convierte el HTML a PDF).
- **Datos**: `enrichPlanForPdf()` en `src/controllers/planes.controller.js` arma el objeto `plan` (historial, lineamientos, temario, notas, abreviaciones, etc.) antes de renderear.

## Flags de configuración existentes

El endpoint `PUT /api/planes/:id/pdf-meta` guarda metadatos que el template consume:

| Flag | Efecto |
|------|--------|
| `showHistorial` | Muestra/oculta la página 1 (historial + lineamientos + notas + temario) |
| `showMenus` | Muestra/oculta la página de menús |
| `showExtras` | Muestra/oculta la página de extras (suplementación, hidratación, evitar, notas clínicas) |
| `meta.lineamientos` | Lista de lineamientos personalizada (si el plan no trae propios) |
| `meta.notaAmarilla` | Nota destacada en amarillo en página 1 |
| `meta.showContacto` | Muestra/oculta el bloque de contacto |
| `meta.estrategiaMaraton` | Bloque opcional de estrategia deportiva |

## ¿Se puede quitar el "diseño" y dejar solo tiempos de comida con porciones?

**Hoy NO existe esa configuración.** El menú siempre se renderea con el diseño completo
(grid de dos menús lado a lado, colores, encabezados estilizados) definido en la sección
"PAGE: MENUS" de `plan.ejs`.

### Dónde se implementaría si se requiere

Opción recomendada: un flag `meta.plantilla: 'simple'` guardado vía `pdf-meta`:

1. `src/controllers/planes.controller.js` → `enrichPlanForPdf()` pasa `meta` al template (ya ocurre).
2. `src/templates/plan.ejs` → en la sección de menús, envolver el render actual en
   `<% if (meta.plantilla !== 'simple') { %> ... diseño actual ... <% } else { %> ... lista plana
   tiempo → alimento + porción ... <% } %>`.
3. Frontend: un toggle en la pantalla de preparación de envío del plan que persista el flag
   con `PUT /api/planes/:id/pdf-meta`.

Alternativa: un segundo template `plan-simple.ejs` y selección de template en
`pdf.service.js` según el flag. Más limpio si el diseño simple diverge mucho.
