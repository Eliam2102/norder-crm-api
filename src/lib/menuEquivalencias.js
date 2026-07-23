const GROUP_LABELS = {
    verduras: 'Verduras',
    frutas: 'Frutas',
    cerealSinGr: 'C y T sin grasa',
    cerealConGr: 'C y T con grasa',
    leguminosas: 'Leguminosas',
    aoaMuyBajo: 'AOA muy bajo',
    aoaBajo: 'AOA bajo',
    aoaModerado: 'AOA moderado',
    aoaAlto: 'AOA alto',
    lecheDesc: 'Leche descremada',
    lecheSemi: 'Leche semidescremada',
    lecheEntera: 'Leche entera',
    lecheAz: 'Leche azucarada',
    grasaSinProt: 'A y G sin proteína',
    grasaConProt: 'A y G con proteína',
    azSinGr: 'Az sin grasa',
    azConGr: 'Az con grasa'
};

const asObject = (value) => {
    if (!value) return {};
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }
    return typeof value === 'object' ? value : {};
};

const asArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
};

const positiveEquivalences = (source) => Object.entries(asObject(source))
    .map(([grupo, cantidad]) => ({
        grupo: GROUP_LABELS[grupo] || grupo,
        cantidad: Number(String(cantidad).replace(',', '.'))
    }))
    .filter(item => Number.isFinite(item.cantidad) && item.cantidad > 0);

const virtualIngredients = (source) => positiveEquivalences(source).map((eq, index) => ({
    id: `equivalencia-${index}`,
    descripcion: '',
    cantidad: 0,
    unidad: '-',
    eqCantidad: eq.cantidad,
    eqGrupo: eq.grupo,
    equivalencias: [eq],
    platillo: '',
    orden: index + 1
}));

const normalizeTimes = (rawTimes) => {
    return asArray(rawTimes).map((time, index) => {
        if (time && typeof time === 'object') {
            return {
                id: String(time.id || `menu-tiempo-${index + 1}`),
                nombre: String(time.nombre || time.label || `Tiempo ${index + 1}`)
            };
        }
        return {
            id: `menu-tiempo-${index + 1}`,
            nombre: String(time || `Tiempo ${index + 1}`)
        };
    });
};

/**
 * Compatibilidad para planes creados antes de que cada menú guardara su propio
 * barrido. Si un menú no tiene ningún ingrediente y la valoración asociada sí
 * tiene barrido, lo usa únicamente para la representación del PDF.
 */
export const attachLegacyBarridoToEmptyMenus = (plan, legacyBarrido) => {
    if (!Array.isArray(plan?.menus) || !legacyBarrido) return plan;

    const snapshot = {
        version: 2,
        tiempos: asArray(legacyBarrido.tiempos),
        porciones: asObject(legacyBarrido.porciones),
        distribucion: asObject(legacyBarrido.distribucion),
        kcalTotal: Number(legacyBarrido.kcalTotal) || 0
    };

    if (snapshot.tiempos.length === 0 && Object.keys(snapshot.porciones).length === 0) return plan;

    plan.menus = plan.menus.map(menu => {
        if (menu.barridoEquivalencias) return menu;
        const tiempos = Array.isArray(menu.tiemposComida) ? menu.tiemposComida : [];
        const hasIngredients = tiempos.some(time =>
            Array.isArray(time.ingredientes) && time.ingredientes.length > 0
        );
        if (hasIngredients) return menu;

        return {
            ...menu,
            tipoContenido: 'equivalencias',
            barridoEquivalencias: snapshot
        };
    });

    return plan;
};

/**
 * Para el PDF, convierte el snapshot de barrido de cada menú marcado como
 * "equivalencias" en ingredientes virtuales. No modifica los platillos guardados:
 * únicamente reemplaza la representación en memoria que recibe la plantilla.
 */
export const materializeMenuEquivalences = (plan) => {
    if (!Array.isArray(plan?.menus)) return plan;

    plan.menus = plan.menus.map(menu => {
        if (menu.tipoContenido !== 'equivalencias') return menu;

        const barrido = asObject(menu.barridoEquivalencias);
        const tiempos = normalizeTimes(barrido.tiempos);
        const distribucion = asObject(barrido.distribucion);
        const porciones = asObject(barrido.porciones);
        const hasDistribution = tiempos.some(time => virtualIngredients(distribucion[time.id]).length > 0);
        const existingTimes = Array.isArray(menu.tiemposComida) ? menu.tiemposComida : [];

        if (!hasDistribution && virtualIngredients(porciones).length > 0) {
            const existing = existingTimes[0] || {};
            return {
                ...menu,
                tiemposComida: [{
                    ...existing,
                    nombre: 'Porciones del día',
                    barridoTiempoId: null,
                    orden: 1,
                    ingredientes: virtualIngredients(porciones)
                }]
            };
        }

        return {
            ...menu,
            tiemposComida: tiempos.map((time, index) => {
                const existing = existingTimes.find(item => item.barridoTiempoId === time.id)
                    || existingTimes[index]
                    || {};
                return {
                    ...existing,
                    nombre: time.nombre,
                    barridoTiempoId: time.id,
                    orden: index + 1,
                    ingredientes: virtualIngredients(distribucion[time.id])
                };
            })
        };
    });

    return plan;
};

export { GROUP_LABELS };
