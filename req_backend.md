# Requisitos Actualizados para Backend (PDF Reporte)

El frontend requiere que la data inyectada a la plantilla de PDF desde el backend (`planes.controller.js`) envíe las propiedades dinámicas de cada valoración. 

### Ajustes Implementados:
1. **Deduplicación por Fechas**: En el `enrichPlanForPdf`, el backend ahora agrupa las valoraciones recuperadas limitando a "la última captura por día" (comparando `YYYY-MM-DD`). Evita columnas duplicadas si hubo 2 guardados el mismo día.
2. **Propiedad `objetivo`**: En el bloque de `select` de `valoraciones`, ahora se trae `paciente: { select: { datosEjercicio: { select: { objetivo: true } } } }`. 
3. Se enriquece la iteración: `v.objetivo = v.paciente?.datosEjercicio?.objetivo || ""`.

### Ajustes en Plantilla EJS (`plan.ejs`):
1. El campo **Objetivo** en la cabecera de la tabla utiliza dinámicamente el `c.objetivo` de cada registro. Ya no dice `"Estético"` como hardcode.
2. El campo **Talla** se imprime de `c.estatura`. Ya no hay fallback a la talla del paciente. Si la valoración "X" no le midieron la talla, quedará en blanco para esa columna.
3. El campo **Somatotipo** utilizará `c.somatotipo`. Si ese cálculo no fue procesado (vacío), la columna quedará también en blanco, quitando el placeholder rancio de `"Ecto balanceado"`.

**Ya implementé todo esto en tus controladores de backend y tus plantillas EJS localmente**. 
El backend sí lo maneja ahora completamente.
