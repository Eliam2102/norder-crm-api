// Mismo diccionario que Frontend/norer-health-hub/src/components/SmaeIngredientePicker.tsx:8-26.
// Duplicado intencionalmente (no hay paquete compartido entre API y Frontend); cambia poco.
const GRUPO_LABELS = {
    verduras: 'Verduras',
    frutas: 'Frutas',
    cerealSinGr: 'Cereal s/grasa',
    cerealConGr: 'Cereal c/grasa',
    leguminosas: 'Leguminosas',
    aoaMuyBajo: 'AOA Muy Bajo',
    aoaBajo: 'AOA Bajo',
    aoaModerado: 'AOA Moderado',
    aoaAlto: 'AOA Alto',
    lecheDesc: 'Leche Descrem.',
    lecheSemi: 'Leche Semi',
    lecheEntera: 'Leche Entera',
    lecheAz: 'Leche Azucarada',
    grasaSinProt: 'Grasa s/prot',
    grasaConProt: 'Grasa c/prot',
    azSinGr: 'Azúcar s/grasa',
    azConGr: 'Azúcar c/grasa',
};

export const normalizarNombre = (str) =>
    String(str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Mismo mapeo que Frontend/norer-health-hub/src/components/SmaeIngredientePicker.tsx (unidadBaseToCode):
// 'GR' es el c\u00f3digo hist\u00f3rico para "unidad ancla en gramos" (la mayor\u00eda del cat\u00e1logo). Alimentos con
// otra unidad base (ml, pz, serv...) usan ese c\u00f3digo en may\u00fasculas como su propio ancla.
const unidadBaseToCode = (base) => {
    const b = String(base || 'g').trim().toLowerCase();
    return b === 'g' ? 'GR' : b.toUpperCase();
};

// Función pura y síncrona: no hace queries. byId/byNombre se construyen una sola vez
// afuera (ver resolverPlatillos en platillos.controller.js) y se reutilizan para todos
// los ingredientes de todos los platillos, evitando N+1 queries.
export const resolveIngredienteContraSmae = (ing, byId, byNombre) => {
    let match = null;
    let healedId = null;

    if (ing.alimentoSmaeId && byId.has(ing.alimentoSmaeId)) {
        match = byId.get(ing.alimentoSmaeId);
    } else {
        const candidatos = byNombre.get(normalizarNombre(ing.descripcion)) || [];
        if (candidatos.length === 1) {
            match = candidatos[0];
            healedId = match.id;
        }
        // 0 o 2+ candidatos: no se resuelve, se deja el ingrediente tal cual.
    }

    if (!match) {
        return { ingrediente: ing, healedId: null };
    }

    const nuevoAncla = match.pesoGramos;
    const grupoLabel = GRUPO_LABELS[match.grupo] || match.grupo;

    // Mantener fijo el número de Eq guardado y recalcular la cantidad con el ancla actual
    // (mismo criterio que SmaeIngredientePicker.tsx:160-186).
    const anchorUnit = unidadBaseToCode(match.unidadBase);
    const storedEq = Number(ing.eqCantidad) || 0;
    const originalUpper = String(ing.unidad || anchorUnit).toUpperCase();

    // Corrección de etiqueta legacy: antes de este fix, la unidad ancla siempre se
    // guardaba como 'GR' aunque el alimento tuviera otra unidad base (ej. 'ml'). Si el
    // ingrediente quedó marcado 'GR' pero el alimento no tiene porción casera en 'gr'
    // (es decir, 'GR' no puede ser una porción casera legítima), es un residuo del bug:
    // se relabela a la unidad ancla real del catálogo.
    const staleGR = originalUpper === 'GR' && anchorUnit !== 'GR' &&
        String(match.unidadPorcion || '').toUpperCase() !== 'GR';

    let cantidad = ing.cantidad;
    let unidad = ing.unidad; // por defecto, preservar tal cual (respeta mayúsc/minúsc originales)

    if (staleGR) {
        unidad = anchorUnit;
    }
    if (storedEq > 0 && nuevoAncla > 0 && (staleGR || originalUpper === anchorUnit)) {
        cantidad = parseFloat((storedEq * nuevoAncla).toFixed(1));
        unidad = anchorUnit;
    }

    // Reemplazar solo el grupo del primer elemento de equivalencias (el "base" generado
    // por handleSelect), preservando cualquier equivalencia extra multi-grupo tal cual.
    const equivalencias = Array.isArray(ing.equivalencias) && ing.equivalencias.length > 0
        ? [{ ...ing.equivalencias[0], grupo: grupoLabel }, ...ing.equivalencias.slice(1)]
        : ing.equivalencias;

    const ingredienteResuelto = {
        ...ing,
        descripcion: match.nombre,
        smaeGrPorEq: nuevoAncla,
        eqGrupo: ing.eqGrupo ? grupoLabel : ing.eqGrupo,
        cantidad,
        unidad,
        equivalencias,
        alimentoSmaeId: match.id,
    };

    return { ingrediente: ingredienteResuelto, healedId: healedId ? match.id : null };
};
