import prisma from '../lib/prisma.js';
import { ok } from '../utils/response.js';

export const get = async (req, res, next) => {
    try {
        const { valoracionId } = req.params;

        const barrido = await prisma.barridoEquivalencias.findUnique({
            where: { valoracionId }
        });

        if (!barrido) return ok(res, null);

        return ok(res, {
            ...barrido,
            tiempos: JSON.parse(barrido.tiempos),
            porciones: JSON.parse(barrido.porciones),
            distribucion: JSON.parse(barrido.distribucion)
        });
    } catch (err) {
        next(err);
    }
};

export const upsert = async (req, res, next) => {
    try {
        const { pacienteId, valoracionId } = req.params;
        const { tiempos, porciones, distribucion, kcalTotal } = req.body;

        const barrido = await prisma.barridoEquivalencias.upsert({
            where: { valoracionId },
            update: {
                tiempos: JSON.stringify(tiempos),
                porciones: JSON.stringify(porciones),
                distribucion: JSON.stringify(distribucion),
                kcalTotal: kcalTotal ?? null
            },
            create: {
                pacienteId,
                valoracionId,
                tiempos: JSON.stringify(tiempos),
                porciones: JSON.stringify(porciones),
                distribucion: JSON.stringify(distribucion),
                kcalTotal: kcalTotal ?? null
            }
        });

        return ok(res, {
            ...barrido,
            tiempos: JSON.parse(barrido.tiempos),
            porciones: JSON.parse(barrido.porciones),
            distribucion: JSON.parse(barrido.distribucion)
        });
    } catch (err) {
        next(err);
    }
};
