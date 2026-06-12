# Batch de fixes — Junio 2026

Correcciones de la lista reportada por Eyder. Cubre **norder-crm-api** (backend) y
**norer-health-hub** (frontend); este documento existe en ambos repos.

## 1. Orden de tiempos de comida estable (front + back + PDF)

**Causa raíz**: el backend siempre guardó bien el campo `orden` (re-indexa por posición del
array al crear/actualizar), pero los `GET` no usaban `orderBy: { orden: 'asc' }`, así que
Postgres devolvía menús/tiempos/ingredientes en orden indefinido.

- Backend: `orderBy { orden: 'asc' }` agregado a TODOS los includes de
  `menus → tiemposComida → ingredientes` en `src/controllers/planes.controller.js`
  (getAll, getActivo, getById, update re-read, PDF, asignar) y
  `src/controllers/valoraciones.controller.js` (getById). Portal y agent ya ordenaban.
- Frontend: `CreateEditPlan.tsx` ahora manda `orden` explícito (menú/tiempo/ingrediente)
  en el payload y hace sort defensivo por `orden` al cargar (`mapMenusFromBackend`).

## 2. Orden por default de tiempos de comida

`CreateEditPlan.tsx`: default cambia de `Desayuno, Colación 1, Comida, Colación 2, Cena` a
**`Desayuno, Colación, Almuerzo, Colación, Cena`**. Reordenar ya existía (chevrons ↑/↓ del
encabezado de cada tiempo) y ahora persiste gracias al fix #1.

- El renombre `Comida → Almuerzo` corrige además un mismatch con el barrido de
  equivalencias (que ya usaba "Almuerzo").
- Dos tiempos con el mismo nombre ("Colación") se soportan: el matching plan ↔ barrido
  ahora es por nombre + índice de ocurrencia (`findBarridoTiempoKey`).
- **Limitación resuelta**: el barrido llavea columnas por nombre, dos columnas literales
  "Colación" colisionarían (comparten datos). Default del barrido ahora es `Desayuno,
  Colación, Almuerzo, Colación 2, Cena`; `findBarridoTiempoKey` mapea la 2da "Colación"
  del plan → columna "Colación 2" del barrido (fallback por ocurrencia + nombre alterno).
  - **Nota a futuro**: si Eyder prefiere que ambas columnas digan "Colación" (sin el "2"),
    requiere refactor de `BarridoEquivalencias.tsx` para indexar `distribucion`/`porciones`
    por posición/id en vez de por nombre, + migración de datos JSON ya guardados (formato
    viejo keyado por nombre) + revisar consumo del JSON en agente N8N/PDF. No se hizo por
    riesgo de romper barridos de pacientes activos.

## 3. Colaciones sin bebida por default

El auto-llenado de "Agua natural 500ml" (toggle "Agua natural en todos los tiempos") ya no
aplica a tiempos cuyo nombre contiene "colación" — en los 3 puntos: useEffect, onClick del
toggle y onBlur del campo bebida. Al cargar planes viejos también se limpia el valor en
colaciones.

## 4. Unidades de alimentos en minúsculas

- Frontend (`SmaeIngredientePicker.tsx`): display en minúsculas (label de cantidad, input
  de unidad vía CSS `lowercase`, hints, porciones del catálogo). El estado interno se
  normaliza a MAYÚSCULAS porque la lógica de conversión compara contra `'GR'`.
- Backend (`planes.controller.js`): las unidades se persisten en minúsculas
  (`(unidad || 'gr').toLowerCase()`, `pza → pz` en captura de catálogo), así el PDF las
  imprime en minúsculas automáticamente.

## 5. Títulos de platillos que no aparecían al guardar

**Causa raíz doble**:
1. El nombre del platillo se confirmaba solo `onBlur` del input; si se daba clic en
   Guardar sin salir del campo, el draft se descartaba. Ahora `handleSave` hace *flush* de
   `platilloDrafts` pendientes antes de armar el payload.
2. Los `GET` sin `orderBy` de ingredientes partían/desordenaban los grupos al recargar
   (corregido en #1).

## 6. Botón "Guardar" sticky

- `Platillos.tsx`: el header con Guardar ya era `sticky top-0`, pero el `Card` padre tenía
  `overflow-hidden`, lo que anula `position: sticky`. Se cambió a `overflow-visible`.
- `NewAssessment.tsx`: la barra inferior de navegación/guardado de los pasos 1-2 ahora es
  `sticky bottom-0` — Guardar visible sin regresar el scroll.
- `CreateEditPlan.tsx`: ya era sticky; sin cambios.

## 7. Tonos de letra muy opacos en nueva cita

`CalcomScheduling.tsx`: las 7 etiquetas con `text-[#666]` (casi invisibles sobre fondo
`#111111`) ahora usan el token `text-text-secondary` (#8a8a8a).

## 8. Edición completa de consulta + notas posteriores

- `AssessmentDetail.tsx`: botones **Editar** y **Archivar** en el header de la consulta.
- `NewAssessment.tsx` (modo edición):
  - El paso 3 ahora **edita el plan ya vinculado** a la valoración (`planVinculadoId`) en
    vez de crear un duplicado; el botón dice "Guardar y Editar Plan" cuando aplica.
  - Prefill de Kg Grasa con fallback a `kgGrasa2comp`.
  - Sección "Notas Libres / Seguimiento": se auto-abre si trae contenido y tiene botón
    **"+ Nota con fecha"** que inserta un separador `--- DD/MM/YYYY ---` para registrar
    información que el paciente comparte después de la consulta.

## 9. Eliminar (archivar) consulta — soft delete

- Schema: `Valoracion.deletedAt DateTime?` (migración
  `20260610120000_add_valoracion_deleted_at`).
- Endpoints: `DELETE /api/pacientes/:pid/valoraciones/:id` (archiva),
  `PATCH .../:id/restore` (restaura), `GET .../valoraciones/archivadas` (lista).
- Filtro `deletedAt: null` aplicado en: valoraciones getAll, pacientes (includes),
  planes (última valoración ×3 + historial PDF), dashboard (counts + tendencias).
- Decisiones: `getById` NO filtra (acceso histórico); `numeroValoracion` sigue contando
  archivadas (no se reutilizan números).
- UI: botón "Archivar" con confirmación en perfil del paciente y en el detalle de la
  consulta; sección "Consultas Archivadas" con botón Restaurar.
- ⚠️ **Requiere correr la migración**: `npx prisma migrate dev` en norder-crm-api.

## 10. PDF: lineamientos y notas de consulta en blanco

- `plan.ejs`: el fallback de lineamientos nunca disparaba porque un array vacío es truthy;
  ahora valida `length > 0`.
- "Notas en consulta" ahora cae a los comentarios de la valoración más reciente
  (`notasClinicasRecientes`) si el plan no tiene notas propias.
- `enrichPlanForPdf`: si no hay valoraciones con fecha ≤ a la del plan (p. ej. la
  valoración se creó después), re-consulta sin límite de fecha — temario, notas clínicas y
  "evitar" ya no salen vacíos.

## 11. PDF: "Temario abordado" movido a la primera hoja

Se movió de la página de extras (página 4) a la página 1, después de "Notas en consulta",
con el mismo estilo de lista de esa página. Solo se renderea si hay temario.
- (Aplicado/confirmado en este commit — el cambio no había quedado en `plan.ejs`, el
  temario seguía solo en página 4. Ya está movido y quitado de página 4.)

## 12. PDF: formato consistente de "Abreviaciones"

La tabla se reconstruyó como grid uniforme (5 columnas × 2 filas, una abreviación por
celda, generada desde un array) en lugar de 3 celdas con contenido desbalanceado.
- Estilo de cada celda homologado con la tabla de "Lista de intercambio de alimentos"
  de arriba: la abreviación (ej. `Eq`) en negro/negrita (como nombre de alimento `ic-nm`,
  `#111`/500) y la definición en gris pequeño (como porción `ic-qty`, `#444`/6.8px) —
  antes era al revés (abreviación gris, definición en negro normal).
- La tabla completa ahora reutiliza la clase `.ic-tbl` (mismo borde, padding, line-height
  y título `.ic-title` que la tabla de intercambio); `.ic-abbr` queda solo como modificador
  de `margin-top`. Se eliminó `.abbr-hdr` (ya no se usaba).

## 17. PDF: "Notas Libres / Seguimiento" + auditoría de notas de consulta

Auditoría pedida por Eyder sobre qué de "notas de consulta" se ve en el PDF:
- **"Notas en consulta" (página 1)**: venía SOLO de `plan.notasGenerales` (notas propias
  del plan); si el plan no tenía notas propias mostraba "Ninguna" aunque la valoración sí
  tuviera comentarios/notas libres — el fallback descrito en el fix #10 nunca quedó
  implementado en `plan.ejs`. Corregido: si `notasGenerales` está vacío, cae a
  `plan.notasClinicasRecientes` (comentarios de la valoración).
- **"Notas Libres / Seguimiento" (`Valoracion.notasLibres`)**: NO se mostraba en ningún
  lado del PDF (se guardaba en BD pero `enrichPlanForPdf` ni la seleccionaba). Ahora se
  agrega `notasLibres: true` a ambos `select` de valoraciones recientes en
  `planes.controller.js`, se expone como `plan.notasLibresRecientes`, y `plan.ejs` la
  renderea en **página 1** (debajo de "Notas en consulta", arriba de "Temario abordado"),
  como lista por línea — conserva los separadores `--- DD/MM/YYYY ---`. Solo si tiene
  contenido.
- **"Notas clínicas" (página 4)**: quitada del PDF — quedó redundante, ya que "Notas en
  consulta" (página 1) cae a `plan.notasClinicasRecientes` cuando el plan no tiene notas
  propias. El campo `notasClinicasRecientes` se conserva en `enrichPlanForPdf` solo como
  fuente de ese fallback.
- **Bug**: "Temario abordado" en el PDF mostraba un ítem basura
  `__COMPETENCIA_NOTES__: {"antes":...,"durante":...,"despues":...}` — el temario de la
  valoración guarda las notas de "Competencia" (antes/durante/después) como un ítem
  especial con `tema: '__COMPETENCIA_NOTES__'`, que el frontend (`NewAssessment.tsx`,
  `AssessmentDetail.tsx`) ya filtraba, pero `enrichPlanForPdf` lo incluía tal cual en
  `plan.temarioReciente`. Ahora se filtra ese ítem antes de mapear (los demás ítems de
  temario sí siguen apareciendo, ahora en página 1).
- **"Notas de competencia" (antes/durante/después)**: se parsea ese ítem
  `__COMPETENCIA_NOTES__` por separado → `plan.competenciaReciente`, y se muestra al
  final de la **página 4** (después de "Alimentos a evitar" / estrategia maratón) solo
  si tiene contenido — antes se perdía por completo, ahora vuelve a aparecer pero
  formateado en vez de como JSON crudo.

## 13. Respuestas para Eyder

**¿Puedo duplicar un ejemplo de almuerzo para usarlo en cenas sin hacerlo desde cero?**
Sí, ya existe: en el almuerzo guarda el platillo con el icono de bookmark ("Guardar
platillo"), y en la cena usa el botón **"Importar Alimentos"** — abre tu biblioteca de
platillos y lo importa completo con todos sus alimentos. También puedes gestionar tu
biblioteca en la página **Platillos**.

**¿Puedo reordenar los platillos? Que inicie con desayunos, almuerzos, etc.**
Sí: los chevrons ↑/↓ junto al nombre de cada platillo lo reordenan dentro de su tiempo de
comida, y los chevrons del encabezado de cada tiempo reordenan los tiempos completos
(Desayuno, Almuerzo, Cena…). Con el fix de orden de este batch, el orden ya **persiste**
después de guardar (antes se desordenaba al recargar).

## 14. Documentación del diseño del menú

Ver `docs/menu-design-config.md`: hoy no existe modo "solo tiempos con porciones, sin
diseño"; el doc explica dónde se implementaría (`meta.plantilla: 'simple'`).

## 15. Expediente: lista de fármacos + quitar "Recomendación Suplementos"

- Se quitó el campo de texto "Recomendación Suplementos" del expediente (en consulta) —
  era redundante, esa info ahora vive en el **Esquema de Suplementación**.
- "Fármacos" deja de ser un campo de texto libre y pasa a ser una **lista estructurada**
  (`Antecedentes.farmacosDetalle`, JSON): nombre, tiempo que lo ha tomado, y si lo sigue
  tomando (toggle "¿Sigue?"). Migración `20260610130000_add_farmacos_detalle`. El campo
  de texto legado `farmacos` se conserva en BD; si un paciente trae texto legado y aún no
  tiene `farmacosDetalle`, se precarga como un ítem de la lista al abrir el expediente.
- ~~En el Esquema de Suplementación, los fármacos marcados "lo sigue tomando" aparecen
  como chips de precarga~~ — corregido: el fármaco no es lo mismo que un suplemento, esa
  precarga no debía ser de fármacos.
- Sidebar de creación de plan (`CreateEditPlan.tsx`) muestra la lista de fármacos con su
  tiempo y estado; ya no muestra "Recomendación Suplementos".

## 16. Esquema de Suplementación: precarga desde "Suplementos del Registro" + fix duplicados

- En la consulta, "Esquema de Suplementación" ahora muestra chips de **"Suplementos del
  expediente (que ha tomado)"** — vienen de `Antecedentes.suplementosDetalle` (lo que
  Eyder capturó en el perfil del paciente sobre suplementos previos/actuales).
- Un clic agrega ese suplemento al esquema de la consulta (continuar). Si ya está en el
  esquema (por nombre, incluye los heredados automáticamente en 1ra consulta) o ya se
  agregó en esta sesión, el chip se muestra bloqueado con check — **ya no se puede
  duplicar a base de clics repetidos** (bug reportado: clic 1000 veces agregaba 1000
  copias).
- También se muestra "Historial Suplementos" (`historialProductos`, texto libre) en el
  perfil del paciente, sección Suplementación y Notas.
- Fármacos NO alimentan el esquema de suplementación (son cosas distintas) — la lista de
  fármacos del expediente queda solo como dato clínico informativo.

---

## Pendiente para activar todo

```bash
cd norder-crm-api
npx prisma generate   # regenerar cliente con farmacosDetalle (migración ya aplicada)
```
