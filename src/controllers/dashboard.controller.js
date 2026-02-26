import prisma from '../lib/prisma.js';
import { ok } from '../utils/response.js';

export const getMetricas = async (req, res, next) => {
    try {
        const ahora = new Date();
        const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);

        const [
            totalPacientes,
            nuevosEsteMes,
            valoracionesEsteMes,
            revisionesEsteMes,
            planesPendientes
        ] = await Promise.all([
            prisma.paciente.count(),
            prisma.paciente.count({ where: { fechaRegistro: { gte: inicioMes } } }),
            prisma.valoracion.count({ where: { createdAt: { gte: inicioMes } } }),
            prisma.revision.count({ where: { createdAt: { gte: inicioMes } } }),
            prisma.plan.count({ where: { estadoEnvio: 'pendiente' } })
        ]);

        const consultasEsteMes = valoracionesEsteMes + revisionesEsteMes;

        return ok(res, {
            totalPacientes,
            nuevosEsteMes,
            consultasEsteMes,
            planesPendientes
        });
    } catch (err) {
        next(err);
    }
};

export const getAlertas = async (req, res, next) => {
    try {
        const hace30Dias = new Date();
        hace30Dias.setDate(hace30Dias.getDate() - 30);

        // Pacientes cuya última valoración fue hace más de 30 días
        const pacientes = await prisma.paciente.findMany({
            include: {
                valoraciones: {
                    orderBy: { fecha: 'desc' },
                    take: 1
                }
            }
        });

        const ahora = new Date();
        const alertas = pacientes
            .map(p => {
                const ultimaV = p.valoraciones[0];
                if (!ultimaV) return { ...p, diasSinVisita: 999 }; // Nunca ha venido
                
                const diffTime = Math.abs(ahora - new Date(ultimaV.fecha));
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                return { ...p, diasSinVisita: diffDays };
            })
            .filter(p => p.diasSinVisita > 30)
            .sort((a, b) => b.diasSinVisita - a.diasSinVisita);

        return ok(res, alertas);
    } catch (err) {
        next(err);
    }
};
