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
                    orderBy: [
                        { fecha: 'desc' },
                        { numeroValoracion: 'desc' }
                    ],
                    include: {
                        barrido: { select: { id: true, kcalTotal: true, porciones: true } },
                        citas: { select: { id: true, fecha: true } }
                    }
                },
                planes: {
                    orderBy: { fechaCreacion: 'desc' }
                }
            },
            orderBy: { nombre: 'asc' }
        });

        // Mapeo profundo para soportar la vista de "Pendientes" y otros estados
        const mapped = pacientes.map(p => {
            const valoraciones = p.valoraciones.map(v => {
                const planAsociado = p.planes.find(pl => pl.valoracionId === v.id);
                
                // Detección real de barrido (kcal > 0 o porciones > 0)
                let hasBarrido = false;
                if (v.barrido) {
                    if ((v.barrido.kcalTotal || 0) > 0) {
                        hasBarrido = true;
                    } else {
                        try {
                            const pJson = JSON.parse(v.barrido.porciones || '{}');
                            hasBarrido = Object.values(pJson).some(val => Number(val) > 0);
                        } catch (e) {}
                    }
                }

                // Estado de flujo interno
                let estadoFlujo = 'Enviado'; 
                if (!planAsociado) {
                    estadoFlujo = hasBarrido ? 'Plan en Proceso' : 'Pendiente de plan';
                } else if (planAsociado.estadoEnvio === 'pendiente') {
                    estadoFlujo = 'Listo para enviar';
                }

                return {
                    ...v,
                    hasBarrido,
                    estadoFlujo,
                    planId: planAsociado?.id || null,
                    estadoEnvio: planAsociado?.estadoEnvio || null,
                    // true si existe al menos una cita de seguimiento para esta valoración
                    tieneCita: Array.isArray(v.citas) && v.citas.length > 0,
                    proximaCita: Array.isArray(v.citas) && v.citas.length > 0 ? v.citas[0].fecha : null,
                };
            });

            return {
                ...p,
                valoraciones,
                // Compatibilidad con vistas que solo esperan un objeto de valoracion/plan
                ultimaValoracion: valoraciones[0] || null,
                ultimoPlan: p.planes[0] || null
            };
        });

        return ok(res, mapped);
    } catch (err) {
        next(err);
    }
};

export const create = async (req, res, next) => {
    try {
        const { 
            nombre, apellido, sexo, fechaNacimiento, email, telefono, tallas, complexion, talla,
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

        if (telefono) {
            // Extracción de los últimos 10 dígitos netos para coincidencia a prueba de balas
            const telLimpo = telefono.replace(/\D/g, '');
            if (telLimpo.length >= 10) {
                const targetTel = telLimpo.slice(-10);
                const allPacientes = await prisma.paciente.findMany({ select: { id: true, telefono: true } });
                const existsPhone = allPacientes.find(p => p.telefono && p.telefono.replace(/\D/g, '').endsWith(targetTel));
                if (existsPhone) {
                    return res.status(409).json({ success: false, error: 'El número de teléfono ya pertenece a otro paciente. Corrige el teléfono.' });
                }
            } else {
                const exists = await prisma.paciente.findFirst({ where: { telefono } });
                if (exists) return res.status(409).json({ success: false, error: 'El número de teléfono ya pertenece a otro paciente.' });
            }
        }
        
        if (email) {
            const existsEmail = await prisma.paciente.findFirst({ where: { email: email.trim() } });
            if (existsEmail) {
                return res.status(409).json({ success: false, error: 'Este correo electrónico (email) ya está registrado en otro expediente.' });
            }
        }

        const nuevo = await prisma.paciente.create({
            data: {
                nombre,
                apellido: apellido || null,
                sexo,
                fechaNacimiento: new Date(fechaNacimiento),
                email,
                telefono: telefono || null,
                estatura: estaturaVal ? parseFloat(estaturaVal) : null,
                // peso y complexion se leen del root del payload
                peso: req.body.peso != null && req.body.peso !== '' ? parseFloat(req.body.peso) : null,
                complexion: complexion ? parseFloat(complexion) : null,
                datosEjercicio: {
                    create: {
                        objetivo: e.objetivo ?? req.body.objetivo,
                        gymOrigen: e.gymOrigen ?? req.body.gymOrigen,
                        horaEntrenamiento: e.horaEntrenamiento ?? req.body.horaEntrenamiento,
                        disciplina: e.disciplina ?? req.body.disciplina,
                        frecuencia: e.frecuencia ?? req.body.frecuencia,
                        tiempo: e.tiempo ?? req.body.tiempo,
                        nivelActividad: e.nivelActividad ?? req.body.nivelActividad,
                        porcentajeSedentario: e.porcentajeSedentario ?? req.body.porcentajeSedentario,
                        porcentajeLeve: e.porcentajeLeve ?? req.body.porcentajeLeve,
                        porcentajeModerado: e.porcentajeModerado ?? req.body.porcentajeModerado,
                        porcentajeIntenso: e.porcentajeIntenso ?? req.body.porcentajeIntenso
                    }
                },
                antecedentes: {
                    create: {
                        alimentosNoGustan: a.alimentosNoGustan ?? a.alimentosNoGusta ?? req.body.alimentosNoGustan ?? req.body.alimentosNoGusta,
                        alimentosGustan: a.alimentosGustan ?? a.alimentosGusta ?? req.body.alimentosGustan ?? req.body.alimentosGusta,
                        alergias: a.alergias ?? a.alergico ?? req.body.alergias ?? req.body.alergico,
                        patologia: a.patologia ?? req.body.patologia,
                        cirugias: a.cirugias ?? req.body.cirugias,
                        farmacos: a.farmacos ?? req.body.farmacos,
                        estrenimiento: a.estrenimiento ?? h.estrenimiento ?? req.body.estrenimiento,
                        consumoAlcohol: a.consumoAlcohol ?? a.alcohol ?? h.consumoAlcohol ?? h.alcohol ?? req.body.consumoAlcohol ?? req.body.alcohol,
                        tabaco: a.tabaco ?? h.tabaco ?? req.body.tabaco,
                        agua: a.agua ?? h.agua ?? req.body.agua,
                        cicloMenstrual: a.cicloMenstrual ?? h.cicloMenstrual ?? req.body.cicloMenstrual,
                        signosYSintomas: a.signosYSintomas ?? a.signosSintomas ?? h.signosYSintomas ?? h.signosSintomas ?? req.body.signosYSintomas ?? req.body.signosSintomas,
                        historialProductos: a.historialProductos ?? s.historialProductos ?? req.body.historialProductos,
                        recomendacionSuplementos: a.recomendacionSuplementos ?? a.recomSuplementos ?? s.recomendacionSuplementos ?? s.recomSuplementos ?? req.body.recomendacionSuplementos ?? req.body.recomSuplementos,
                        suplementosDetalle: a.suplementosDetalle ?? req.body.suplementosDetalle ?? undefined
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
                    orderBy: [
                        { fecha: 'desc' },
                        { numeroValoracion: 'desc' }
                    ], 
                    include: { 
                        temarioConsulta: true, 
                        barrido: { select: { id: true, kcalTotal: true, porciones: true } },
                        planes: { take: 1, orderBy: { fechaCreacion: 'desc' } } 
                    } 
                },
                planes: { orderBy: { fechaCreacion: 'desc' } },
                revisiones: { orderBy: { fecha: 'desc' } }
            }
        });

        const { datosEjercicio: de, consumoCalorico: cc, antecedentes: ant, valoraciones: val, ...rest } = paciente;
        
        // Mapeo de valoraciones con lógica de estados de flujo
        const valoracionesMapped = val.map(v => {
            const { planes, barrido, ...vRest } = v;
            const planAsociado = planes[0] || null;
            
            // Detección real de barrido
            let hasBarrido = false;
            if (barrido) {
                if ((barrido.kcalTotal || 0) > 0) hasBarrido = true;
                else {
                    try {
                        const pJson = JSON.parse(barrido.porciones || '{}');
                        hasBarrido = Object.values(pJson).some(val => Number(val) > 0);
                    } catch (e) {}
                    }
            }

            // Estado de flujo
            let estadoFlujo = 'Enviado';
            if (!planAsociado) {
                estadoFlujo = hasBarrido ? 'Plan en Proceso' : 'Pendiente de plan';
            } else if (planAsociado.estadoEnvio === 'pendiente') {
                estadoFlujo = 'Listo para enviar';
            }

            return { 
                ...vRest, 
                plan: planAsociado,
                barrido,
                hasBarrido,
                estadoFlujo
            };
        });

        const mapped = { 
            ...rest,
            // Reconstrucción de la estructura original
            ejercicio: de ? {
                ...de,
                objetivo: de.objetivo,
                gymOrigen: de.gymOrigen,
                disciplina: de.disciplina,
                frecuencia: de.frecuencia,
                tiempo: de.tiempo,
                nivelActividad: de.nivelActividad
            } : {},
            antecedentes: ant ? {
                ...ant,
                alimentosNoGustan: ant.alimentosNoGustan,
                alimentosGustan: ant.alimentosGustan,
                alergias: ant.alergias,
                patologia: ant.patologia,
                cirugias: ant.cirugias,
                farmacos: ant.farmacos,
                estrenimiento: ant.estrenimiento,
                consumoAlcohol: ant.consumoAlcohol,
                tabaco: ant.tabaco,
                agua: ant.agua,
                cicloMenstrual: ant.cicloMenstrual,
                signosYSintomas: ant.signosYSintomas,
                historialProductos: ant.historialProductos,
                recomendacionSuplementos: ant.recomendacionSuplementos,
                suplementosDetalle: ant.suplementosDetalle ?? []
            } : {},
            habitos: cc ? {
                ...cc,
                desayuno: {
                    hora: cc.horaDesayuno,
                    ayer: cc.ayerDesayuno,
                    usualmente: cc.usalmenteDesayuno
                },
                colacion1: {
                    hora: cc.horaColacion1,
                    ayer: cc.ayerColacion1,
                    usualmente: cc.usalmenteColacion1
                },
                almuerzo: {
                    hora: cc.horaAlmuerzo,
                    ayer: cc.ayerAlmuerzo,
                    usualmente: cc.usalmenteAlmuerzo
                },
                colacion2: {
                    hora: cc.horaColacion2,
                    ayer: cc.ayerColacion2,
                    usualmente: cc.usalmenteColacion2
                },
                cena: {
                    hora: cc.horaCena,
                    ayer: cc.ayerCena,
                    usualmente: cc.usalmenteCena
                }
            } : {},
            valoraciones: valoracionesMapped,
            ultimaValoracion: valoracionesMapped[0] || null
        };

        return ok(res, mapped);
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
            tallas,
            talllas,
            objetivo,
            peso,
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

        if (data.telefono) {
            const telLimpo = data.telefono.replace(/\D/g, '');
            if (telLimpo.length >= 10) {
                const targetTel = telLimpo.slice(-10);
                const allPacientes = await prisma.paciente.findMany({ select: { id: true, telefono: true } });
                const existsPhone = allPacientes.find(p => p.id !== id && p.telefono && p.telefono.replace(/\D/g, '').endsWith(targetTel));
                if (existsPhone) {
                    return res.status(409).json({ success: false, error: 'El número de teléfono ya pertenece a otro paciente. Revisa la información.' });
                }
            } else {
                const exists = await prisma.paciente.findFirst({ where: { telefono: data.telefono, id: { not: id } } });
                if (exists) return res.status(409).json({ success: false, error: 'El número de teléfono ya pertenece a otro paciente.' });
            }
        }
        
        if (data.email) {
            const existsEmail = await prisma.paciente.findFirst({ where: { email: data.email.trim(), id: { not: id } } });
            if (existsEmail) {
                return res.status(409).json({ success: false, error: 'Este correo electrónico (email) ya está registrado en otro expediente.' });
            }
        }

        const updated = await prisma.paciente.update({
            where: { id },
            data: {
                ...data,
                datosEjercicio: e ? {
                    upsert: {
                        update: {
                            objetivo: e.objetivo,
                            gymOrigen: e.gymOrigen,
                            horaEntrenamiento: e.horaEntrenamiento ?? undefined,
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
                            horaEntrenamiento: e.horaEntrenamiento ?? undefined,
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
                            farmacos: a.farmacos ?? req.body.farmacos,
                            estrenimiento: a.estrenimiento ?? h.estrenimiento ?? req.body.estrenimiento,
                            consumoAlcohol: a.consumoAlcohol ?? a.alcohol ?? h.consumoAlcohol ?? h.alcohol ?? req.body.consumoAlcohol ?? req.body.alcohol,
                            tabaco: a.tabaco ?? h.tabaco ?? req.body.tabaco,
                            agua: a.agua ?? h.agua ?? req.body.agua,
                            cicloMenstrual: a.cicloMenstrual ?? h.cicloMenstrual ?? req.body.cicloMenstrual,
                            signosYSintomas: a.signosYSintomas ?? a.signosSintomas ?? h.signosYSintomas ?? h.signosSintomas ?? req.body.signosYSintomas ?? req.body.signosSintomas,
                            historialProductos: a.historialProductos ?? s.historialProductos ?? req.body.historialProductos,
                            recomendacionSuplementos: a.recomendacionSuplementos ?? a.recomSuplementos ?? s.recomendacionSuplementos ?? s.recomSuplementos ?? req.body.recomendacionSuplementos ?? req.body.recomSuplementos,
                            suplementosDetalle: a.suplementosDetalle ?? undefined
                        },
                        create: {
                            alimentosNoGustan: a.alimentosNoGustan ?? a.alimentosNoGusta ?? req.body.alimentosNoGustan ?? req.body.alimentosNoGusta,
                            alimentosGustan: a.alimentosGustan ?? a.alimentosGusta ?? req.body.alimentosGustan ?? req.body.alimentosGusta,
                            alergias: a.alergias ?? a.alergico ?? req.body.alergias ?? req.body.alergico,
                            patologia: a.patologia ?? req.body.patologia,
                            cirugias: a.cirugias ?? req.body.cirugias,
                            farmacos: a.farmacos ?? req.body.farmacos,
                            estrenimiento: a.estrenimiento ?? h.estrenimiento ?? req.body.estrenimiento,
                            consumoAlcohol: a.consumoAlcohol ?? a.alcohol ?? h.consumoAlcohol ?? h.alcohol ?? req.body.consumoAlcohol ?? req.body.alcohol,
                            tabaco: a.tabaco ?? h.tabaco ?? req.body.tabaco,
                            agua: a.agua ?? h.agua ?? req.body.agua,
                            cicloMenstrual: a.cicloMenstrual ?? h.cicloMenstrual ?? req.body.cicloMenstrual,
                            signosYSintomas: a.signosYSintomas ?? a.signosSintomas ?? h.signosYSintomas ?? h.signosSintomas ?? req.body.signosYSintomas ?? req.body.signosSintomas,
                            historialProductos: a.historialProductos ?? s.historialProductos ?? req.body.historialProductos,
                            recomendacionSuplementos: a.recomendacionSuplementos ?? a.recomSuplementos ?? s.recomendacionSuplementos ?? s.recomSuplementos ?? req.body.recomendacionSuplementos ?? req.body.recomSuplementos,
                            suplementosDetalle: a.suplementosDetalle ?? undefined
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
        const userRol = req.user?.rol || req.user?.role;
        if (userRol !== 'admin') {
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
