/**
 * notificationWorker.js
 *
 * Worker cron que procesa la OutboundMessageQueue cada POLL_INTERVAL_MS.
 * Se inicializa desde app.js al arrancar el servidor.
 *
 * Estrategia de reintento:
 *  - Lee entradas con estado = 'pendiente' e intentos < maxIntentos
 *  - Para cada una: regenera el PDF y reintenta fallback directo (Email + WA)
 *  - En éxito: estado → 'enviado', actualiza estadoEnvio del Plan
 *  - En fallo: incrementa intentos, guarda ultimoError
 *  - Si intentos >= maxIntentos: estado → 'error' (requiere intervención manual)
 */

import prisma from '../lib/prisma.js';
import { sendPlanEmail } from '../services/email.service.js';
import { sendPlanWhatsApp } from '../services/whatsapp.service.js';
import * as pdfService from '../services/pdf.service.js';
import { enrichPlanForPdf } from '../controllers/planes.controller.js';

/** Intervalo entre ejecuciones del worker (5 minutos) */
const POLL_INTERVAL_MS = 5 * 60 * 1000;

/** Cuántas entradas procesar por ciclo (evita picos de CPU/BD) */
const BATCH_SIZE = 5;

// ─── Procesamiento de un item de la cola ─────────────────────────────────────

async function processQueueItem(item) {
    const canales = JSON.parse(item.canales);
    const planId = item.planId;

    // Calcular cuánto tiempo lleva esperando para el log
    const minutosEsperando = Math.round((Date.now() - new Date(item.creadoEn).getTime()) / 60000);
    const tiempoEsperando = minutosEsperando < 60
        ? `${minutosEsperando} min`
        : minutosEsperando < 1440
            ? `${Math.round(minutosEsperando / 60)}h`
            : `${Math.round(minutosEsperando / 1440)}d`;

    console.log(`[Worker] Procesando item ${item.id} | Plan ${planId} | Intento ${item.intentos + 1} | En cola hace: ${tiempoEsperando}`);


    // Marcar como "procesando" para evitar procesamiento concurrente
    await prisma.outboundMessageQueue.update({
        where: { id: item.id },
        data: { estado: 'procesando' },
    });

    let emailOk = false;
    let waOk = false;
    const errors = [];

    try {
        // 1. Cargar plan y paciente desde BD
        const planRow = await prisma.plan.findUniqueOrThrow({
            where: { id: planId },
            include: {
                menus: {
                    include: {
                        tiemposComida: {
                            include: { ingredientes: { orderBy: { orden: 'asc' } } },
                            orderBy: { orden: 'asc' },
                        },
                    },
                    orderBy: { orden: 'asc' },
                },
            },
        });

        const paciente = await prisma.paciente.findUniqueOrThrow({
            where: { id: item.pacienteId },
        });

        // 2. Regenerar PDF
        const { planEnriquecido, valoraciones } = await enrichPlanForPdf(planRow);
        const pdfBuffer = await pdfService.generarPlanPDFBuffer(planEnriquecido, paciente, valoraciones);
        const nombreArchivo = `plan-${(planEnriquecido.nombre || 'alimenticio').replace(/ /g, '_')}.pdf`;

        // 3. Intentar envíos directos
        if (canales.email) {
            try {
                await sendPlanEmail(paciente, pdfBuffer, planEnriquecido.nombre);
                emailOk = true;
            } catch (e) {
                console.error(`[Worker] Email falló para plan ${planId}:`, e.message);
                errors.push(`email: ${e.message}`);
            }
        }

        if (canales.whatsapp) {
            try {
                await sendPlanWhatsApp(paciente.telefono, paciente.nombre, pdfBuffer, nombreArchivo);
                waOk = true;
            } catch (e) {
                console.warn(`[Worker] WA falló para plan ${planId}:`, e.message);
                errors.push(`whatsapp: ${e.message}`);
            }
        }
    } catch (err) {
        console.error(`[Worker] Error crítico procesando item ${item.id}:`, err.message);
        errors.push(`crítico: ${err.message}`);
    }

    const nuevoIntento = item.intentos + 1;
    const exito = emailOk || waOk || (!canales.email && !canales.whatsapp);

    if (exito) {
        // ✅ Al menos un canal tuvo éxito
        await prisma.outboundMessageQueue.update({
            where: { id: item.id },
            data: { estado: 'enviado', intentos: nuevoIntento, ultimoError: null },
        });
        // Actualizar estadoEnvio del plan
        await prisma.plan.update({
            where: { id: planId },
            data: { estadoEnvio: 'enviado', pdfGeneradoAt: new Date() },
        });
        console.log(`[Worker] ✅ Item ${item.id} enviado exitosamente.`);
    } else if (nuevoIntento >= item.maxIntentos) {
        // ❌ Agotados los intentos
        await prisma.outboundMessageQueue.update({
            where: { id: item.id },
            data: {
                estado: 'error',
                intentos: nuevoIntento,
                ultimoError: errors.join('; ').substring(0, 500),
            },
        });
        await prisma.plan.update({
            where: { id: planId },
            data: { estadoEnvio: 'error_envio' },
        });
        console.error(`[Worker] ❌ Item ${item.id} agotó ${item.maxIntentos} intentos. Requiere intervención manual.`);
    } else {
        // 🔄 Volver a pendiente para el próximo ciclo
        await prisma.outboundMessageQueue.update({
            where: { id: item.id },
            data: {
                estado: 'pendiente',
                intentos: nuevoIntento,
                ultimoError: errors.join('; ').substring(0, 500),
            },
        });
        console.log(`[Worker] 🔄 Item ${item.id} volverá a intentarse. Intento ${nuevoIntento}/${item.maxIntentos}`);
    }
}

// ─── Ciclo principal ──────────────────────────────────────────────────────────

/** Pausa entre mensajes del mismo batch para no saturar Puppeteer/Evo API */
const DELAY_BETWEEN_ITEMS_MS = 3_000;

/** Si un ítem lleva más de este tiempo en 'procesando', se considera atascado */
const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutos

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function recoverStuckItems() {
    // Ítems que quedaron en 'procesando' por crash/reinicio del servidor
    const stuckBefore = new Date(Date.now() - STUCK_THRESHOLD_MS);
    const stuck = await prisma.outboundMessageQueue.updateMany({
        where: {
            estado: 'procesando',
            actualizadoEn: { lt: stuckBefore },
        },
        data: {
            estado: 'pendiente',
            ultimoError: 'Recuperado tras reinicio o crash del servidor.',
        },
    });
    if (stuck.count > 0) {
        console.log(`[Worker] 🔧 Recuperados ${stuck.count} ítem(s) atascados en 'procesando'.`);
    }
}

async function runWorkerCycle() {
    // 1. Recuperar ítems atascados primero
    try {
        await recoverStuckItems();
    } catch (err) {
        console.error('[Worker] Error recuperando ítems atascados:', err.message);
    }

    // 2. Traer ítems pendientes donde intentos < maxIntentos (columna del propio row)
    let pendientes;
    try {
        pendientes = await prisma.outboundMessageQueue.findMany({
            where: {
                estado: 'pendiente',
            },
            orderBy: { creadoEn: 'asc' },
            take: BATCH_SIZE,
        });
    } catch (err) {
        console.error('[Worker] Error consultando la cola:', err.message);
        return;
    }

    if (pendientes.length === 0) return; // Silencioso cuando no hay nada

    console.log(`[Worker] 🔔 Procesando ${pendientes.length} mensaje(s) pendiente(s)...`);

    for (const item of pendientes) {
        // Filtrar aquí (en JS) usando el maxIntentos real del row
        if (item.intentos >= item.maxIntentos) {
            await prisma.outboundMessageQueue.update({
                where: { id: item.id },
                data: { estado: 'error', ultimoError: 'Máximo de intentos alcanzado.' },
            });
            console.warn(`[Worker] ⚠️  Item ${item.id} alcanzó el máximo de intentos (${item.maxIntentos}). Marcado como error.`);
            continue;
        }

        await processQueueItem(item);

        // Delay entre ítems para no saturar Puppeteer ni Evo API
        await sleep(DELAY_BETWEEN_ITEMS_MS);
    }
}


// ─── Inicialización ───────────────────────────────────────────────────────────

let workerInterval = null;

export function startNotificationWorker() {
    if (workerInterval) return; // Idempotente

    console.log(`[Worker] 🚀 NotificationWorker iniciado (ciclo cada ${POLL_INTERVAL_MS / 60000} min).`);

    // Primer ciclo al iniciar (con delay de 30s para que el servidor arranque completo)
    setTimeout(() => {
        runWorkerCycle().catch(err => console.error('[Worker] Error en ciclo inicial:', err.message));
    }, 30_000);

    workerInterval = setInterval(() => {
        runWorkerCycle().catch(err => console.error('[Worker] Error en ciclo periódico:', err.message));
    }, POLL_INTERVAL_MS);
}

export function stopNotificationWorker() {
    if (workerInterval) {
        clearInterval(workerInterval);
        workerInterval = null;
        console.log('[Worker] NotificationWorker detenido.');
    }
}
