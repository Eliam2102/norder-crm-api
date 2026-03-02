import fs from 'fs';
import prisma from '../lib/prisma.js';
import { ok, error } from '../utils/response.js';
import * as pdfService from '../services/pdf.service.js';

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
            include: { menus: { include: { tiemposComida: { include: { ingredientes: true } } } } }
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

export const generatePdf = async (req, res, next) => {
    try {
        const plan = await prisma.plan.findUniqueOrThrow({
            where: { id: req.params.id },
            include: { 
                paciente: true,
                menus: { include: { tiemposComida: { include: { ingredientes: true } } } } 
            }
        });

        const filePath = await pdfService.generarPlanPDF(plan);
        
        const fileNamePart = plan.paciente 
            ? plan.paciente.nombre.replace(/ /g, '_') 
            : (plan.nombre || 'Plantilla').replace(/ /g, '_');

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
            where: { id: plan.id },
            data: { pdfGeneradoAt: new Date() }
        });

    } catch (err) {
        next(err);
    }
};

export const sendPlan = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { metodo } = req.body; // 'whatsapp' o 'email'

        if (metodo !== 'whatsapp') {
            return error(res, 'Solo el método "whatsapp" está habilitado por el momento', 400);
        }

        // Simulación: debido a que se eliminó el servicio de whatsapp como pedido,
        // este endpoint marcará el estado ficticiamente sin enviar nada.
        
        await prisma.plan.update({
            where: { id },
            data: { estadoEnvio: 'enviado', pdfGeneradoAt: new Date() }
        });

        return ok(res, { message: 'Plan marcado como enviado (simulación sin WhatsApp)' });
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
