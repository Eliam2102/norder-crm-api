import fs from 'fs';
import prisma from '../lib/prisma.js';
import { ok, error } from '../utils/response.js';
import * as pdfService from '../services/pdf.service.js';
import { sendPlanEmail } from '../services/email.service.js';
import { sendPlanWhatsApp } from '../services/whatsapp.service.js';

export const getAll = async (req, res, next) => {
    try {
        const { pacienteId } = req.params; // Viene si es /api/pacientes/:id/planes
        const { tipo } = req.query;

        let whereClause = {};

        // 1. Prioridad: Si hay un pacienteId en la URL, filtramos solo por él
        if (pacienteId) {
            whereClause = { pacienteId };
        } 
        // 2. Si es /api/planes?tipo=base -> Solo Plantillas (Biblioteca)
        else if (tipo === 'base') {
            whereClause = { pacienteId: null };
        } 
        // 3. Si es /api/planes?tipo=todos -> Todo el historial global
        else if (tipo === 'todos') {
            whereClause = {};
        } 
        // 4. Por defecto en /api/planes -> Solo Plantillas (Seguridad de Biblioteca)
        else {
            whereClause = { pacienteId: null };
        }

        const planes = await prisma.plan.findMany({
            where: whereClause,
            include: { menus: { include: { tiemposComida: { include: { ingredientes: true } } } } },
            orderBy: { fechaCreacion: 'desc' }
        });
        return ok(res, planes);
    } catch (err) {
        next(err);
    }
};

export const getActivo = async (req, res, next) => {
    try {
        const { pacienteId } = req.params;
        const plan = await prisma.plan.findFirst({
            where: { pacienteId, estado: 'activo' },
            include: { menus: { include: { tiemposComida: { include: { ingredientes: true } } } } },
            orderBy: { fechaCreacion: 'desc' }
        });
        return ok(res, plan || {});
    } catch (err) {
        next(err);
    }
};

export const create = async (req, res, next) => {
    try {
        const pacienteId = req.params.pacienteId || req.body.pacienteId || null;
        const { 
            menus, 
            nombre,
            nombrePlan,
            tipoPlan, 
            tipo,
            calorias,
            proteinasPct,
            carbohidratosPct,
            grasasPct,
            proximaSesion,
            proximaSesionHora,
            notasGenerales,
            notas,
            valoracionId,
            ...extra
        } = req.body;
        
        // Si es un plan para un paciente, archivamos los anteriores
        if (pacienteId) {
            await prisma.plan.updateMany({
                where: { pacienteId, estado: 'activo' },
                data: { estado: 'archivado' }
            });
        }

        const kcal = parseFloat((calorias || 0).toString().replace(',', '.'));
        const pP = parseFloat((proteinasPct || 0).toString().replace(',', '.'));
        const cP = parseFloat((carbohidratosPct || 0).toString().replace(',', '.'));
        const gP = parseFloat((grasasPct || 0).toString().replace(',', '.'));

        let proximaDateTime = null;
        if (proximaSesion) {
            proximaDateTime = new Date(`${proximaSesion}T${proximaSesionHora || '00:00'}:00`);
            if (isNaN(proximaDateTime.getTime())) proximaDateTime = null;
        }

        const nuevoPlan = await prisma.plan.create({
            data: {
                nombre: nombre || nombrePlan || 'Plan Sin Título',
                tipoPlan: tipoPlan || tipo || 'Balanceada',
                calorias: Math.round(kcal),
                proteinasPct: pP,
                carbohidratosPct: cP,
                grasasPct: gP,
                proteinasKcal: Math.round(kcal * pP / 100),
                carbohidratosKcal: Math.round(kcal * cP / 100),
                grasasKcal: Math.round(kcal * gP / 100),
                proteinasGr: (kcal * pP / 100) / 4,
                carbohidratosGr: (kcal * cP / 100) / 4,
                grasasGr: (kcal * gP / 100) / 9,
                pacienteId: pacienteId || null,
                valoracionId: valoracionId || null,
                proximaSesion: proximaDateTime,
                notasGenerales: notasGenerales || notas || '',
                estado: 'activo',
                estadoEnvio: 'pendiente'
            }
        });

        // Inserción anidada limpia
        if (menus && Array.isArray(menus)) {
            for (const [mIdx, mData] of menus.entries()) {
                const menu = await prisma.planMenu.create({
                    data: {
                        planId: nuevoPlan.id,
                        nombre: mData.nombre || `Menú ${mIdx + 1}`,
                        orden: mIdx + 1
                    }
                });

                const tiempos = mData.tiempos || mData.tiemposComida || [];
                for (const [tIdx, tData] of tiempos.entries()) {
                    const tiempo = await prisma.planTiempoComida.create({
                        data: {
                            menuId: menu.id,
                            nombre: tData.nombre || 'Comida',
                            orden: tIdx + 1,
                            notaPie: tData.nota || tData.notaPie || ''
                        }
                    });

                    if (tData.ingredientes && Array.isArray(tData.ingredientes)) {
                        for (const [iIdx, iData] of tData.ingredientes.entries()) {
                            await prisma.planIngrediente.create({
                                data: {
                                    tiempoComidaId: tiempo.id,
                                    descripcion: iData.descripcion || '',
                                    cantidad: iData.cantidad ? parseFloat(iData.cantidad) : 0,
                                    unidad: iData.unidad || 'GR',
                                    eqCantidad: iData.eqCantidad ? parseFloat(iData.eqCantidad) : 0,
                                    eqGrupo: iData.eqGrupo || '',
                                    platillo: iData.platillo || '',
                                    nota: iData.nota || '',
                                    orden: iIdx + 1
                                }
                            });
                        }
                    }
                }
            }
        }

        const planFinal = await prisma.plan.findUnique({
            where: { id: nuevoPlan.id },
            include: { menus: { include: { tiemposComida: { include: { ingredientes: true } } } } }
        });

        return ok(res, planFinal, 201);
    } catch (err) {
        next(err);
    }
};

export const getById = async (req, res, next) => {
    try {
        const plan = await prisma.plan.findUniqueOrThrow({
            where: { id: req.params.id },
            include: { 
                menus: { include: { tiemposComida: { include: { ingredientes: true } } } },
                paciente: {
                    include: {
                        valoraciones: {
                            orderBy: { fecha: 'desc' },
                            take: 6
                        }
                    }
                }
            }
        });
        return ok(res, plan);
    } catch (err) {
        next(err);
    }
};

export const update = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { 
            menus, 
            nombre,
            nombrePlan,
            tipoPlan,
            tipo,
            calorias,
            proteinasPct,
            carbohidratosPct,
            grasasPct,
            proximaSesion,
            proximaSesionHora,
            notasGenerales,
            notas,
            ...extra
        } = req.body;

        const kcal = parseFloat((calorias || 0).toString().replace(',', '.'));
        const pP = parseFloat((proteinasPct || 0).toString().replace(',', '.'));
        const cP = parseFloat((carbohidratosPct || 0).toString().replace(',', '.'));
        const gP = parseFloat((grasasPct || 0).toString().replace(',', '.'));

        const dataUpdate = {
            nombre: nombre || nombrePlan,
            tipoPlan: tipoPlan || tipo,
            notasGenerales: notasGenerales || notas
        };

        if (!isNaN(kcal)) {
            dataUpdate.calorias = Math.round(kcal);
            if (!isNaN(pP)) {
                dataUpdate.proteinasPct = pP;
                dataUpdate.proteinasKcal = Math.round(kcal * pP / 100);
                dataUpdate.proteinasGr = (kcal * pP / 100) / 4;
            }
            if (!isNaN(cP)) {
                dataUpdate.carbohidratosPct = cP;
                dataUpdate.carbohidratosKcal = Math.round(kcal * cP / 100);
                dataUpdate.carbohidratosGr = (kcal * cP / 100) / 4;
            }
            if (!isNaN(gP)) {
                dataUpdate.grasasPct = gP;
                dataUpdate.grasasKcal = Math.round(kcal * gP / 100);
                dataUpdate.grasasGr = (kcal * gP / 100) / 9;
            }
        }
        
        if (proximaSesion) {
            let pDate = new Date(`${proximaSesion}T${proximaSesionHora || '00:00'}:00`);
            if (!isNaN(pDate.getTime())) dataUpdate.proximaSesion = pDate;
        }

        // Actualización de Plan
        await prisma.plan.update({
            where: { id },
            data: dataUpdate
        });

        // Si hay menus, recreamos (Garantiza integridad al editar)
        if (menus && Array.isArray(menus)) {
            await prisma.planMenu.deleteMany({ where: { planId: id } });
            for (const [mIdx, mData] of menus.entries()) {
                const menu = await prisma.planMenu.create({
                    data: { planId: id, nombre: mData.nombre, orden: mIdx + 1 }
                });
                const tiempos = mData.tiempos || mData.tiemposComida || [];
                for (const [tIdx, tData] of tiempos.entries()) {
                    const tiempo = await prisma.planTiempoComida.create({
                        data: { menuId: menu.id, nombre: tData.nombre, orden: tIdx + 1, notaPie: tData.nota || tData.notaPie }
                    });
                    if (tData.ingredientes && Array.isArray(tData.ingredientes)) {
                        for (const [iIdx, iData] of tData.ingredientes.entries()) {
                            await prisma.planIngrediente.create({ 
                                data: { 
                                    tiempoComidaId: tiempo.id,
                                    descripcion: iData.descripcion || '',
                                    cantidad: iData.cantidad ? parseFloat(iData.cantidad) : 0,
                                    unidad: iData.unidad || 'GR',
                                    eqCantidad: iData.eqCantidad ? parseFloat(iData.eqCantidad) : 0,
                                    eqGrupo: iData.eqGrupo || '',
                                    platillo: iData.platillo || '',
                                    nota: iData.nota || '',
                                    orden: iIdx + 1
                                } 
                            });
                        }
                    }
                }
            }
        }

        const planFinal = await prisma.plan.findUnique({
            where: { id },
            include: { menus: { include: { tiemposComida: { include: { ingredientes: true } } } } }
        });

        return ok(res, planFinal);
    } catch (err) {
        next(err);
    }
};

const enrichPlanForPdf = async (plan, metaOverride = null) => {
    let valoraciones = [];
    if (plan.pacienteId) {
        let rawValoraciones = await prisma.valoracion.findMany({
            where: { pacienteId: plan.pacienteId },
            orderBy: [{ fecha: 'desc' }, { numeroValoracion: 'desc' }],
            take: 20, // Tomamos más para garantizar 7 únicas después de de-duplicar
            select: { 
                id: true,
                fecha: true, 
                pesoActual: true, 
                estatura: true,
                imc: true, 
                pctGrasaCorp: true,
                pctGrasa2comp: true,
                masaMagra: true, 
                masaGrasaReal: true,
                kgGrasa2comp: true,
                numeroValoracion: true,
                clasificacionIp: true,
                clasifComplexion: true,
                endomorfico: true,
                mesomorfico: true,
                ectomorfico: true,
                suplementacion: true,
                comentarios: true,
                evitar: true,
                temarioConsulta: true,
                barrido: {
                    select: {
                        kcalTotal: true
                    }
                },
                paciente: {
                    select: {
                        complexion: true,
                        datosEjercicio: {
                            select: {
                                objetivo: true
                            }
                        }
                    }
                }
            }
        });
        
        // Ya no de-duplicamos por fecha. Solo mostramos las últimas 7.
        valoraciones = rawValoraciones.slice(0, 7);
        
        const historicoPlanes = await prisma.plan.findMany({
            where: { pacienteId: plan.pacienteId },
            orderBy: { fechaCreacion: 'desc' },
            select: { calorias: true, valoracionId: true, fechaCreacion: true }
        });

        valoraciones = valoraciones.map(v => {
            const vObj = { ...v };
            
            // Helper for Decimal to Number conversion
            const toNum = (val) => {
                if (val == null) return null;
                const n = Number(val);
                return isNaN(n) ? null : n;
            };

            // Mapping results with appropriate fallbacks
            vObj.pesoActual = toNum(v.pesoActual);
            vObj.estatura = toNum(v.estatura);
            vObj.imc = toNum(v.imc);
            
            // Fat fallbacks: 4-comp -> 2-comp
            vObj.pctGrasaCorp = toNum(v.pctGrasaCorp) ?? toNum(v.pctGrasa2comp);
            vObj.masaGrasaReal = toNum(v.masaGrasaReal) ?? toNum(v.kgGrasa2comp);
            vObj.masaMagra = toNum(v.masaMagra);

            let energiaFinal = plan.calorias;
            
            // Prioridad de energía: Ajuste manual en Barrido > Plan asignado > Plan actual del paciente
            if (v.barrido && v.barrido.kcalTotal) {
                energiaFinal = v.barrido.kcalTotal;
            } else {
                let planAsignado = historicoPlanes.find(p => p.valoracionId === v.id);
                if (!planAsignado) {
                    planAsignado = historicoPlanes.find(p => new Date(p.fechaCreacion) >= new Date(v.fecha));
                }
                if (planAsignado) energiaFinal = planAsignado.calorias;
            }

            vObj.energia = toNum(energiaFinal);
            
            // Mapeo de Somatotipo con Fallback según requerimiento
            const hasEndoMesoEcto = v.endomorfico != null || v.mesomorfico != null || v.ectomorfico != null;
            
            if (hasEndoMesoEcto) {
                // 1. Somatotipo calculado (Endo-Meso-Ecto)
                const comps = [
                    v.endomorfico != null ? `${v.endomorfico}` : '?',
                    v.mesomorfico != null ? `${v.mesomorfico}` : '?',
                    v.ectomorfico != null ? `${v.ectomorfico}` : '?'
                ];
                vObj.somatotipo = comps.join('-');
            } else if (v.clasifComplexion || v.clasificacionIp) {
                // 2. Clasificación directa (Complexión o IP)
                vObj.somatotipo = v.clasifComplexion || v.clasificacionIp;
            } else {
                // 3. Fallback a complexión del perfil del paciente (1: Ectomorfo, 2: Mesomorfo, 3: Endomorfo)
                const compPaciente = toNum(v.paciente?.complexion);
                const mapping = { 1: "Ectomorfo", 2: "Mesomorfo", 3: "Endomorfo" };
                vObj.somatotipo = mapping[Math.round(compPaciente)] || "No definido";
            }

            vObj.objetivo = v.paciente?.datosEjercicio?.objetivo || "Estético";
            return vObj;
        });
    }

    let antecedentes = null;
    let ultimaVal = valoraciones.length > 0 ? valoraciones[0] : null;

    if (plan.pacienteId) {
        antecedentes = await prisma.antecedentes.findUnique({
            where: { pacienteId: plan.pacienteId }
        });
    }

    plan.lineamientosRecientes = plan.notasGenerales ? plan.notasGenerales.split('\n').filter(n=>n.trim()) : [];
    
    plan.suplementacionReciente = [];
    if (ultimaVal?.suplementacion) {
        plan.suplementacionReciente.push(...ultimaVal.suplementacion.split('\n').filter(s=>s.trim()));
    } else if (antecedentes?.recomendacionSuplementos) {
        plan.suplementacionReciente.push(...antecedentes.recomendacionSuplementos.split('\n').filter(s=>s.trim()));
    }

    plan.temarioReciente = [];
    if (ultimaVal?.temarioConsulta) {
        plan.temarioReciente = ultimaVal.temarioConsulta.map(t => ({
            tema: t.tema,
            detalle: t.detalle
        }));
    }

    plan.notasClinicasRecientes = ultimaVal?.comentarios || "";

    plan.evitarReciente = [];
    if (ultimaVal?.evitar) {
        plan.evitarReciente = ultimaVal.evitar.split('\n').filter(e => e.trim());
    } else if (antecedentes?.alimentosNoGustan) {
        plan.evitarReciente = [antecedentes.alimentosNoGustan];
    }

    plan.hidratacionReciente = antecedentes?.agua ? [antecedentes.agua] : [];
    
    plan.alimentosPersonales = [];
    if (antecedentes?.alimentosGustan) plan.alimentosPersonales.push("Preferencias: " + antecedentes.alimentosGustan);
    if (antecedentes?.alergias) plan.alimentosPersonales.push("Alergias: " + antecedentes.alergias);

    if (!plan.pdfCustomMeta || typeof plan.pdfCustomMeta !== 'object') {
        plan.pdfCustomMeta = {};
    }
    if (metaOverride) {
        plan.pdfCustomMeta = { ...plan.pdfCustomMeta, ...metaOverride };
    }

    if (!plan.pdfCustomMeta.logoEctomorfo) plan.pdfCustomMeta.logoEctomorfo = "https://norder.mx/assets/ecto.png";
    if (!plan.pdfCustomMeta.logoMesomorfo) plan.pdfCustomMeta.logoMesomorfo = "https://norder.mx/assets/meso.png";
    if (!plan.pdfCustomMeta.logoEndomorfo) plan.pdfCustomMeta.logoEndomorfo = "https://norder.mx/assets/endo.png";

    plan.smaeList = await prisma.alimentoSMAE.findMany({
        where: { esPersonalizado: false },
        orderBy: [{ grupo: 'asc' }, { nombre: 'asc' }]
    });

    return { planEnriquecido: plan, valoraciones };
};

export const generatePdf = async (req, res, next) => {
    try {
        let planRow = await prisma.plan.findUniqueOrThrow({
            where: { id: req.params.id },
            include: { 
                paciente: true,
                menus: { include: { tiemposComida: { include: { ingredientes: true } } } } 
            }
        });

        const { planEnriquecido, valoraciones } = await enrichPlanForPdf(planRow);

        const filePath = await pdfService.generarPlanPDF(planEnriquecido, valoraciones);
        
        const fileNamePart = planEnriquecido.paciente 
            ? planEnriquecido.paciente.nombre.replace(/ /g, '_') 
            : (planEnriquecido.nombre || 'Plantilla').replace(/ /g, '_');

        // Configurar headers para que el navegador lo identifique como PDF y lo abra (inline)
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Plan-${fileNamePart}.pdf`);

        // Stream del archivo al cliente
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);

        // Limpiar archivo temporal después de enviar
        res.on('finish', () => {
            try {
                fs.unlinkSync(filePath);
            } catch (unlinkErr) {
                console.error('Error al borrar PDF temporal:', unlinkErr);
            }
        });

        // Actualizar metadatos del plan (opcional, ya que es al vuelo)
        await prisma.plan.update({
            where: { id: planRow.id },
            data: { pdfGeneradoAt: new Date() }
        });

    } catch (err) {
        next(err);
    }
};

export const generatePdfPreview = async (req, res, next) => {
    try {
        const metaOverride = req.body;
        const planRow = await prisma.plan.findUniqueOrThrow({
            where: { id: req.params.id },
            include: { 
                paciente: true,
                menus: { include: { tiemposComida: { include: { ingredientes: true } } } } 
            }
        });

        const { planEnriquecido, valoraciones } = await enrichPlanForPdf(planRow, metaOverride);

        console.log("PDF PREVIEW - Plan ID:", planRow.id, "Paciente ID:", planRow.pacienteId);
        console.log("Valoraciones obtained:", valoraciones?.length);

        const filePath = await pdfService.generarPlanPDF(planEnriquecido, valoraciones);
        
        const fileNamePart = planEnriquecido.paciente 
            ? planEnriquecido.paciente.nombre.replace(/ /g, '_') 
            : (planEnriquecido.nombre || 'Plantilla').replace(/ /g, '_');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Preview-${fileNamePart}.pdf`);

        const stream = fs.createReadStream(filePath);
        stream.pipe(res);

        res.on('finish', () => {
            try {
                fs.unlinkSync(filePath);
            } catch (unlinkErr) {}
        });

    } catch (err) {
        next(err);
    }
};

export const sendPlan = async (req, res, next) => {
    try {
        const { id } = req.params;

        // 1. Obtener plan completo con menus > tiempos > ingredientes
        const planRow = await prisma.plan.findUniqueOrThrow({
            where: { id },
            include: {
                menus: {
                    include: {
                        tiemposComida: {
                            include: { ingredientes: true },
                            orderBy: { orden: 'asc' }
                        }
                    },
                    orderBy: { orden: 'asc' }
                }
            }
        });

        if (!planRow.pacienteId) {
            return error(res, 'Este plan es una plantilla base y no tiene paciente asignado', 400);
        }

        const paciente = await prisma.paciente.findUniqueOrThrow({
            where: { id: planRow.pacienteId }
        });

        const { planEnriquecido, valoraciones } = await enrichPlanForPdf(planRow);

        // 4. Generar PDF con tabla de progreso enriquecida
        const pdfBuffer = await pdfService.generarPlanPDFBuffer(planEnriquecido, paciente, valoraciones);

        // 5. Enviar correo y WhatsApp mediante N8N Webhook
        const nombreArchivo = `plan-${(planEnriquecido.nombre || 'alimenticio').replace(/ /g, '_')}.pdf`;
        const webhookUrl = process.env.N8N_WEBHOOK_URL;
        
        let statusMensajes = 'no-definido';
        
        if (webhookUrl) {
            try {
                const formData = new FormData();
                formData.append('pdfPlan', new Blob([pdfBuffer], { type: 'application/pdf' }), nombreArchivo);
                formData.append('email', paciente.email || '');

                // Sanitizar teléfono: solo dígitos, sin +, espacios ni guiones
                // Si no tiene lada (menos de 11 dígitos para MX), agregar 52 por default
                let telefonoLimpio = (paciente.telefono || '').replace(/\D/g, '');
                if (telefonoLimpio && telefonoLimpio.length <= 10) {
                    telefonoLimpio = '52' + telefonoLimpio; // agregar lada MX si falta
                }
                formData.append('telefono', telefonoLimpio);

                formData.append('paciente_nombre', paciente.nombre || '');
                formData.append('plan_nombre', planEnriquecido.nombre || '');

                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) throw new Error(`Error N8N: ${response.statusText || response.status}`);
                statusMensajes = 'ok';
                console.log('[sendPlan] PDF y Meta-datos emitidos a N8N Webhook con éxito.');
            } catch (err) {
                console.error(`[sendPlan] Error emitiendo PDF a N8N:`, err.message);
                statusMensajes = 'error';
            }
        } else {
            console.warn('[sendPlan] Falló el envío porque N8N_WEBHOOK_URL no está definido en .env');
        }

        // 6. Marcar como enviado
        const planActualizado = await prisma.plan.update({
            where: { id },
            data: { estadoEnvio: 'enviado', pdfGeneradoAt: new Date() }
        });

        return ok(res, {
            message: 'Plan emitido hacia el orquestador correctamente',
            orquestador: statusMensajes,
            email: statusMensajes,     // frontend backward-compatibility
            whatsapp: statusMensajes,  // frontend backward-compatibility
            plan: planActualizado
        });

    } catch (err) {
        next(err);
    }
};


export const updateEstado = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { estadoEnvio } = req.body;

        const plan = await prisma.plan.update({
            where: { id },
            data: { estadoEnvio }
        });
        return ok(res, plan);
    } catch (err) {
        next(err);
    }
};

export const asignarPlan = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { pacienteId } = req.body;

        // 1. Obtener plan original con toda su estructura
        const original = await prisma.plan.findUniqueOrThrow({
            where: { id },
            include: { menus: { include: { tiemposComida: { include: { ingredientes: true } } } } }
        });

        // Archivar planes anteriores del nuevo paciente
        await prisma.plan.updateMany({
            where: { pacienteId, estado: 'activo' },
            data: { estado: 'archivado' }
        });

        // 2. Crear copia para el nuevo paciente
        const nuevo = await prisma.plan.create({
            data: {
                pacienteId,
                nombre: original.nombre,
                tipoPlan: original.tipoPlan,
                calorias: original.calorias,
                proteinasPct: original.proteinasPct,
                carbohidratosPct: original.carbohidratosPct,
                grasasPct: original.grasasPct,
                proteinasKcal: original.proteinasKcal,
                carbohidratosKcal: original.carbohidratosKcal,
                grasasKcal: original.grasasKcal,
                proteinasGr: original.proteinasGr,
                carbohidratosGr: original.carbohidratosGr,
                grasasGr: original.grasasGr,
                proteinasGrKg: original.proteinasGrKg,
                carbohidratosGrKg: original.carbohidratosGrKg,
                grasasGrKg: original.grasasGrKg,
                getSedentario: original.getSedentario,
                getLeve: original.getLeve,
                getModerado: original.getModerado,
                getIntenso: original.getIntenso,
                notasGenerales: original.notasGenerales,
                estado: 'activo',
                estadoEnvio: 'pendiente',
                pdfCustomMeta: original.pdfCustomMeta,
                valoracionId: req.body.valoracionId || original.valoracionId || null,
                menus: {
                    create: original.menus.map(menu => ({
                        nombre: menu.nombre,
                        orden: menu.orden,
                        tiemposComida: {
                            create: menu.tiemposComida.map(t => ({
                                nombre: t.nombre,
                                notaPie: t.notaPie,
                                orden: t.orden,
                                ingredientes: {
                                    create: t.ingredientes.map(i => ({
                                        descripcion: i.descripcion,
                                        cantidad: i.cantidad,
                                        unidad: i.unidad,
                                        eqCantidad: i.eqCantidad,
                                        eqGrupo: i.eqGrupo,
                                        platillo: i.platillo,
                                        nota: i.nota,
                                        orden: i.orden
                                    }))
                                }
                            }))
                        }
                    }))
                }
            }
        });
        
        return ok(res, nuevo, 201);
    } catch (err) {
        next(err);
    }
};

export const updatePdfMeta = async (req, res, next) => {
    try {
        const { id } = req.params;
        const meta = req.body;
        
        const plan = await prisma.plan.update({
            where: { id },
            data: { pdfCustomMeta: meta }
        });
        
        return ok(res, plan);
    } catch (err) {
        next(err);
    }
};
