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
                    where: { deletedAt: null },
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
                const existsPhone = await prisma.paciente.findFirst({
                    where: { telefono: { endsWith: targetTel } },
                    select: { id: true }
                });
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
                        suplementosDetalle: a.suplementosDetalle ?? req.body.suplementosDetalle ?? undefined,
                        farmacosDetalle: a.farmacosDetalle ?? req.body.farmacosDetalle ?? undefined
                    }
                }
            },
            include: {
                datosEjercicio: true,
                antecedentes: true,
                habitosAlimentarios: { orderBy: { orden: 'asc' } }
            }
        });

        // Guardar hábitos alimentarios (consumo24h / habitos) como filas independientes
        // El schema usa HabitoAlimentario[] con campos: label, hora, ayer, usualmente
        const habitosRows = (() => {
            // Si viene como array directo (formato nuevo UI)
            if (Array.isArray(habitos)) return habitos;
            // Si viene como consumo24h plano con claves tipo horaDesayuno/ayerDesayuno/etc.
            if (c24 && typeof c24 === 'object' && !Array.isArray(c24)) {
                const tiempos = [
                    { key: 'desayuno',  label: 'Desayuno' },
                    { key: 'colacion1', label: 'Colación' },
                    { key: 'almuerzo',  label: 'Comida' },
                    { key: 'colacion2', label: 'Colación' },
                    { key: 'cena',      label: 'Cena' },
                ];
                return tiempos.map(({ key, label }) => ({
                    label,
                    hora:       c24[key]?.hora       ?? c24[`hora${label.replace(' ','')}`]       ?? '',
                    ayer:       c24[key]?.ayer       ?? c24[`ayer${label.replace(' ','')}`]       ?? '',
                    usualmente: c24[key]?.usualmente ?? c24[`usalmente${label.replace(' ','')}`]  ?? '',
                })).filter(r => r.hora || r.ayer || r.usualmente);
            }
            return [];
        })();

        if (habitosRows.length > 0) {
            const { randomUUID } = await import('crypto');
            await prisma.habitoAlimentario.createMany({
                data: habitosRows.map((r, idx) => ({
                    id: randomUUID(),
                    pacienteId: nuevo.id,
                    orden: idx,
                    label: r.label || 'Tiempo',
                    hora: r.hora || '',
                    ayer: r.ayer || '',
                    usualmente: r.usualmente || '',
                }))
            });
            nuevo.habitosAlimentarios = await prisma.habitoAlimentario.findMany({
                where: { pacienteId: nuevo.id },
                orderBy: { orden: 'asc' }
            });
        }

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
                habitosAlimentarios: { orderBy: { orden: 'asc' } },
                antecedentes: true,
                valoraciones: { 
                    where: { deletedAt: null },
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

        const { datosEjercicio: de, habitosAlimentarios: ha, antecedentes: ant, valoraciones: val, ...rest } = paciente;
        
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

        // Default 5 habitos if none exist
        const DEFAULT_HABITOS = [
            { label: 'Desayuno', hora: '', ayer: '', usualmente: '' },
            { label: 'Colación', hora: '', ayer: '', usualmente: '' },
            { label: 'Comida',   hora: '', ayer: '', usualmente: '' },
            { label: 'Colación', hora: '', ayer: '', usualmente: '' },
            { label: 'Cena',     hora: '', ayer: '', usualmente: '' },
        ];

        const mapped = { 
            ...rest,
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
                suplementosDetalle: ant.suplementosDetalle ?? [],
                farmacosDetalle: ant.farmacosDetalle ?? []
            } : {},
            // Return habitos as array (new dynamic format)
            habitos: (ha && ha.length > 0)
                ? ha.map(({ id: _id, pacienteId: _pid, orden: _o, ...fields }) => fields)
                : DEFAULT_HABITOS,
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

        // El frontend puede mandar estatura directamente (campo "estatura") en
        // vez de "talla". Si llega vacía, Prisma truena al intentar parsear el
        // Decimal ("" no es un número válido) — normalizamos a null/float.
        if ('estatura' in data) {
            data.estatura = data.estatura === '' || data.estatura == null ? null : parseFloat(data.estatura);
        }

        // "peso" se destructura arriba para excluirlo de otros usos legacy,
        // pero eso lo tiraba: nunca se reasignaba a `data`, así que un cambio
        // de peso en Editar Paciente jamás se guardaba. Paciente.peso sí
        // existe en el schema, así que lo normalizamos y lo devolvemos a data.
        if (peso !== undefined) {
            data.peso = peso === '' || peso == null ? null : parseFloat(peso);
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
                const existsPhone = await prisma.paciente.findFirst({
                    where: { telefono: { endsWith: targetTel }, id: { not: id } },
                    select: { id: true }
                });
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
                            suplementosDetalle: a.suplementosDetalle ?? undefined,
                            farmacosDetalle: a.farmacosDetalle ?? undefined
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
                            suplementosDetalle: a.suplementosDetalle ?? undefined,
                            farmacosDetalle: a.farmacosDetalle ?? undefined
                        }
                    }
                } : undefined,
            },
            include: {
                datosEjercicio: true,
                antecedentes: true,
                habitosAlimentarios: { orderBy: { orden: 'asc' } }
            }
        });

        // Save habitos as dynamic rows (separate operation: deleteMany + createMany)
        if (habitos !== undefined) {
            const rows = Array.isArray(habitos) ? habitos : [];
            await prisma.habitoAlimentario.deleteMany({ where: { pacienteId: id } });
            if (rows.length > 0) {
                const { randomUUID } = await import('crypto');
                await prisma.habitoAlimentario.createMany({
                    data: rows.map((r, idx) => ({
                        id: randomUUID(),
                        pacienteId: id,
                        orden: idx,
                        label: r.label || 'Tiempo',
                        hora: r.hora || '',
                        ayer: r.ayer || '',
                        usualmente: r.usualmente || '',
                    }))
                });
            }
        }

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
        const data = await prisma.habitoAlimentario.findMany({
            where: { pacienteId: req.params.id },
            orderBy: { orden: 'asc' }
        });
        return ok(res, data || []);
    } catch (err) {
        next(err);
    }
};

export const upsertConsumo = async (req, res, next) => {
    try {
        const habitos = Array.isArray(req.body) ? req.body : [];
        await prisma.habitoAlimentario.deleteMany({ where: { pacienteId: req.params.id } });
        
        let data = [];
        if (habitos.length > 0) {
            const { randomUUID } = await import('crypto');
            await prisma.habitoAlimentario.createMany({
                data: habitos.map((r, idx) => ({
                    id: randomUUID(),
                    pacienteId: req.params.id,
                    orden: idx,
                    label: r.label || 'Tiempo',
                    hora: r.hora || '',
                    ayer: r.ayer || '',
                    usualmente: r.usualmente || '',
                }))
            });
            data = await prisma.habitoAlimentario.findMany({
                where: { pacienteId: req.params.id },
                orderBy: { orden: 'asc' }
            });
        }
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
