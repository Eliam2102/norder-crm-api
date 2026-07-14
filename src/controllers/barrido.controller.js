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
const normalizeBarrido = (rawTiempos, rawDistribucion, rawKcalManuales, rawPorcentajesManuales) => {
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

const serializeBarrido = (barrido) => {
    const parsedTiempos = typeof barrido.tiempos === 'string' ? JSON.parse(barrido.tiempos) : barrido.tiempos;
    const parsedDistribucion = typeof barrido.distribucion === 'string' ? JSON.parse(barrido.distribucion) : barrido.distribucion;
    const normalized = normalizeBarrido(
        parsedTiempos,
        parsedDistribucion,
        parsedDistribucion?._kcalManuales,
        parsedDistribucion?._porcentajesManuales
    );
    return {
        ...barrido,
        ...normalized,
        porciones: typeof barrido.porciones === 'string' ? JSON.parse(barrido.porciones) : barrido.porciones
    };
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
        const { tiempos, porciones, distribucion, kcalTotal, kcalManuales, porcentajesManuales } = req.body;
        const normalized = normalizeBarrido(tiempos, distribucion, kcalManuales, porcentajesManuales);

        const barrido = await prisma.barridoEquivalencias.upsert({
            where: { valoracionId },
            update: {
                tiempos: JSON.stringify(normalized.tiempos),
                porciones: JSON.stringify(porciones),
                distribucion: JSON.stringify({
                    ...normalized.distribucion,
                    _kcalManuales: normalized.kcalManuales,
                    _porcentajesManuales: normalized.porcentajesManuales
                }),
                kcalTotal: kcalTotal ?? null
            },
            create: {
                pacienteId,
                valoracionId,
                tiempos: JSON.stringify(normalized.tiempos),
                porciones: JSON.stringify(porciones),
                distribucion: JSON.stringify({
                    ...normalized.distribucion,
                    _kcalManuales: normalized.kcalManuales,
                    _porcentajesManuales: normalized.porcentajesManuales
                }),
                kcalTotal: kcalTotal ?? null
            }
        });

        return ok(res, serializeBarrido(barrido));
    } catch (err) {
        next(err);
    }
};
