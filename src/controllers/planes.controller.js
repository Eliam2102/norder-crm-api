import fs from 'fs';
import prisma from '../lib/prisma.js';
import { ok, error } from '../utils/response.js';
import * as pdfService from '../services/pdf.service.js';

export const getAll = async (req, res, next) => {
    try {
        const { pacienteId } = req.params;
        const { tipo } = req.query;

        let whereClause = {};

        if (tipo === 'base') {
            whereClause = { pacienteId: null };
        } else if (tipo === 'todos') {
            whereClause = {};
        } else if (pacienteId) {
            whereClause = { pacienteId };
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
            tipoPlan, 
            id: _id,
            pacienteId: _pid,
            createdAt,
            updatedAt,
            pdfGeneradoAt,
            pdfUrl,
            estadoEnvio,
            ...rest 
        } = req.body;
        
        // Archivar planes anteriores de la misma valoracion/paciente si aplica (solo si hay paciente)
        if (pacienteId) {
            await prisma.plan.updateMany({
                where: { pacienteId, estado: 'activo' },
                data: { estado: 'archivado' }
            });
        }

        const nuevoPlan = await prisma.plan.create({
            data: {
                ...rest,
                tipoPlan: tipoPlan || 'Sin tipo',
                pacienteId,
                estado: 'activo'
            }
        });

        // Crear Menus
        const menusData = menus || [
            { nombre: 'Menú #1', orden: 1 },
            { nombre: 'Menú #2', orden: 2 }
        ];

        for (const mData of menusData) {
            const menu = await prisma.planMenu.create({
                data: {
                    planId: nuevoPlan.id,
                    nombre: mData.nombre,
                    orden: mData.orden
                }
            });

            // Tiempos default si no vienen
            const tiempos = mData.tiemposComida || [
                { nombre: 'Desayuno', orden: 1 },
                { nombre: 'Colación mañana', orden: 2 },
                { nombre: 'Almuerzo', orden: 3 },
                { nombre: 'Pre-entreno', orden: 4 },
                { nombre: 'Cena', orden: 5 }
            ];

            for (const tData of tiempos) {
                const tiempo = await prisma.planTiempoComida.create({
                    data: {
                        menuId: menu.id,
                        nombre: tData.nombre,
                        orden: tData.orden,
                        notaPie: tData.notaPie
                    }
                });

                if (tData.ingredientes) {
                    for (const iData of tData.ingredientes) {
                        await prisma.planIngrediente.create({
                            data: {
                                ...iData,
                                tiempoComidaId: tiempo.id
                            }
                        });
                    }
                }
            }
        }

        const planCompleto = await prisma.plan.findUnique({
            where: { id: nuevoPlan.id },
            include: { menus: { include: { tiemposComida: { include: { ingredientes: true } } } } }
        });

        return ok(res, planCompleto, 201);
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
            id: _id,
            pacienteId,
            createdAt,
            updatedAt,
            pdfGeneradoAt,
            pdfUrl,
            ...rest 
        } = req.body;

        // Si hay menus en el update, recreamos la estructura
        if (menus) {
            await prisma.planMenu.deleteMany({ where: { planId: id } });
            for (const mData of menus) {
                const menu = await prisma.planMenu.create({
                    data: { planId: id, nombre: mData.nombre, orden: mData.orden }
                });
                for (const tData of mData.tiemposComida) {
                    const tiempo = await prisma.planTiempoComida.create({
                        data: { menuId: menu.id, nombre: tData.nombre, orden: tData.orden, notaPie: tData.notaPie }
                    });
                    for (const iData of tData.ingredientes) {
                        await prisma.planIngrediente.create({ data: { ...iData, tiempoComidaId: tiempo.id } });
                    }
                }
            }
        }

        const updated = await prisma.plan.update({
            where: { id },
            data: rest
        });

        return ok(res, updated);
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
        
        // Configurar headers para que el navegador lo identifique como PDF y lo abra (inline)
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename=Plan-${plan.paciente.nombre.replace(/ /g, '_')}.pdf`);

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
                notasGenerales: original.notasGenerales,
                estado: 'activo',
                estadoEnvio: 'pendiente',
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
