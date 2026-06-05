import prisma from '../lib/prisma.js';
import { ok } from '../utils/response.js';

const getMeridaDate = () => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Merida',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const partValues = {};
    parts.forEach(p => partValues[p.type] = p.value);
    
    return new Date(
        parseInt(partValues.year),
        parseInt(partValues.month) - 1,
        parseInt(partValues.day),
        parseInt(partValues.hour),
        parseInt(partValues.minute),
        parseInt(partValues.second)
    );
};

const getMeridaUtcBoundaries = () => {
    const ahoraMerida = getMeridaDate();
    const year = ahoraMerida.getFullYear();
    const month = ahoraMerida.getMonth();
    const day = ahoraMerida.getDate();

    // Mérida is UTC-6 all year round.
    // 00:00:00 local time = 06:00:00 UTC
    const inicioHoy = new Date(Date.UTC(year, month, day, 6, 0, 0));
    
    // 23:59:59 local time = 05:59:59 UTC of the next day
    const finHoy = new Date(Date.UTC(year, month, day, 6, 0, 0) + 86399000);

    // 1st day of the month at 00:00:00 local time = 06:00:00 UTC
    const inicioMes = new Date(Date.UTC(year, month, 1, 6, 0, 0));

    // Jan 1st of the year at 00:00:00 local time = 06:00:00 UTC
    const inicioAnio = new Date(Date.UTC(year, 0, 1, 6, 0, 0));

    return { inicioHoy, finHoy, inicioMes, inicioAnio };
};

export const getMetricas = async (req, res, next) => {
    try {
        // Force no-cache to avoid 304 issues reported
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        
        const ahora = new Date();
        const { inicioHoy, finHoy, inicioMes, inicioAnio } = getMeridaUtcBoundaries();

        // 1. Data Retrieval — batch all counts in one round trip
        const [
            pacientesTotales, pacientesNuevosMes, pacientesNuevosHoy,
            planesNutricionales, consultasTotales, consultasMes,
            consultasHoy, consultasAnio, config, basica, premium
        ] = await prisma.$transaction([
            prisma.paciente.count(),
            prisma.paciente.count({ where: { fechaRegistro: { gte: inicioMes } } }),
            prisma.paciente.count({ where: { fechaRegistro: { gte: inicioHoy, lte: finHoy } } }),
            prisma.plan.count(),
            prisma.valoracion.count(),
            prisma.valoracion.count({ where: { createdAt: { gte: inicioMes } } }),
            prisma.valoracion.count({ where: { createdAt: { gte: inicioHoy, lte: finHoy } } }),
            prisma.valoracion.count({ where: { createdAt: { gte: inicioAnio } } }),
            prisma.configuracion.findUnique({ where: { id: 'singleton' } }),
            prisma.paciente.count({ where: { nivelMembresia: 'basica' } }),
            prisma.paciente.count({ where: { nivelMembresia: 'premium' } }),
        ]);
        const distribucionObjetivos = await prisma.datosEjercicio.groupBy({
            by: ['objetivo'],
            _count: { objetivo: true },
            where: { objetivo: { not: null } }
        });

        const objetivos = distribucionObjetivos.map(o => ({
            nombre: o.objetivo,
            cantidad: o._count.objetivo
        }));

        // 2. Tendencia Maestre (Last 6 Months)
        const ahoraMerida = getMeridaDate();
        const mesesTrend = [];
        const meridaOffsetMs = 6 * 60 * 60 * 1000;
        
        for (let i = 5; i >= 0; i--) {
            const year = ahoraMerida.getFullYear();
            const month = ahoraMerida.getMonth() - i;
            
            const localInicio = new Date(year, month, 1);
            const localFin = new Date(year, month + 1, 0, 23, 59, 59);
            
            const inicio = new Date(localInicio.getTime() + meridaOffsetMs);
            const fin = new Date(localFin.getTime() + meridaOffsetMs);
            
            const mNombre = localInicio.toLocaleString('es-ES', { month: 'short' }).toUpperCase();
            
            mesesTrend.push({
                nombre: mNombre.replace('.', ''),
                inicio,
                fin
            });
        }

        // Batch all 6-month trend queries in one round trip (18 queries → 1)
        const trendQueries = mesesTrend.flatMap(m => [
            prisma.paciente.count({ where: { fechaRegistro: { gte: m.inicio, lte: m.fin } } }),
            prisma.valoracion.count({ where: { createdAt: { gte: m.inicio, lte: m.fin } } }),
            prisma.plan.count({ where: { fechaCreacion: { gte: m.inicio, lte: m.fin } } }),
        ]);
        const trendResults = await prisma.$transaction(trendQueries);
        const tendenciaMaestre = mesesTrend.map((m, i) => ({
            mes: m.nombre,
            pacientes: trendResults[i * 3],
            consultas: trendResults[i * 3 + 1],
            planes: trendResults[i * 3 + 2],
        }));

        // 3. Clinical Analysis & KPIs (capped at 200 most recent patients)
        const pacientes = await prisma.paciente.findMany({
            orderBy: { fechaRegistro: 'desc' },
            take: 200,
            include: {
                antecedentes: { select: { patologia: true } },
                valoraciones: {
                    orderBy: { fecha: 'desc' },
                    take: 2,
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
                pacientesNuevosMes,
                pacientesNuevosHoy,
                planesNutricionales,
                consultasTotales,
                consultasMes,
                consultasHoy,
                consultasAnio
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
            orderBy: { fechaRegistro: 'desc' },
            take: 300,
            select: {
                id: true,
                nombre: true,
                apellido: true,
                antecedentes: { select: { patologia: true } },
                valoraciones: {
                    orderBy: { fecha: 'desc' },
                    select: {
                        id: true,
                        fecha: true,
                        numeroValoracion: true,
                        pesoActual: true,
                        hora: true,
                        barrido: { select: { id: true, kcalTotal: true } }
                    }
                },
                planes: {
                    select: { id: true, valoracionId: true, estadoEnvio: true, nombre: true, fechaCreacion: true }
                }
            }
        });

        const alertasRaw = [];

        pacientes.forEach(p => {
            // 1. Alert for EVERY unassigned or unsent valuation
            p.valoraciones.forEach(v => {
                const planAsociado = p.planes.find(pl => pl.valoracionId === v.id);
                const diasSinVisitaVal = Math.floor(Math.abs(ahora - new Date(v.fecha)) / (1000 * 60 * 60 * 24));
                const pesoVal = v.pesoActual ? parseFloat(v.pesoActual.toString()) : null;

                if (!planAsociado) {
                    // Si tiene el objeto barrido pero sin kcal, lo tratamos como vacío
                    const hasBarrido = v.barrido && parseFloat(v.barrido.kcalTotal || 0) > 0;
                    const tipoRiesgo = hasBarrido ? 'Plan en Proceso' : 'Pendiente de plan';
                    
                    alertasRaw.push({
                        pacienteId: p.id,
                        valoracionId: v.id,
                        nombre: `${p.nombre} ${p.apellido || ''}`.trim(),
                        diasSinVisita: diasSinVisitaVal,
                        tipoRiesgo,
                        prioridad: 'Alta',
                        ultimoContacto: v.fecha,
                        fechaPlan: v.fecha,
                        numeroValoracion: v.numeroValoracion,
                        peso: pesoVal,
                        hora: v.hora
                    });
                } else if (planAsociado.estadoEnvio === 'pendiente') {
                    alertasRaw.push({
                        pacienteId: p.id,
                        valoracionId: v.id,
                        planId: planAsociado.id,
                        nombre: `${p.nombre} ${p.apellido || ''}`.trim(),
                        diasSinVisita: diasSinVisitaVal,
                        tipoRiesgo: 'Listo para enviar',
                        prioridad: 'Alta',
                        ultimoContacto: v.fecha,
                        fechaPlan: planAsociado.fechaCreacion,
                        numeroValoracion: v.numeroValoracion,
                        peso: pesoVal,
                        hora: v.hora
                    });
                }
            });

            // 2. Clinical rules only apply to the Most Recent Valuation
            const ultV = p.valoraciones[0];
            if (ultV) {
                const diasSinVisita = Math.floor(Math.abs(ahora - new Date(ultV.fecha)) / (1000 * 60 * 60 * 24));
                let tipoRiesgo = 'Ninguno';
                let prioridad = 'Baja';

                if (diasSinVisita > 45) {
                    tipoRiesgo = 'Abandono';
                    prioridad = 'Media';
                }

                const hasPat = p.antecedentes?.patologia && p.antecedentes.patologia.toLowerCase() !== 'ninguna' && p.antecedentes.patologia.trim() !== '';
                if (hasPat && Number(ultV.deficitMusculo || 0) > 3) {
                    tipoRiesgo = tipoRiesgo === 'Abandono' ? 'Abandono + Clínico' : 'Crítico Clínico';
                    prioridad = 'Alta';
                }

                if (tipoRiesgo !== 'Ninguno') {
                    alertasRaw.push({
                        pacienteId: p.id,
                        nombre: `${p.nombre} ${p.apellido || ''}`.trim(),
                        diasSinVisita,
                        tipoRiesgo,
                        prioridad,
                        ultimoContacto: ultV.fecha,
                        fechaPlan: null
                    });
                }
            }
        });
        
        const alertas = alertasRaw
        .filter(a => a.tipoRiesgo !== 'Ninguno')
        .sort((a, b) => {
            const scorePrioridad = { 'Alta': 3, 'Media': 2, 'Baja': 1 };
            // Prioridad absoluta a los pendientes de flujo nutricional (Fase 2, 3 y 4)
            const isEyderA = ['Falta Equivalencias', 'Sin Plan Asignado', 'Plan Sin Enviar'].includes(a.tipoRiesgo);
            const isEyderB = ['Falta Equivalencias', 'Sin Plan Asignado', 'Plan Sin Enviar'].includes(b.tipoRiesgo);
            
            if (isEyderA && !isEyderB) return -1;
            if (isEyderB && !isEyderA) return 1;
            
            return scorePrioridad[b.prioridad] - scorePrioridad[a.prioridad] || b.diasSinVisita - a.diasSinVisita;
        });
 
        return ok(res, alertas);
    } catch (err) {
        next(err);
    }
};

export const getTopClientes = async (req, res, next) => {
    try {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');

        const top = await prisma.paciente.findMany({
            include: {
                _count: { select: { valoraciones: true } }
            },
            orderBy: {
                valoraciones: { _count: 'desc' }
            },
            take: 10
        });

        return ok(res, top.map(p => ({
            id: p.id,
            nombre: `${p.nombre} ${p.apellido || ''}`.trim(),
            valoraciones: p._count.valoraciones,
            nivelMembresia: p.nivelMembresia,
            email: p.email,
            telefono: p.telefono
        })));
    } catch (err) {
        next(err);
    }
};

