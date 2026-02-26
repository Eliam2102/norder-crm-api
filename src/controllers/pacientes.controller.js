import prisma from '../lib/prisma.js';
import { ok, error } from '../utils/response.js';

export const getAll = async (req, res, next) => {
    try {
        const { buscar, membresia } = req.query;

        const where = {};
        if (buscar) {
            where.OR = [
                { nombre: { contains: buscar, mode: 'insensitive' } },
                { apellido: { contains: buscar, mode: 'insensitive' } },
                { telefono: { contains: buscar } }
            ];
        }
        if (membresia) {
            where.nivelMembresia = membresia;
        }

        const pacientes = await prisma.paciente.findMany({
            where,
            include: {
                valoraciones: {
                    orderBy: { fecha: 'desc' },
                    take: 1
                },
                planes: {
                    where: { estado: 'activo' },
                    orderBy: { fechaCreacion: 'desc' },
                    take: 1
                }
            },
            orderBy: { nombre: 'asc' }
        });

        return ok(res, pacientes);
    } catch (err) {
        next(err);
    }
};

export const create = async (req, res, next) => {
    try {
        const { 
            nombre, sexo, fechaNacimiento, email, telefono, tallas, complexion, talla,
            ejercicio, datosEjercicio,
            antecedentes,
            habitos, consumoCalorico,
            suplementacion,
            consumo24h
        } = req.body;

        const estaturaVal = talla || tallas || req.body.estatura;

        const e = ejercicio || datosEjercicio || {};
        const a = antecedentes || {};
        const h = habitos || consumoCalorico || {};
        const s = suplementacion || {};
        const c24 = consumo24h || h; 

        const nuevo = await prisma.paciente.create({
            data: {
                nombre,
                sexo,
                fechaNacimiento: new Date(fechaNacimiento),
                email,
                telefono: telefono || null,
                estatura: estaturaVal ? parseFloat(estaturaVal) : null,
                complexion: complexion ? parseFloat(complexion) : null,
                datosEjercicio: {
                    create: {
                        objetivo: e.objetivo ?? req.body.objetivo,
                        gymOrigen: e.gymOrigen ?? req.body.gymOrigen,
                        disciplina: e.disciplina ?? req.body.disciplina,
                        frecuencia: e.frecuencia ?? req.body.frecuencia,
                        tiempo: e.tiempo ?? req.body.tiempo,
                        nivelActividad: e.nivelActividad ?? req.body.nivelActividad
                    }
                },
                antecedentes: {
                    create: {
                        alimentosNoGustan: a.alimentosNoGustan ?? a.alimentosNoGusta ?? req.body.alimentosNoGustan ?? req.body.alimentosNoGusta,
                        alimentosGustan: a.alimentosGustan ?? a.alimentosGusta ?? req.body.alimentosGustan ?? req.body.alimentosGusta,
                        alergias: a.alergias ?? a.alergico ?? req.body.alergias ?? req.body.alergico,
                        patologia: a.patologia ?? req.body.patologia,
                        cirugias: a.cirugias ?? req.body.cirugias,
                        estrenimiento: a.estrenimiento ?? h.estrenimiento ?? req.body.estrenimiento,
                        consumoAlcohol: a.consumoAlcohol ?? a.alcohol ?? h.consumoAlcohol ?? h.alcohol ?? req.body.consumoAlcohol ?? req.body.alcohol,
                        tabaco: a.tabaco ?? h.tabaco ?? req.body.tabaco,
                        agua: a.agua ?? h.agua ?? req.body.agua,
                        cicloMenstrual: a.cicloMenstrual ?? h.cicloMenstrual ?? req.body.cicloMenstrual,
                        signosYSintomas: a.signosYSintomas ?? a.signosSintomas ?? h.signosYSintomas ?? h.signosSintomas ?? req.body.signosYSintomas ?? req.body.signosSintomas,
                        historialProductos: a.historialProductos ?? s.historialProductos ?? req.body.historialProductos,
                        recomendacionSuplementos: a.recomendacionSuplementos ?? a.recomSuplementos ?? s.recomendacionSuplementos ?? s.recomSuplementos ?? req.body.recomendacionSuplementos ?? req.body.recomSuplementos
                    }
                },
                consumoCalorico: {
                    create: {
                        recordatorio24hActivo: c24.recordatorio24hActivo ?? true,
                        horaDesayuno:     c24.desayuno?.hora ?? c24.horaDesayuno,
                        ayerDesayuno:     c24.desayuno?.ayer ?? c24.ayerDesayuno,
                        usalmenteDesayuno: c24.desayuno?.usualmente ?? c24.usalmenteDesayuno,
                        horaColacion1:    c24.colacion1?.hora ?? c24.horaColacion1,
                        ayerColacion1:    c24.colacion1?.ayer ?? c24.ayerColacion1,
                        usalmenteColacion1: c24.colacion1?.usualmente ?? c24.usalmenteColacion1,
                        horaAlmuerzo:     c24.almuerzo?.hora ?? c24.horaAlmuerzo,
                        ayerAlmuerzo:     c24.almuerzo?.ayer ?? c24.ayerAlmuerzo,
                        usalmenteAlmuerzo: c24.almuerzo?.usualmente ?? c24.usalmenteAlmuerzo,
                        horaColacion2:    c24.colacion2?.hora ?? c24.horaColacion2,
                        ayerColacion2:    c24.colacion2?.ayer ?? c24.ayerColacion2,
                        usalmenteColacion2: c24.colacion2?.usualmente ?? c24.usalmenteColacion2,
                        horaCena:         c24.cena?.hora ?? c24.horaCena,
                        ayerCena:         c24.cena?.ayer ?? c24.ayerCena,
                        usalmenteCena:     c24.cena?.usualmente ?? c24.usalmenteCena
                    }
                }
            },
            include: {
                datosEjercicio: true,
                antecedentes: true,
                consumoCalorico: true
            }
        });

        return ok(res, nuevo, 201);
    } catch (err) {
        next(err);
    }
};

export const getById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const paciente = await prisma.paciente.findUniqueOrThrow({
            where: { id },
            include: {
                datosEjercicio: true,
                consumoCalorico: true,
                antecedentes: true,
                valoraciones: { 
                    orderBy: { fecha: 'desc' }, 
                    include: { temarioConsulta: true, planes: { take: 1, orderBy: { fechaCreacion: 'desc' } } } 
                },
                planes: { orderBy: { fechaCreacion: 'desc' } },
                revisiones: { orderBy: { fecha: 'desc' } }
            }
        });

        const { datosEjercicio, consumoCalorico, antecedentes, valoraciones, ...rest } = paciente;
        
        // Map valoraciones to include a singular plan object
        const valoracionesMapped = valoraciones.map(v => {
            const { planes, ...vRest } = v;
            return { ...vRest, plan: planes[0] || null };
        });

        return ok(res, { 
            ...rest,
            ejercicio: datosEjercicio || {},
            antecedentes: antecedentes || {},
            habitos: consumoCalorico || {},
            valoraciones: valoracionesMapped,
            ultimaValoracion: valoracionesMapped[0] || null
        });
    } catch (err) {
        next(err);
    }
};

export const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { 
            id: _, 
            datosEjercicio, 
            consumoCalorico, 
            antecedentes, 
            valoraciones, 
            planes, 
            revisiones, 
            ejercicio,
            habitos,
            suplementacion,
            consumo24h,
            ocupacion,
            motivoConsulta,
            membresia,
            createdAt,
            updatedAt,
            // Non-schema fields from components
            edad,
            talla,
            talllas,
            objetivo,
            ...data 
        } = req.body;

        // Map root talla to estatura if needed
        if (talla && !data.estatura) {
            data.estatura = parseFloat(talla);
        }

        if (data.fechaNacimiento) {
            data.fechaNacimiento = new Date(data.fechaNacimiento);
        }

        const e = ejercicio || datosEjercicio || {};
        const a = antecedentes || {};
        const h = habitos || consumoCalorico || {};
        const s = suplementacion || {};
        const c24 = consumo24h || h;

        const updated = await prisma.paciente.update({
            where: { id },
            data: {
                ...data,
                datosEjercicio: e ? {
                    upsert: {
                        update: {
                            objetivo: e.objetivo,
                            gymOrigen: e.gymOrigen,
                            disciplina: e.disciplina,
                            frecuencia: e.frecuencia,
                            tiempo: e.tiempo,
                            nivelActividad: e.nivelActividad,
                            porcentajeSedentario: e.porcentajeSedentario ?? req.body.porcentajeSedentario,
                            porcentajeLeve: e.porcentajeLeve ?? req.body.porcentajeLeve,
                            porcentajeModerado: e.porcentajeModerado ?? req.body.porcentajeModerado,
                            porcentajeIntenso: e.porcentajeIntenso ?? req.body.porcentajeIntenso
                        },
                        create: {
                            objetivo: e.objetivo,
                            gymOrigen: e.gymOrigen,
                            disciplina: e.disciplina,
                            frecuencia: e.frecuencia,
                            tiempo: e.tiempo,
                            nivelActividad: e.nivelActividad,
                            porcentajeSedentario: e.porcentajeSedentario ?? req.body.porcentajeSedentario,
                            porcentajeLeve: e.porcentajeLeve ?? req.body.porcentajeLeve,
                            porcentajeModerado: e.porcentajeModerado ?? req.body.porcentajeModerado,
                            porcentajeIntenso: e.porcentajeIntenso ?? req.body.porcentajeIntenso
                        }
                    }
                } : undefined,
                antecedentes: a ? {
                    upsert: {
                        update: {
                            alimentosNoGustan: a.alimentosNoGustan ?? a.alimentosNoGusta ?? req.body.alimentosNoGustan ?? req.body.alimentosNoGusta,
                            alimentosGustan: a.alimentosGustan ?? a.alimentosGusta ?? req.body.alimentosGustan ?? req.body.alimentosGusta,
                            alergias: a.alergias ?? a.alergico ?? req.body.alergias ?? req.body.alergico,
                            patologia: a.patologia ?? req.body.patologia,
                            cirugias: a.cirugias ?? req.body.cirugias,
                            estrenimiento: a.estrenimiento ?? h.estrenimiento ?? req.body.estrenimiento,
                            consumoAlcohol: a.consumoAlcohol ?? a.alcohol ?? h.consumoAlcohol ?? h.alcohol ?? req.body.consumoAlcohol ?? req.body.alcohol,
                            tabaco: a.tabaco ?? h.tabaco ?? req.body.tabaco,
                            agua: a.agua ?? h.agua ?? req.body.agua,
                            cicloMenstrual: a.cicloMenstrual ?? h.cicloMenstrual ?? req.body.cicloMenstrual,
                            signosYSintomas: a.signosYSintomas ?? a.signosSintomas ?? h.signosYSintomas ?? h.signosSintomas ?? req.body.signosYSintomas ?? req.body.signosSintomas,
                            historialProductos: a.historialProductos ?? s.historialProductos ?? req.body.historialProductos,
                            recomendacionSuplementos: a.recomendacionSuplementos ?? a.recomSuplementos ?? s.recomendacionSuplementos ?? s.recomSuplementos ?? req.body.recomendacionSuplementos ?? req.body.recomSuplementos
                        },
                        create: {
                            alimentosNoGustan: a.alimentosNoGustan ?? a.alimentosNoGusta ?? req.body.alimentosNoGustan ?? req.body.alimentosNoGusta,
                            alimentosGustan: a.alimentosGustan ?? a.alimentosGusta ?? req.body.alimentosGustan ?? req.body.alimentosGusta,
                            alergias: a.alergias ?? a.alergico ?? req.body.alergias ?? req.body.alergico,
                            patologia: a.patologia ?? req.body.patologia,
                            cirugias: a.cirugias ?? req.body.cirugias,
                            estrenimiento: a.estrenimiento ?? h.estrenimiento ?? req.body.estrenimiento,
                            consumoAlcohol: a.consumoAlcohol ?? a.alcohol ?? h.consumoAlcohol ?? h.alcohol ?? req.body.consumoAlcohol ?? req.body.alcohol,
                            tabaco: a.tabaco ?? h.tabaco ?? req.body.tabaco,
                            agua: a.agua ?? h.agua ?? req.body.agua,
                            cicloMenstrual: a.cicloMenstrual ?? h.cicloMenstrual ?? req.body.cicloMenstrual,
                            signosYSintomas: a.signosYSintomas ?? a.signosSintomas ?? h.signosYSintomas ?? h.signosSintomas ?? req.body.signosYSintomas ?? req.body.signosSintomas,
                            historialProductos: a.historialProductos ?? s.historialProductos ?? req.body.historialProductos,
                            recomendacionSuplementos: a.recomendacionSuplementos ?? a.recomSuplementos ?? s.recomendacionSuplementos ?? s.recomSuplementos ?? req.body.recomendacionSuplementos ?? req.body.recomSuplementos
                        }
                    }
                } : undefined,
                consumoCalorico: c24 ? {
                    upsert: {
                        update: {
                            recordatorio24hActivo: c24.recordatorio24hActivo ?? true,
                            horaDesayuno:     c24.desayuno?.hora ?? c24.horaDesayuno,
                            ayerDesayuno:     c24.desayuno?.ayer ?? c24.ayerDesayuno,
                            usalmenteDesayuno: c24.desayuno?.usualmente ?? c24.usalmenteDesayuno,
                            horaColacion1:    c24.colacion1?.hora ?? c24.horaColacion1,
                            ayerColacion1:    c24.colacion1?.ayer ?? c24.ayerColacion1,
                            usalmenteColacion1: c24.colacion1?.usualmente ?? c24.usalmenteColacion1,
                            horaAlmuerzo:     c24.almuerzo?.hora ?? c24.horaAlmuerzo,
                            ayerAlmuerzo:     c24.almuerzo?.ayer ?? c24.ayerAlmuerzo,
                            usalmenteAlmuerzo: c24.almuerzo?.usualmente ?? c24.usalmenteAlmuerzo,
                            horaColacion2:    c24.colacion2?.hora ?? c24.horaColacion2,
                            ayerColacion2:    c24.colacion2?.ayer ?? c24.ayerColacion2,
                            usalmenteColacion2: c24.colacion2?.usualmente ?? c24.usalmenteColacion2,
                            horaCena:         c24.cena?.hora ?? c24.horaCena,
                            ayerCena:         c24.cena?.ayer ?? c24.ayerCena,
                            usalmenteCena:     c24.cena?.usualmente ?? c24.usalmenteCena
                        },
                        create: {
                            recordatorio24hActivo: c24.recordatorio24hActivo ?? true,
                            horaDesayuno:     c24.desayuno?.hora ?? c24.horaDesayuno,
                            ayerDesayuno:     c24.desayuno?.ayer ?? c24.ayerDesayuno,
                            usalmenteDesayuno: c24.desayuno?.usualmente ?? c24.usalmenteDesayuno,
                            horaColacion1:    c24.colacion1?.hora ?? c24.horaColacion1,
                            ayerColacion1:    c24.colacion1?.ayer ?? c24.ayerColacion1,
                            usalmenteColacion1: c24.colacion1?.usualmente ?? c24.usalmenteColacion1,
                            horaAlmuerzo:     c24.almuerzo?.hora ?? c24.horaAlmuerzo,
                            ayerAlmuerzo:     c24.almuerzo?.ayer ?? c24.ayerAlmuerzo,
                            usalmenteAlmuerzo: c24.almuerzo?.usualmente ?? c24.usalmenteAlmuerzo,
                            horaColacion2:    c24.colacion2?.hora ?? c24.horaColacion2,
                            ayerColacion2:    c24.colacion2?.ayer ?? c24.ayerColacion2,
                            usalmenteColacion2: c24.colacion2?.usualmente ?? c24.usalmenteColacion2,
                            horaCena:         c24.cena?.hora ?? c24.horaCena,
                            ayerCena:         c24.cena?.ayer ?? c24.ayerCena,
                            usalmenteCena:     c24.cena?.usualmente ?? c24.usalmenteCena
                        }
                    }
                } : undefined
            },
            include: {
                datosEjercicio: true,
                antecedentes: true,
                consumoCalorico: true
            }
        });
        return ok(res, updated);
    } catch (err) {
        next(err);
    }
};

export const remove = async (req, res, next) => {
    try {
        const { id } = req.params;

        // Seguridad: Verificar rol de administrador
        if (req.user?.role !== 'admin') {
            return error(res, 'No tienes permisos para eliminar pacientes', 403);
        }

        await prisma.paciente.delete({ where: { id } });
        return ok(res, { message: 'Paciente y todo su historial eliminados con éxito' });
    } catch (err) {
        // Manejar caso donde el paciente no existe (P2025)
        if (err.code === 'P2025') {
            return error(res, 'El paciente no existe o ya ha sido eliminado', 404);
        }
        next(err);
    }
};

export const getEjercicio = async (req, res, next) => {
    try {
        const data = await prisma.datosEjercicio.findUnique({
            where: { pacienteId: req.params.id }
        });
        return ok(res, data || {});
    } catch (err) {
        next(err);
    }
};

export const upsertEjercicio = async (req, res, next) => {
    try {
        const data = await prisma.datosEjercicio.upsert({
            where: { pacienteId: req.params.id },
            update: req.body,
            create: { ...req.body, pacienteId: req.params.id }
        });
        return ok(res, data);
    } catch (err) {
        next(err);
    }
};

export const getAntecedentes = async (req, res, next) => {
    try {
        const data = await prisma.antecedentes.findUnique({
            where: { pacienteId: req.params.id }
        });
        return ok(res, data || {});
    } catch (err) {
        next(err);
    }
};

export const upsertAntecedentes = async (req, res, next) => {
    try {
        const data = await prisma.antecedentes.upsert({
            where: { pacienteId: req.params.id },
            update: req.body,
            create: { ...req.body, pacienteId: req.params.id }
        });
        return ok(res, data);
    } catch (err) {
        next(err);
    }
};

export const getConsumo = async (req, res, next) => {
    try {
        const data = await prisma.consumoCalorico.findUnique({
            where: { pacienteId: req.params.id }
        });
        return ok(res, data || {});
    } catch (err) {
        next(err);
    }
};

export const upsertConsumo = async (req, res, next) => {
    try {
        const data = await prisma.consumoCalorico.upsert({
            where: { pacienteId: req.params.id },
            update: req.body,
            create: { ...req.body, pacienteId: req.params.id }
        });
        return ok(res, data);
    } catch (err) {
        next(err);
    }
};

export const updateMembresia = async (req, res, next) => {
    try {
        const { nivelMembresia, suscripcionInicio, suscripcionFin } = req.body;
        const data = { nivelMembresia };
        
        if (suscripcionInicio) data.suscripcionInicio = new Date(suscripcionInicio);
        if (suscripcionFin) data.suscripcionFin = new Date(suscripcionFin);

        const updated = await prisma.paciente.update({
            where: { id: req.params.id },
            data
        });
        return ok(res, updated);
    } catch (err) {
        next(err);
    }
};
