import prisma from '../lib/prisma.js';
import { ok } from '../utils/response.js';

export const getMetricas = async (req, res, next) => {
    try {
        // Force no-cache to avoid 304 issues reported
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        
        const ahora = new Date();
        const hace30d = new Date();
        hace30d.setDate(hace30d.getDate() - 30);

        // 1. Data Retrieval
        const [
            pacientesTotales,
            pacientesNuevos,
            planesNutricionales,
            consultasTotales,
            config,
            basica,
            premium,
            distribucionObjetivos
        ] = await Promise.all([
            prisma.paciente.count(),
            prisma.paciente.count({ where: { fechaRegistro: { gte: hace30d } } }),
            prisma.plan.count(),
            prisma.valoracion.count(),
            prisma.configuracion.findUnique({ where: { id: 'singleton' } }),
            prisma.paciente.count({ where: { nivelMembresia: 'basica' } }),
            prisma.paciente.count({ where: { nivelMembresia: 'premium' } }),
            prisma.datosEjercicio.groupBy({
                by: ['objetivo'],
                _count: { objetivo: true },
                where: { objetivo: { not: null } }
            })
        ]);

        const objetivos = distribucionObjetivos.map(o => ({
            nombre: o.objetivo,
            cantidad: o._count.objetivo
        }));

        // 2. Tendencia Maestre (Last 6 Months)
        const mesesTrend = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(ahora.getFullYear(), ahora.getMonth() - i, 1);
            const mNombre = d.toLocaleString('es-ES', { month: 'short' }).toUpperCase();
            mesesTrend.push({
                nombre: mNombre,
                inicio: d,
                fin: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
            });
        }

        const tendenciaMaestre = await Promise.all(mesesTrend.map(async (m) => {
            const [p, v, pl] = await Promise.all([
                prisma.paciente.count({ where: { fechaRegistro: { gte: m.inicio, lte: m.fin } } }),
                prisma.valoracion.count({ where: { createdAt: { gte: m.inicio, lte: m.fin } } }),
                prisma.plan.count({ where: { fechaCreacion: { gte: m.inicio, lte: m.fin } } })
            ]);
            return { mes: m.nombre, pacientes: p, consultas: v, planes: pl };
        }));

        // 3. Clinical Analysis & KPIs
        const pacientes = await prisma.paciente.findMany({
            include: {
                antecedentes: { select: { patologia: true } },
                valoraciones: {
                    orderBy: { fecha: 'desc' },
                    take: 1,
                    select: { 
                        fecha: true, 
                        deficitMusculo: true,
                        pctGrasaCorp: true
                    }
                }
            }
        });

        let conSeguimiento = 0;
        let riesgoAbandono = 0;
        let riesgoClinico = 0;
        let sumGrasa = 0;
        let countGrasa = 0;

        pacientes.forEach(p => {
            if (p.valoraciones.length > 1) conSeguimiento++;
            
            const ultV = p.valoraciones[0];
            if (ultV) {
                const diffDays = Math.floor(Math.abs(ahora - new Date(ultV.fecha)) / (1000 * 60 * 60 * 24));
                if (diffDays > 45) riesgoAbandono++;

                const hasPat = p.antecedentes?.patologia && p.antecedentes.patologia.toLowerCase() !== 'ninguna' && p.antecedentes.patologia.trim() !== '';
                if (hasPat && Number(ultV.deficitMusculo || 0) > 3) riesgoClinico++;

                if (ultV.pctGrasaCorp) {
                    sumGrasa += Number(ultV.pctGrasaCorp);
                    countGrasa++;
                }
            }
        });

        const tasaRetencion = pacientesTotales > 0 ? (conSeguimiento / pacientesTotales) * 100 : 0;
        const conversionMembresia = pacientesTotales > 0 ? ((basica + premium) / pacientesTotales) * 100 : 0;

        return ok(res, {
            resumen: {
                pacientesTotales,
                pacientesNuevos,
                planesNutricionales,
                consultasTotales
            },
            kpisClave: {
                tasaRetencion: parseFloat(tasaRetencion.toFixed(1)),
                conversionMembresia: parseFloat(conversionMembresia.toFixed(1)),
                riesgoAbandono,
                riesgoClinico,
                promedioGrasaGral: countGrasa > 0 ? parseFloat((sumGrasa / countGrasa).toFixed(2)) : 0
            },
            tendenciaMaestre,
            googleCalendarUrl: config?.googleCalendarUrl || "https://calendar.google.com",
            membresias: {
                totalActivas: basica + premium,
                basica,
                premium,
                sinSuscripcion: pacientesTotales - (basica + premium)
            },
            objetivos
        });
    } catch (err) {
        next(err);
    }
};

export const getAlertas = async (req, res, next) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        const ahora = new Date();
        
        const pacientes = await prisma.paciente.findMany({
            include: {
                antecedentes: { select: { patologia: true } },
                valoraciones: {
                    orderBy: { fecha: 'desc' },
                    take: 1,
                    select: { fecha: true, deficitMusculo: true }
                }
            }
        });

        const alertas = pacientes.map(p => {
            const ultV = p.valoraciones[0];
            const diasSinVisita = ultV ? Math.floor(Math.abs(ahora - new Date(ultV.fecha)) / (1000 * 60 * 60 * 24)) : 999;
            
            let tipoRiesgo = 'Ninguno';
            let prioridad = 'Baja';

            if (diasSinVisita > 45) {
                tipoRiesgo = 'Abandono';
                prioridad = 'Media';
            }

            const hasPat = p.antecedentes?.patologia && p.antecedentes.patologia.toLowerCase() !== 'ninguna' && p.antecedentes.patologia.trim() !== '';
            if (hasPat && Number(ultV?.deficitMusculo || 0) > 3) {
                tipoRiesgo = tipoRiesgo === 'Abandono' ? 'Abandono + Clínico' : 'Crítico Clínico';
                prioridad = 'Alta';
            }

            return {
                pacienteId: p.id,
                nombre: p.nombre,
                diasSinVisita,
                tipoRiesgo,
                prioridad,
                ultimoContacto: ultV ? ultV.fecha : 'Nunca'
            };
        })
        .filter(a => a.tipoRiesgo !== 'Ninguno' || a.diasSinVisita > 30)
        .sort((a, b) => {
            const scorePrioridad = { 'Alta': 3, 'Media': 2, 'Baja': 1 };
            return scorePrioridad[b.prioridad] - scorePrioridad[a.prioridad] || b.diasSinVisita - a.diasSinVisita;
        });

        return ok(res, alertas);
    } catch (err) {
        next(err);
    }
};
