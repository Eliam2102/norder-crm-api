import fs from 'fs';
import prisma from '../lib/prisma.js';
import { ok, error } from '../utils/response.js';
import * as pdfService from '../services/pdf.service.js';
import { sendPlanEmail } from '../services/email.service.js';
import { sendPlanWhatsApp } from '../services/whatsapp.service.js';
import {
    attachLegacyBarridoToEmptyMenus,
    materializeMenuEquivalences
} from '../lib/menuEquivalencias.js';
import { collectPlanSpellingIssues } from '../services/spellcheck.service.js';
import { normalizeDeliveryChannels, normalizeOrchestratorChannelStatus } from '../lib/planDelivery.js';
import { mexicoCityDateTimeToUtc } from '../lib/timeZone.js';

export const getMenuPersistenceData = (menuData = {}) => ({
    tipoContenido: menuData.tipoContenido === 'equivalencias' ? 'equivalencias' : 'platillos',
    barridoEquivalencias: menuData.barridoEquivalencias && typeof menuData.barridoEquivalencias === 'object'
        ? menuData.barridoEquivalencias
        : null
});

const findNextCitaForPlan = async (plan) => {
    if (!plan?.pacienteId) return null;
    const futureFilter = { gte: new Date() };

    if (plan.valoracionId) {
        const linked = await prisma.cita.findFirst({
            where: {
                pacienteId: plan.pacienteId,
                valoracionId: plan.valoracionId,
                fecha: futureFilter
            },
            orderBy: { fecha: 'asc' },
            select: { fecha: true }
        });
        if (linked) return linked;
    }

    return prisma.cita.findFirst({
        where: {
            pacienteId: plan.pacienteId,
            fecha: futureFilter
        },
        orderBy: { fecha: 'asc' },
        select: { fecha: true }
    });
};

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
            include: { menus: { orderBy: { orden: 'asc' }, include: { tiemposComida: { orderBy: { orden: 'asc' }, include: { ingredientes: { orderBy: { orden: 'asc' } } } } } } },
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
            include: { menus: { orderBy: { orden: 'asc' }, include: { tiemposComida: { orderBy: { orden: 'asc' }, include: { ingredientes: { orderBy: { orden: 'asc' } } } } } } },
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
            suplementosDetalle,
            ...extra
        } = req.body;

        const kcal = parseFloat((calorias || 0).toString().replace(',', '.'));
        const pP = parseFloat((proteinasPct || 0).toString().replace(',', '.'));
        const cP = parseFloat((carbohidratosPct || 0).toString().replace(',', '.'));
        const gP = parseFloat((grasasPct || 0).toString().replace(',', '.'));

        const proximaDateTime = proximaSesion
            ? mexicoCityDateTimeToUtc(proximaSesion, proximaSesionHora || '00:00')
            : null;

        // Obtener peso del paciente para calcular gr/kg
        let pesoKg = 0;
        if (pacienteId) {
            const ultimaVal = await prisma.valoracion.findFirst({
                where: { pacienteId, deletedAt: null },
                orderBy: { fecha: 'desc' },
                select: { pesoActual: true }
            });
            pesoKg = ultimaVal?.pesoActual ? Number(ultimaVal.pesoActual) : 0;
        }

        const pGr = (kcal * pP / 100) / 4;
        const cGr = (kcal * cP / 100) / 4;
        const gGr = (kcal * gP / 100) / 9;

        // Obtener paciente para el nombre por defecto
        let pacienteNombre = '';
        if (pacienteId) {
            const pac = await prisma.paciente.findUnique({ where: { id: pacienteId }, select: { nombre: true, apellido: true } });
            if (pac) pacienteNombre = `${pac.nombre} ${pac.apellido || ''}`.trim();
        }

        const today = new Date();
        const defaultName = `Plan, ${today.getDate().toString().padStart(2, '0')}/${(today.getMonth() + 1).toString().padStart(2, '0')}/${today.getFullYear()}${pacienteNombre ? `, ${pacienteNombre}` : ''}`;

        // El archivado del plan anterior y la creación de toda la estructura
        // ocurren en una sola transacción. Si falla un menú, tiempo o ingrediente,
        // Prisma revierte también el plan nuevo y conserva activo el anterior.
        const nuevoPlan = await prisma.$transaction(async (tx) => {
            if (pacienteId) {
                await tx.plan.updateMany({
                    where: { pacienteId, estado: 'activo' },
                    data: { estado: 'archivado' }
                });
            }

            const createdPlan = await tx.plan.create({
                data: {
                nombre: nombre || nombrePlan || defaultName,
                tipoPlan: tipoPlan || tipo || 'Balanceada',
                calorias: Math.round(kcal),
                proteinasPct: pP,
                carbohidratosPct: cP,
                grasasPct: gP,
                proteinasKcal: Math.round(kcal * pP / 100),
                carbohidratosKcal: Math.round(kcal * cP / 100),
                grasasKcal: Math.round(kcal * gP / 100),
                proteinasGr: pGr,
                carbohidratosGr: cGr,
                grasasGr: gGr,
                proteinasGrKg: pesoKg > 0 ? pGr / pesoKg : null,
                carbohidratosGrKg: pesoKg > 0 ? cGr / pesoKg : null,
                grasasGrKg: pesoKg > 0 ? gGr / pesoKg : null,
                pacienteId: pacienteId || null,
                valoracionId: valoracionId || null,
                proximaSesion: proximaDateTime,
                notasGenerales: notasGenerales || notas || '',
                suplementosDetalle: suplementosDetalle || [],
                estado: 'activo',
                estadoEnvio: 'pendiente'
                }
            });

            // Inserción anidada limpia
            if (menus && Array.isArray(menus)) {
                for (const [mIdx, mData] of menus.entries()) {
                    const menu = await tx.planMenu.create({
                        data: {
                            planId: createdPlan.id,
                            nombre: mData.nombre || `Menú ${mIdx + 1}`,
                            orden: mIdx + 1,
                            ...getMenuPersistenceData(mData)
                        }
                    });

                    const tiempos = mData.tiempos || mData.tiemposComida || [];
                    for (const [tIdx, tData] of tiempos.entries()) {
                        const tiempo = await tx.planTiempoComida.create({
                            data: {
                                menuId: menu.id,
                                nombre: tData.nombre || 'Comida',
                                barridoTiempoId: tData.barridoTiempoId || null,
                                orden: tIdx + 1,
                                notaPie: tData.nota || tData.notaPie || '',
                                bebida: tData.bebida || null,
                                suplTiempo: tData.suplTiempo || null,
                                suplNotas: tData.suplNotas || null
                            }
                        });

                        if (tData.ingredientes && Array.isArray(tData.ingredientes)) {
                            for (const [iIdx, iData] of tData.ingredientes.entries()) {
                                await tx.planIngrediente.create({
                                    data: {
                                        tiempoComidaId: tiempo.id,
                                        descripcion: iData.descripcion || '',
                                        cantidad: iData.cantidad ? parseFloat(iData.cantidad) : 0,
                                        unidad: (iData.unidad || 'gr').toLowerCase(),
                                        eqCantidad: iData.eqCantidad ? parseFloat(iData.eqCantidad) : 0,
                                        eqGrupo: iData.eqGrupo || '',
                                        platillo: iData.platillo || '',
                                        nota: iData.nota || '',
                                        equivalencias: iData.equivalencias || null,
                                        smaeGrPorEq: iData.smaeGrPorEq ? parseFloat(iData.smaeGrPorEq) : null,
                                        orden: iIdx + 1
                                    }
                                });
                            }
                        }
                    }
                }
            }

            return createdPlan;
        });

        // ─── Auto-captura silenciosa: guarda alimentos/platillos nuevos en BD ──────
        // Se ejecuta en background sin bloquear la respuesta al cliente.
        if (menus && Array.isArray(menus)) {
            (async () => {
                try {
                    // Collect todos los ingredientes e platillos del payload
                    const allIngredientes = [];
                    const platillosMap = {}; // platilloNombre -> {categoria, ingredientes[]}

                    for (const mData of menus) {
                        const tiempos = mData.tiempos || mData.tiemposComida || [];
                        for (const tData of tiempos) {
                            for (const iData of (tData.ingredientes || [])) {
                                allIngredientes.push(iData);
                                if (iData.platillo && iData.platillo.trim() !== '') {
                                    const pName = iData.platillo.trim();
                                    if (!platillosMap[pName]) platillosMap[pName] = { categoria: tData.nombre || 'General', ingredientes: [] };
                                    platillosMap[pName].ingredientes.push(iData);
                                }
                            }
                        }
                    }

                    // 1. Auto-guardar alimentos SMAE personalizados
                    for (const iData of allIngredientes) {
                        const desc = (iData.descripcion || '').trim();
                        if (!desc) continue;
                        const existing = await prisma.alimentoSMAE.findFirst({
                            where: { nombre: { equals: desc, mode: 'insensitive' } },
                            select: { id: true }
                        });
                        if (!existing && iData.eqGrupo && parseFloat(iData.cantidad) > 0) {
                            // Mapear el label de equivalencias al key interno SMAE
                            const LABEL_TO_GRUPO = {
                                'Verduras': 'verduras', 'Frutas': 'frutas',
                                'Cereal s/grasa': 'cerealSinGr', 'C y T sin grasa': 'cerealSinGr',
                                'Cereal c/grasa': 'cerealConGr', 'C y T con grasa': 'cerealConGr',
                                'Leguminosas': 'leguminosas',
                                'AOA Muy Bajo': 'aoaMuyBajo', 'AOA Bajo': 'aoaBajo',
                                'AOA Moderado': 'aoaModerado', 'AOA Alto': 'aoaAlto',
                                'Leche Descrem.': 'lecheDesc', 'Leche Semi': 'lecheSemi',
                                'Leche Entera': 'lecheEntera', 'Leche Azucarada': 'lecheAz',
                                'Grasa s/prot': 'grasaSinProt', 'Grasa c/prot': 'grasaConProt',
                                'Azucar s/grasa': 'azSinGr', 'Azucar c/grasa': 'azConGr',
                            };
                            const grupo = LABEL_TO_GRUPO[iData.eqGrupo] || iData.eqGrupo.toLowerCase().replace(/[^a-z]/g, '') || 'verduras';
                            await prisma.alimentoSMAE.create({
                                data: {
                                    nombre: desc,
                                    grupo,
                                    pesoGramos: parseFloat(iData.cantidad) || 0,
                                    cantidadPorcion: 1,
                                    unidadPorcion: (iData.unidad || 'pz').toLowerCase(),
                                    esPersonalizado: true,
                                    // Guardar grupos adicionales de equivalencia si existen
                                    equivalencias: Array.isArray(iData.equivalencias) && iData.equivalencias.length > 0
                                        ? iData.equivalencias
                                        : null
                                }
                            }).catch(() => { }); // Ignorar errores duplicados sin crashear
                        }
                    }

                    // 2. Auto-guardar platillos con nombre no-genérico
                    for (const [pName, pData] of Object.entries(platillosMap)) {
                        if (!pName || pName.toLowerCase().includes('nuevo platillo')) continue;
                        const existePlatillo = await prisma.platillo.findFirst({
                            where: { nombre: { equals: pName, mode: 'insensitive' } },
                            select: { id: true }
                        });
                        if (!existePlatillo) {
                            await prisma.platillo.create({
                                data: {
                                    nombre: pName,
                                    categoria: pData.categoria,
                                    ingredientes: pData.ingredientes.map(i => ({
                                        descripcion: i.descripcion || '',
                                        cantidad: i.cantidad?.toString() || '0',
                                        unidad: (i.unidad || 'gr').toLowerCase(),
                                        eqCantidad: i.eqCantidad?.toString() || null,
                                        eqGrupo: i.eqGrupo || '',
                                        equivalencias: Array.isArray(i.equivalencias) ? i.equivalencias : [],
                                        smaeGrPorEq: Number(i.smaeGrPorEq) || 0
                                    }))
                                }
                            }).catch(() => { });
                        }
                    }
                } catch (autoErr) {
                    console.warn('[AutoCapture] Error silencioso al guardar alimentos/platillos:', autoErr.message);
                }
            })();
        }
        // ─────────────────────────────────────────────────────────────────────────

        const planFinal = await prisma.plan.findUnique({
            where: { id: nuevoPlan.id },
            include: { menus: { orderBy: { orden: 'asc' }, include: { tiemposComida: { orderBy: { orden: 'asc' }, include: { ingredientes: { orderBy: { orden: 'asc' } } } } } } }
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
                menus: { orderBy: { orden: 'asc' }, include: { tiemposComida: { orderBy: { orden: 'asc' }, include: { ingredientes: { orderBy: { orden: 'asc' } } } } } },
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
        if (plan.valoracionId) {
            const legacyBarrido = await prisma.barridoEquivalencias.findUnique({
                where: { valoracionId: plan.valoracionId }
            });
            attachLegacyBarridoToEmptyMenus(plan, legacyBarrido);
        }
        const nextCita = await findNextCitaForPlan(plan);
        if (nextCita) plan.proximaSesion = nextCita.fecha;
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
            suplementosDetalle,
            ...extra
        } = req.body;

        const kcal = parseFloat((calorias || 0).toString().replace(',', '.'));
        const pP = parseFloat((proteinasPct || 0).toString().replace(',', '.'));
        const cP = parseFloat((carbohidratosPct || 0).toString().replace(',', '.'));
        const gP = parseFloat((grasasPct || 0).toString().replace(',', '.'));

        const dataUpdate = {
            nombre: nombre || nombrePlan,
            tipoPlan: tipoPlan || tipo,
            notasGenerales: notasGenerales || notas,
            suplementosDetalle: suplementosDetalle || []
        };

        // Obtener peso del paciente para calcular gr/kg
        const existingPlan = await prisma.plan.findUnique({ where: { id }, select: { pacienteId: true } });
        let pesoKg = 0;
        if (existingPlan?.pacienteId) {
            const ultimaVal = await prisma.valoracion.findFirst({
                where: { pacienteId: existingPlan.pacienteId, deletedAt: null },
                orderBy: { fecha: 'desc' },
                select: { pesoActual: true }
            });
            pesoKg = ultimaVal?.pesoActual ? Number(ultimaVal.pesoActual) : 0;
        }

        if (!isNaN(kcal)) {
            dataUpdate.calorias = Math.round(kcal);
            if (!isNaN(pP)) {
                const pGr = (kcal * pP / 100) / 4;
                dataUpdate.proteinasPct = pP;
                dataUpdate.proteinasKcal = Math.round(kcal * pP / 100);
                dataUpdate.proteinasGr = pGr;
                dataUpdate.proteinasGrKg = pesoKg > 0 ? pGr / pesoKg : null;
            }
            if (!isNaN(cP)) {
                const cGr = (kcal * cP / 100) / 4;
                dataUpdate.carbohidratosPct = cP;
                dataUpdate.carbohidratosKcal = Math.round(kcal * cP / 100);
                dataUpdate.carbohidratosGr = cGr;
                dataUpdate.carbohidratosGrKg = pesoKg > 0 ? cGr / pesoKg : null;
            }
            if (!isNaN(gP)) {
                const gGr = (kcal * gP / 100) / 9;
                dataUpdate.grasasPct = gP;
                dataUpdate.grasasKcal = Math.round(kcal * gP / 100);
                dataUpdate.grasasGr = gGr;
                dataUpdate.grasasGrKg = pesoKg > 0 ? gGr / pesoKg : null;
            }
        }

        if (proximaSesion) {
            const pDate = mexicoCityDateTimeToUtc(
                proximaSesion,
                proximaSesionHora || '00:00'
            );
            if (pDate) dataUpdate.proximaSesion = pDate;
        }

        // El plan y sus menús se actualizan de forma atómica. Si falla la
        // recreación de cualquier menú, se conservan intactos los anteriores.
        await prisma.$transaction(async (tx) => {
            await tx.plan.update({
                where: { id },
                data: dataUpdate
            });

            if (menus && Array.isArray(menus)) {
                await tx.planMenu.deleteMany({ where: { planId: id } });
                for (const [mIdx, mData] of menus.entries()) {
                    const menu = await tx.planMenu.create({
                        data: {
                            planId: id,
                            nombre: mData.nombre,
                            orden: mIdx + 1,
                            ...getMenuPersistenceData(mData)
                        }
                    });
                    const tiempos = mData.tiempos || mData.tiemposComida || [];
                    for (const [tIdx, tData] of tiempos.entries()) {
                        const tiempo = await tx.planTiempoComida.create({
                            data: { menuId: menu.id, nombre: tData.nombre, barridoTiempoId: tData.barridoTiempoId || null, orden: tIdx + 1, notaPie: tData.nota || tData.notaPie, bebida: tData.bebida || null, suplTiempo: tData.suplTiempo || null, suplNotas: tData.suplNotas || null }
                        });
                        if (tData.ingredientes && Array.isArray(tData.ingredientes)) {
                            for (const [iIdx, iData] of tData.ingredientes.entries()) {
                                await tx.planIngrediente.create({
                                    data: {
                                        tiempoComidaId: tiempo.id,
                                        descripcion: iData.descripcion || '',
                                        cantidad: iData.cantidad ? parseFloat(iData.cantidad) : 0,
                                        unidad: (iData.unidad || 'gr').toLowerCase(),
                                        eqCantidad: iData.eqCantidad ? parseFloat(iData.eqCantidad) : 0,
                                        eqGrupo: iData.eqGrupo || '',
                                        platillo: iData.platillo || '',
                                        nota: iData.nota || '',
                                        equivalencias: iData.equivalencias || null,
                                        smaeGrPorEq: iData.smaeGrPorEq ? parseFloat(iData.smaeGrPorEq) : null,
                                        orden: iIdx + 1
                                    }
                                });
                            }
                        }
                    }
                }
            }
        });

        // ─── Bug #2 fix: Auto-captura silenciosa también en UPDATE ───────────────
        if (menus && Array.isArray(menus)) {
            (async () => {
                try {
                    const allIngredientes = [];
                    const platillosMap = {};

                    for (const mData of menus) {
                        const tiempos = mData.tiempos || mData.tiemposComida || [];
                        for (const tData of tiempos) {
                            for (const iData of (tData.ingredientes || [])) {
                                allIngredientes.push(iData);
                                if (iData.platillo && iData.platillo.trim() !== '') {
                                    const pName = iData.platillo.trim();
                                    if (!platillosMap[pName]) platillosMap[pName] = { categoria: tData.nombre || 'General', ingredientes: [] };
                                    platillosMap[pName].ingredientes.push(iData);
                                }
                            }
                        }
                    }

                    const LABEL_TO_GRUPO = {
                        'Verduras': 'verduras', 'Frutas': 'frutas',
                        'Cereal s/grasa': 'cerealSinGr', 'C y T sin grasa': 'cerealSinGr',
                        'Cereal c/grasa': 'cerealConGr', 'C y T con grasa': 'cerealConGr',
                        'Leguminosas': 'leguminosas',
                        'AOA Muy Bajo': 'aoaMuyBajo', 'AOA Bajo': 'aoaBajo',
                        'AOA Moderado': 'aoaModerado', 'AOA Alto': 'aoaAlto',
                        'Leche Descrem.': 'lecheDesc', 'Leche Semi': 'lecheSemi',
                        'Leche Entera': 'lecheEntera', 'Leche Azucarada': 'lecheAz',
                        'Grasa s/prot': 'grasaSinProt', 'Grasa c/prot': 'grasaConProt',
                        'Azucar s/grasa': 'azSinGr', 'Azucar c/grasa': 'azConGr',
                    };

                    for (const iData of allIngredientes) {
                        const desc = (iData.descripcion || '').trim();
                        if (!desc) continue;
                        const existing = await prisma.alimentoSMAE.findFirst({
                            where: { nombre: { equals: desc, mode: 'insensitive' } },
                            select: { id: true }
                        });
                        if (!existing && iData.eqGrupo && parseFloat(iData.cantidad) > 0) {
                            const grupo = LABEL_TO_GRUPO[iData.eqGrupo] || iData.eqGrupo.toLowerCase().replace(/[^a-z]/g, '') || 'verduras';
                            await prisma.alimentoSMAE.create({
                                data: {
                                    nombre: desc,
                                    grupo,
                                    pesoGramos: parseFloat(iData.cantidad) || 0,
                                    cantidadPorcion: 1,
                                    unidadPorcion: (iData.unidad || 'pz').toLowerCase(),
                                    esPersonalizado: true,
                                    equivalencias: Array.isArray(iData.equivalencias) && iData.equivalencias.length > 0 ? iData.equivalencias : null
                                }
                            }).catch(() => { });
                        }
                    }

                    for (const [pName, pData] of Object.entries(platillosMap)) {
                        if (!pName || pName.toLowerCase().includes('nuevo platillo')) continue;
                        const existePlatillo = await prisma.platillo.findFirst({
                            where: { nombre: { equals: pName, mode: 'insensitive' } },
                            select: { id: true }
                        });
                        if (!existePlatillo) {
                            await prisma.platillo.create({
                                data: {
                                    nombre: pName,
                                    categoria: pData.categoria,
                                    ingredientes: pData.ingredientes.map(i => ({
                                        descripcion: i.descripcion || '',
                                        cantidad: i.cantidad?.toString() || '0',
                                        unidad: (i.unidad || 'gr').toLowerCase(),
                                        eqCantidad: i.eqCantidad?.toString() || null,
                                        eqGrupo: i.eqGrupo || '',
                                        equivalencias: Array.isArray(i.equivalencias) ? i.equivalencias : [],
                                        smaeGrPorEq: Number(i.smaeGrPorEq) || 0
                                    }))
                                }
                            }).catch(() => { });
                        }
                    }
                } catch (autoErr) {
                    console.warn('[AutoCapture/Update] Error silencioso:', autoErr.message);
                }
            })();
        }
        // ─────────────────────────────────────────────────────────────────────────

        const planFinal = await prisma.plan.findUnique({
            where: { id },
            include: { menus: { orderBy: { orden: 'asc' }, include: { tiemposComida: { orderBy: { orden: 'asc' }, include: { ingredientes: { orderBy: { orden: 'asc' } } } } } } }
        });

        return ok(res, planFinal);
    } catch (err) {
        next(err);
    }
};

const enrichPlanForPdf = async (plan, metaOverride = null) => {
    let valoraciones = [];
    if (plan.pacienteId) {

        // 1. Determinar la "máquina del tiempo": límite de fecha para el historial
        let dateLimit = new Date();
        if (plan.valoracionId) {
            const valTarget = await prisma.valoracion.findUnique({
                where: { id: plan.valoracionId },
                select: { fecha: true }
            });
            if (valTarget && valTarget.fecha) {
                dateLimit = valTarget.fecha;
            } else {
                dateLimit = plan.fechaCreacion || new Date();
            }
        } else {
            dateLimit = plan.fechaCreacion || new Date();
        }

        let rawValoraciones = await prisma.valoracion.findMany({
            where: {
                pacienteId: plan.pacienteId,
                deletedAt: null,
                fecha: { lte: dateLimit } // Solo valoraciones hasta esa fecha
            },
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
                bioGrasa: true,
                bioAgua: true,
                bioMusculo: true,
                bioEnergia: true,
                medicionesEstado: true,
                numeroValoracion: true,
                clasificacionIp: true,
                clasifComplexion: true,
                endomorfico: true,
                mesomorfico: true,
                ectomorfico: true,
                suplementacion: true,
                comentarios: true,
                notasLibres: true,
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

        // Fallback: si no hay valoraciones hasta dateLimit (p.ej. la valoración se creó
        // DESPUÉS del plan), re-consultamos sin límite de fecha para que temario,
        // notas clínicas y "evitar" no salgan en blanco en el PDF.
        if (rawValoraciones.length === 0) {
            rawValoraciones = await prisma.valoracion.findMany({
                where: { pacienteId: plan.pacienteId, deletedAt: null },
                orderBy: [{ fecha: 'desc' }, { numeroValoracion: 'desc' }],
                take: 20,
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
                    bioGrasa: true,
                    bioAgua: true,
                    bioMusculo: true,
                    bioEnergia: true,
                    medicionesEstado: true,
                    numeroValoracion: true,
                    clasificacionIp: true,
                    clasifComplexion: true,
                    endomorfico: true,
                    mesomorfico: true,
                    ectomorfico: true,
                    suplementacion: true,
                    comentarios: true,
                    notasLibres: true,
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
        }

        // La valoración de referencia define la modalidad que debe reflejar el
        // reporte. Si el plan no está ligado explícitamente a una valoración,
        // usamos la más reciente disponible dentro de su ventana histórica.
        const valoracionReferencia = (
            (plan.valoracionId && rawValoraciones.find(v => v.id === plan.valoracionId))
            || rawValoraciones[0]
            || null
        );
        plan.consultaEnLinea = valoracionReferencia?.medicionesEstado?.consultaEnLinea === true;
        plan.metodoComposicion = plan.consultaEnLinea
            ? 'FOTOSCOPIA'
            : (
                valoracionReferencia?.medicionesEstado?.metodoComposicion
                || ([valoracionReferencia?.bioGrasa, valoracionReferencia?.bioAgua, valoracionReferencia?.bioMusculo, valoracionReferencia?.bioEnergia]
                    .some(value => value != null)
                    ? 'BIOIMPEDANCIA'
                    : 'ANTROPOMETRIA')
            );

        // Reloj histórico: Solo mostramos las últimas 7.
        valoraciones = rawValoraciones.slice(0, 7);

        // Una fotografía principal por consulta histórica. Se consultan también
        // fotos antiguas sin la bandera principal y se toma la primera como
        // respaldo, sin mezclar imágenes entre valoraciones.
        const valoracionIdsHistoricas = valoraciones.map(v => v.id);
        const fotosHistoricas = valoracionIdsHistoricas.length > 0
            ? await prisma.fotoSeguimiento.findMany({
                where: {
                    pacienteId: plan.pacienteId,
                    valoracionId: { in: valoracionIdsHistoricas }
                },
                orderBy: [
                    { valoracionId: 'asc' },
                    { esPrincipal: 'desc' },
                    { createdAt: 'asc' }
                ]
            })
            : [];
        const fotoPrincipalPorValoracion = new Map();
        for (const foto of fotosHistoricas) {
            if (!fotoPrincipalPorValoracion.has(foto.valoracionId)) {
                fotoPrincipalPorValoracion.set(foto.valoracionId, foto);
            }
        }

        const historicoPlanes = await prisma.plan.findMany({
            where: { pacienteId: plan.pacienteId },
            orderBy: { fechaCreacion: 'desc' },
            select: { calorias: true, valoracionId: true, fechaCreacion: true }
        });

        // La cita local se crea con la hora canónica confirmada por Cal.com.
        // Prioriza la ligada a esta valoración y usa la próxima del paciente
        // únicamente como respaldo.
        const nextCita = await findNextCitaForPlan(plan);
        if (nextCita) {
            plan.proximaSesion = nextCita.fecha;
        }
        // ---------------------------------------------------------


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
            vObj.bioGrasa = toNum(v.bioGrasa);
            vObj.bioAgua = toNum(v.bioAgua);
            vObj.bioMusculo = toNum(v.bioMusculo);
            vObj.bioEnergia = toNum(v.bioEnergia);
            vObj.metodoComposicion = v.medicionesEstado?.metodoComposicion
                || ([v.bioGrasa, v.bioAgua, v.bioMusculo, v.bioEnergia].some(value => value != null)
                    ? 'BIOIMPEDANCIA'
                    : 'ANTROPOMETRIA');

            const fotoPrincipal = fotoPrincipalPorValoracion.get(v.id);
            vObj.fotoPrincipal = fotoPrincipal
                ? `data:${fotoPrincipal.mimeType};base64,${Buffer.from(fotoPrincipal.datos).toString('base64')}`
                : null;

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

            // La energía del plan/barrido se mantiene independiente de la
            // energía medida por bioimpedancia, que tiene su propia fila.
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

    plan.lineamientosRecientes = plan.notasGenerales ? plan.notasGenerales.split('\n').filter(n => n.trim()) : [];


    plan.suplementacionReciente = [];
    plan.suplementosTabla = []; // Tabla completa para PDF (activos + suspendidos)

    // ── Resolver fuente de suplementos con trazabilidad ──────────────────────
    // Prioridad: plan.suplementosDetalle > valoración asociada > texto libre
    let fuenteSupl = [];

    if (plan.suplementosDetalle && Array.isArray(plan.suplementosDetalle) && plan.suplementosDetalle.length > 0) {
        // 1. El plan tiene suplementos guardados directamente
        fuenteSupl = plan.suplementosDetalle;
    } else if (plan.valoracionId) {
        // 2. Buscar en la valoración asociada al plan
        const valConSupl = await prisma.valoracion.findUnique({
            where: { id: plan.valoracionId },
            select: { suplementosDetalle: true, suplementacion: true }
        });
        if (valConSupl?.suplementosDetalle && Array.isArray(valConSupl.suplementosDetalle) && valConSupl.suplementosDetalle.length > 0) {
            fuenteSupl = valConSupl.suplementosDetalle;
        } else if (valConSupl?.suplementacion) {
            // Texto libre de la valoración
            plan.suplementacionReciente.push(...valConSupl.suplementacion.split('\n').filter(s => s.trim()));
        }
    } else if (plan.pacienteId) {
        // 3. Buscar en la valoración más reciente del paciente (fallback)
        const valReciente = await prisma.valoracion.findFirst({
            where: { pacienteId: plan.pacienteId, deletedAt: null },
            orderBy: { fecha: 'desc' },
            select: { suplementosDetalle: true, suplementacion: true }
        });
        if (valReciente?.suplementosDetalle && Array.isArray(valReciente.suplementosDetalle) && valReciente.suplementosDetalle.length > 0) {
            fuenteSupl = valReciente.suplementosDetalle;
        } else if (valReciente?.suplementacion) {
            plan.suplementacionReciente.push(...valReciente.suplementacion.split('\n').filter(s => s.trim()));
        }
    }

    // Fallback final: antecedentes
    if (fuenteSupl.length === 0 && plan.suplementacionReciente.length === 0) {
        if (ultimaVal?.suplementacion) {
            plan.suplementacionReciente.push(...ultimaVal.suplementacion.split('\n').filter(s => s.trim()));
        } else if (antecedentes?.recomendacionSuplementos) {
            plan.suplementacionReciente.push(...antecedentes.recomendacionSuplementos.split('\n').filter(s => s.trim()));
        }
    }

    // ── Construir tabla y lista con trazabilidad ──────────────────────────────
    if (fuenteSupl.length > 0) {
        const calcDuracion = (s) => {
            if (!s.fechaInicio) return '';
            const start = new Date(s.fechaInicio);
            const end = s.activo ? new Date() : (s.fechaFin ? new Date(s.fechaFin) : new Date());
            if (isNaN(start.getTime()) || isNaN(end.getTime())) return '';
            const diffDays = Math.max(1, Math.floor(Math.max(0, end - start) / (1000 * 60 * 60 * 24)));
            const meses = Math.floor(diffDays / 30);
            const extra = diffDays % 30;
            return meses > 0
                ? `${meses} mes${meses > 1 ? 'es' : ''}${extra > 0 ? ' y ' + extra + ' d' : ''}`
                : `${diffDays} día${diffDays > 1 ? 's' : ''}`;
        };

        // Tabla completa — activos primero, luego suspendidos (trazabilidad)
        plan.suplementosTabla = [
            ...fuenteSupl.filter(s => s.activo),
            ...fuenteSupl.filter(s => !s.activo)
        ].map(s => ({
            nombre: s.nombre,
            indicaciones: s.indicaciones || '-',
            activo: s.activo,
            estado: s.activo ? 'ACTIVO' : 'SUSPENDIDO',
            duracion: calcDuracion(s)
        }));

        // Lista legacy para texto plano (solo activos, con duración)
        plan.suplementacionReciente = fuenteSupl
            .filter(s => s.activo)
            .map(s => {
                const dur = calcDuracion(s);
                return `${s.nombre}: ${s.indicaciones || ''}${dur ? ' (' + dur + ')' : ''}`;
            });
    }
    // ─────────────────────────────────────────────────────────────────────────


    plan.temarioReciente = [];
    plan.competenciaReciente = null;
    if (ultimaVal?.temarioConsulta) {
        const compItem = ultimaVal.temarioConsulta.find(t => t.tema === '__COMPETENCIA_NOTES__');
        if (compItem) {
            try {
                const comp = JSON.parse(compItem.detalle || '{}');
                if (comp.antes || comp.durante || comp.despues) plan.competenciaReciente = comp;
            } catch { /* ignora JSON inválido */ }
        }
        plan.temarioReciente = ultimaVal.temarioConsulta
            .filter(t => t.tema !== '__COMPETENCIA_NOTES__')
            .map(t => ({
                tema: t.tema,
                detalle: t.detalle
            }));
    }

    plan.notasClinicasRecientes = ultimaVal?.comentarios || "";
    plan.notasLibresRecientes = ultimaVal?.notasLibres || "";

    // Combinar las restricciones de la consulta asociada con las del expediente.
    let evitarValoracion = ultimaVal?.evitar || '';
    if (plan.valoracionId) {
        const valoracionDelPlan = await prisma.valoracion.findUnique({
            where: { id: plan.valoracionId },
            select: { evitar: true }
        });
        evitarValoracion = valoracionDelPlan?.evitar || evitarValoracion;
    }
    const evitarCandidatos = [
        ...String(evitarValoracion || '').split(/\r?\n/),
        ...String(antecedentes?.alimentosNoGustan || '').split(/\r?\n/)
    ].map(item => item.trim()).filter(Boolean);
    plan.evitarReciente = evitarCandidatos.filter((item, index) =>
        evitarCandidatos.findIndex(candidate => candidate.toLocaleLowerCase('es-MX') === item.toLocaleLowerCase('es-MX')) === index
    );

    // Hidratación: priorizar esqueHidratacion de la valoración asociada al plan,
    // luego el de la valoración más reciente, y antecedentes.agua como dato de expediente.
    let esqueHidratacionVal = null;
    if (plan.valoracionId) {
        const valConHidrat = await prisma.valoracion.findUnique({
            where: { id: plan.valoracionId },
            select: { esqueHidratacion: true }
        });
        esqueHidratacionVal = valConHidrat?.esqueHidratacion || null;
    }
    if (!esqueHidratacionVal && ultimaVal?.esqueHidratacion) {
        esqueHidratacionVal = ultimaVal.esqueHidratacion;
    }
    plan.esqueHidratacionReciente = esqueHidratacionVal || null;
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

    // Compatibilidad hacia atrás: antes del barrido independiente por menú,
    // algunos planes guardaban los tiempos vacíos y las equivalencias únicamente
    // en el barrido de la valoración.
    if (plan.valoracionId) {
        const legacyBarrido = await prisma.barridoEquivalencias.findUnique({
            where: { valoracionId: plan.valoracionId }
        });
        attachLegacyBarridoToEmptyMenus(plan, legacyBarrido);
    }
    materializeMenuEquivalences(plan);

    return { planEnriquecido: plan, valoraciones };
};

export const generatePdf = async (req, res, next) => {
    try {
        let planRow = await prisma.plan.findUniqueOrThrow({
            where: { id: req.params.id },
            include: {
                paciente: true,
                menus: { orderBy: { orden: 'asc' }, include: { tiemposComida: { orderBy: { orden: 'asc' }, include: { ingredientes: { orderBy: { orden: 'asc' } } } } } }
            }
        });

        const { planEnriquecido, valoraciones } = await enrichPlanForPdf(planRow);

        console.log("[generatePdf] Plan ID:", planRow.id, "| proximaSesion:", planRow.proximaSesion);

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
                menus: { orderBy: { orden: 'asc' }, include: { tiemposComida: { orderBy: { orden: 'asc' }, include: { ingredientes: { orderBy: { orden: 'asc' } } } } } }
            }
        });

        const { planEnriquecido, valoraciones } = await enrichPlanForPdf(planRow, metaOverride);
        // Las marcas se agregan únicamente al preview. El PDF oficial y el envío
        // al paciente no pasan por esta propiedad temporal.
        planEnriquecido.spellingPreviewIssues = collectPlanSpellingIssues(planEnriquecido);

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
            } catch (unlinkErr) { }
        });

    } catch (err) {
        next(err);
    }
};

export const sendPlan = async (req, res, next) => {
    try {
        const { id } = req.params;
        const canales = normalizeDeliveryChannels(req.body);
        if (!canales.email && !canales.whatsapp) {
            return error(res, 'Selecciona al menos un medio de envío.', 400);
        }

        // 1. Obtener plan completo con menus > tiempos > ingredientes
        const planRow = await prisma.plan.findUniqueOrThrow({
            where: { id },
            include: {
                menus: {
                    include: {
                        tiemposComida: {
                            include: { ingredientes: { orderBy: { orden: 'asc' } } },
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
        let pdfBuffer;
        try {
            pdfBuffer = await pdfService.generarPlanPDFBuffer(planEnriquecido, paciente, valoraciones);
        } catch (pdfErr) {
            console.error('[sendPlan] Error crítico generando PDF con Puppeteer:', pdfErr);
            return error(res, 'Error interno al generar el PDF del plan. No se pudo enviar.', 500);
        }

        // 5. Enviar correo y WhatsApp mediante N8N Webhook
        const nombreArchivo = `plan-${(planEnriquecido.nombre || 'alimenticio').replace(/ /g, '_')}.pdf`;
        const webhookUrl = process.env.N8N_WEBHOOK_URL;

        let statusMensajes = 'no-definido';
        let n8nResponseText = '';

        if (webhookUrl) {
            try {
                const formData = new FormData();
                formData.append('pdfPlan', new Blob([pdfBuffer], { type: 'application/pdf' }), nombreArchivo);
                formData.append('email', canales.email ? (paciente.email || '') : '');

                let telefonoLimpio = (paciente.telefono || '').replace(/\D/g, '');
                if (telefonoLimpio && telefonoLimpio.length <= 10) {
                    telefonoLimpio = '52' + telefonoLimpio;
                }
                formData.append('telefono', canales.whatsapp ? telefonoLimpio : '');

                formData.append('paciente_nombre', paciente.nombre || '');
                formData.append('plan_nombre', planEnriquecido.nombre || '');
                // Contrato explícito para el workflow de N8N. Los datos del canal
                // desactivado también viajan vacíos por compatibilidad defensiva.
                formData.append('enviar_email', String(canales.email));
                formData.append('enviar_whatsapp', String(canales.whatsapp));
                formData.append('canales', JSON.stringify(canales));

                console.log(`[sendPlan] Preparando envío a N8N: ${webhookUrl}`);
                console.log(`[sendPlan] Tamaño del PDF: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);

                const fileObj = new File([pdfBuffer], nombreArchivo, { type: 'application/pdf' });
                formData.set('pdfPlan', fileObj);

                // Axios post
                const { default: axios } = await import('axios');
                const response = await axios.post(webhookUrl, formData, {
                    headers: {
                        // Axios handles multipart headers automatically when given FormData
                    },
                    maxBodyLength: Infinity,
                    maxContentLength: Infinity
                });

                statusMensajes = 'ok';
                console.log('[sendPlan] PDF y Meta-datos emitidos a N8N Webhook con éxito.');

                // Intento parsear la respuesta por si N8N nos da un reporte de Email/WhatsApp individual
                try {
                    const jsonRes = response.data;
                    n8nResponseText = jsonRes;
                    console.log('[sendPlan] Respuesta N8N detallada:', jsonRes);
                    if (jsonRes && (
                        (canales.email && jsonRes.email === 'error')
                        || (canales.whatsapp && jsonRes.whatsapp === 'error')
                    )) {
                        statusMensajes = 'advertencia';
                    }
                } catch (e) { }

            } catch (err) {
                // Determine if it was an HTTP error or network error
                let errorMsg = err.message;
                if (err.response) {
                    errorMsg = `Status ${err.response.status}: ${JSON.stringify(err.response.data).substring(0, 150)}`;
                } else if (err.request) {
                    errorMsg = `Sin respuesta del servidor (${err.code})`;
                }

                console.error(`[sendPlan] Falló ejecución hacia N8N:`, errorMsg);
                statusMensajes = 'error';
                return error(res, `Fallo al comunicarse con el orquestador (N8N): ${errorMsg}`, 502);
            }
        } else {
            console.warn('[sendPlan] Falló el envío porque N8N_WEBHOOK_URL no está definido en .env');
            return error(res, 'El sistema no tiene configurada la URL del orquestador (N8N).', 500);
        }

        // 6. Marcar como enviado
        const planActualizado = await prisma.plan.update({
            where: { id },
            data: { estadoEnvio: 'enviado', pdfGeneradoAt: new Date() }
        });

        return ok(res, {
            message: 'Plan emitido hacia el orquestador correctamente',
            orquestador: statusMensajes,
            canales,
            email: canales.email
                ? normalizeOrchestratorChannelStatus(n8nResponseText, 'email', statusMensajes)
                : 'omitido',
            whatsapp: canales.whatsapp
                ? normalizeOrchestratorChannelStatus(n8nResponseText, 'whatsapp', statusMensajes)
                : 'omitido',
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
            include: { menus: { orderBy: { orden: 'asc' }, include: { tiemposComida: { orderBy: { orden: 'asc' }, include: { ingredientes: { orderBy: { orden: 'asc' } } } } } } }
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
                        tipoContenido: menu.tipoContenido,
                        barridoEquivalencias: menu.barridoEquivalencias,
                        tiemposComida: {
                            create: menu.tiemposComida.map(t => ({
                                nombre: t.nombre,
                                barridoTiempoId: t.barridoTiempoId,
                                notaPie: t.notaPie,
                                bebida: t.bebida,
                                suplTiempo: t.suplTiempo,
                                suplNotas: t.suplNotas,
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
                                        equivalencias: i.equivalencias,
                                        smaeGrPorEq: i.smaeGrPorEq,
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
