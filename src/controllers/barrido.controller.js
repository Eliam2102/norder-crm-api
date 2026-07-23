import prisma from '../lib/prisma.js';
import { ok } from '../utils/response.js';

const normalizeColacionLabel = (value = '') => {
    const label = String(value).trim();
    return /^colaci[oó]n\s+\d+$/i.test(label) ? 'Colación' : label;
};

const legacyTiempoId = (index) => `legacy-tiempo-${index + 1}`;

/**
 * Convierte el barrido histórico (tiempos como strings y distribución por nombre)
 * al formato v2 (tiempos con ID y distribución por ID). La conversión es también
 * defensiva para clientes que todavía envíen el formato anterior.
 */
export const normalizeBarrido = (rawTiempos, rawDistribucion, rawKcalManuales, rawPorcentajesManuales) => {
    const sourceTiempos = Array.isArray(rawTiempos) ? rawTiempos : [];
    const sourceDistribucion = rawDistribucion && typeof rawDistribucion === 'object' ? rawDistribucion : {};
    const sourceKcal = rawKcalManuales && typeof rawKcalManuales === 'object' ? rawKcalManuales : {};
    const sourcePct = rawPorcentajesManuales && typeof rawPorcentajesManuales === 'object'
        ? rawPorcentajesManuales
        : (sourceDistribucion._porcentajesManuales || {});

    const tiempos = sourceTiempos.map((tiempo, index) => {
        if (tiempo && typeof tiempo === 'object') {
            return {
                id: String(tiempo.id || legacyTiempoId(index)),
                nombre: normalizeColacionLabel(tiempo.nombre || tiempo.label || `Tiempo ${index + 1}`)
            };
        }
        return {
            id: legacyTiempoId(index),
            nombre: normalizeColacionLabel(tiempo || `Tiempo ${index + 1}`)
        };
    });

    const distribucion = {};
    const kcalManuales = {};
    const porcentajesManuales = {};

    tiempos.forEach((tiempo, index) => {
        const original = sourceTiempos[index];
        const oldKey = original && typeof original === 'object'
            ? String(original.id || original.nombre || original.label || '')
            : String(original || '');
        distribucion[tiempo.id] = sourceDistribucion[tiempo.id] || sourceDistribucion[oldKey] || {};

        const kcal = sourceKcal[tiempo.id] ?? sourceKcal[oldKey];
        if (kcal != null) kcalManuales[tiempo.id] = kcal;

        const pct = sourcePct[tiempo.id] ?? sourcePct[oldKey];
        if (pct != null && pct !== '') porcentajesManuales[tiempo.id] = pct;
    });

    return { version: 2, tiempos, distribucion, kcalManuales, porcentajesManuales };
};

export const serializeBarrido = (barrido) => {
    const parsedTiempos = typeof barrido.tiempos === 'string' ? JSON.parse(barrido.tiempos) : barrido.tiempos;
    const parsedDistribucion = typeof barrido.distribucion === 'string' ? JSON.parse(barrido.distribucion) : barrido.distribucion;
    const normalized = normalizeBarrido(
        parsedTiempos,
        parsedDistribucion,
        parsedDistribucion?._kcalManuales,
        parsedDistribucion?._porcentajesManuales
    );
    const porciones = typeof barrido.porciones === 'string' ? JSON.parse(barrido.porciones) : barrido.porciones;
    const principal = {
        ...barrido,
        ...normalized,
        porciones
    };
    const storedVariants = Array.isArray(parsedDistribucion?._variantes)
        ? parsedDistribucion._variantes
        : [];
    const variantes = [
        {
            ...principal,
            id: 'principal',
            nombre: 'Barrido 1'
        },
        ...storedVariants.map((variant, index) => ({
            id: String(variant.id || `barrido-${index + 2}`),
            nombre: String(variant.nombre || `Barrido ${index + 2}`),
            ...normalizeBarrido(
                variant.tiempos,
                variant.distribucion,
                variant.kcalManuales,
                variant.porcentajesManuales
            ),
            porciones: variant.porciones || {},
            kcalTotal: Number(variant.kcalTotal) || 0,
            energiaTotalManual: variant.energiaTotalManual ?? null,
            isValid: variant.isValid
        }))
    ];
    return { ...principal, variantes };
};

export const buildBarridoPersistenceData = (body = {}) => {
    const {
        tiempos,
        porciones,
        distribucion,
        kcalTotal,
        kcalManuales,
        porcentajesManuales,
        variantes
    } = body;
    const requestedVariants = Array.isArray(variantes) && variantes.length > 0 ? variantes : null;
    const primarySource = requestedVariants?.[0] || body;
    const normalized = normalizeBarrido(
        primarySource.tiempos ?? tiempos,
        primarySource.distribucion ?? distribucion,
        primarySource.kcalManuales ?? kcalManuales,
        primarySource.porcentajesManuales ?? porcentajesManuales
    );
    const primaryPorciones = primarySource.porciones ?? porciones ?? {};
    const primaryKcal = primarySource.kcalTotal ?? kcalTotal ?? null;
    const extraVariants = (requestedVariants || []).slice(1).map((variant, index) => {
        const normalizedVariant = normalizeBarrido(
            variant.tiempos,
            variant.distribucion,
            variant.kcalManuales,
            variant.porcentajesManuales
        );
        return {
            id: String(variant.id || `barrido-${index + 2}`),
            nombre: String(variant.nombre || `Barrido ${index + 2}`),
            ...normalizedVariant,
            porciones: variant.porciones || {},
            kcalTotal: Number(variant.kcalTotal) || 0,
            energiaTotalManual: variant.energiaTotalManual ?? null,
            isValid: variant.isValid
        };
    });
    return { normalized, primaryPorciones, primaryKcal, extraVariants };
};

export const get = async (req, res, next) => {
    try {
        const { valoracionId } = req.params;

        const barrido = await prisma.barridoEquivalencias.findUnique({
            where: { valoracionId }
        });

        if (!barrido) return ok(res, null);

        return ok(res, serializeBarrido(barrido));
    } catch (err) {
        next(err);
    }
};

export const upsert = async (req, res, next) => {
    try {
        const { pacienteId, valoracionId } = req.params;
        const { normalized, primaryPorciones, primaryKcal, extraVariants } =
            buildBarridoPersistenceData(req.body);

        const barrido = await prisma.barridoEquivalencias.upsert({
            where: { valoracionId },
            update: {
                tiempos: JSON.stringify(normalized.tiempos),
                porciones: JSON.stringify(primaryPorciones),
                distribucion: JSON.stringify({
                    ...normalized.distribucion,
                    _kcalManuales: normalized.kcalManuales,
                    _porcentajesManuales: normalized.porcentajesManuales,
                    _variantes: extraVariants
                }),
                kcalTotal: primaryKcal
            },
            create: {
                pacienteId,
                valoracionId,
                tiempos: JSON.stringify(normalized.tiempos),
                porciones: JSON.stringify(primaryPorciones),
                distribucion: JSON.stringify({
                    ...normalized.distribucion,
                    _kcalManuales: normalized.kcalManuales,
                    _porcentajesManuales: normalized.porcentajesManuales,
                    _variantes: extraVariants
                }),
                kcalTotal: primaryKcal
            }
        });

        return ok(res, serializeBarrido(barrido));
    } catch (err) {
        next(err);
    }
};
