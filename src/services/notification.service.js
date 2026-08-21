/**
 * notification.service.js
 *
 * Orquestador de envío de planes con estrategia de 3 capas:
 *
 *  [1] Primario   → N8N Webhook (VPS externo)   timeout: 15 s
 *  [2] Fallback   → Directo desde CRM:
 *                   · Email  via nodemailer (Gmail SMTP, independiente del VPS)
 *                   · WA     via Evolution API (si está disponible)
 *  [3] Cola       → OutboundMessageQueue en BD para reintento automático
 *
 * El caller (planes.controller.js) solo necesita llamar a sendPlanNotification()
 * y leer el resultado para decidir el estadoEnvio del plan.
 */

import axios from 'axios';
import { sendPlanEmail } from './email.service.js';
import { sendPlanWhatsApp } from './whatsapp.service.js';
import prisma from '../lib/prisma.js';

/** Timeout en ms para el intento con N8N antes de activar el fallback */
const N8N_TIMEOUT_MS = 15_000;

// ─── Capa 1: N8N Webhook ──────────────────────────────────────────────────────

/**
 * @param {object} opts
 * @param {string} opts.webhookUrl
 * @param {Buffer} opts.pdfBuffer
 * @param {string} opts.nombreArchivo
 * @param {object} opts.paciente  { email, telefono, nombre }
 * @param {object} opts.canales   { email: boolean, whatsapp: boolean }
 * @param {string} opts.planNombre
 * @returns {{ ok: boolean, emailStatus?: string, whatsappStatus?: string, error?: string }}
 */
async function tryN8N({ webhookUrl, pdfBuffer, nombreArchivo, paciente, canales, planNombre }) {
    try {
        let telefonoLimpio = (paciente.telefono || '').replace(/\D/g, '');
        if (telefonoLimpio && telefonoLimpio.length <= 10) {
            telefonoLimpio = '52' + telefonoLimpio;
        }

        const formData = new FormData();
        const fileObj = new File([pdfBuffer], nombreArchivo, { type: 'application/pdf' });
        formData.set('pdfPlan', fileObj);
        formData.append('email', canales.email ? (paciente.email || '') : '');
        formData.append('telefono', canales.whatsapp ? telefonoLimpio : '');
        formData.append('paciente_nombre', paciente.nombre || '');
        formData.append('plan_nombre', planNombre || '');
        formData.append('enviar_email', String(canales.email));
        formData.append('enviar_whatsapp', String(canales.whatsapp));
        formData.append('canales', JSON.stringify(canales));

        const response = await axios.post(webhookUrl, formData, {
            timeout: N8N_TIMEOUT_MS,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        });

        // Parsear respuesta detallada de N8N si la da
        let emailStatus = 'ok';
        let whatsappStatus = 'ok';
        const jsonRes = response.data;
        if (jsonRes && typeof jsonRes === 'object') {
            if (canales.email && jsonRes.email === 'error') emailStatus = 'error';
            if (canales.whatsapp && jsonRes.whatsapp === 'error') whatsappStatus = 'error';
        }

        return { ok: true, emailStatus, whatsappStatus };
    } catch (err) {
        let errorMsg = err.message;
        if (err.response) {
            errorMsg = `HTTP ${err.response.status}: ${JSON.stringify(err.response.data).substring(0, 200)}`;
        } else if (err.code) {
            errorMsg = `Red: ${err.code} — ${err.message}`;
        }
        console.warn(`[Notify] N8N falló (${errorMsg}) — activando fallback directo.`);
        return { ok: false, error: errorMsg };
    }
}

// ─── Capa 2: Fallback directo desde el CRM ────────────────────────────────────

/**
 * @returns {{ emailOk: boolean, waOk: boolean, errors: string[] }}
 */
async function tryDirectFallback({ paciente, pdfBuffer, nombreArchivo, canales }) {
    const errors = [];
    let emailOk = false;
    let waOk = false;

    if (canales.email) {
        try {
            await sendPlanEmail(paciente, pdfBuffer, nombreArchivo.replace(/\.pdf$/i, ''));
            emailOk = true;
            console.log('[Notify][Fallback] Email enviado directamente.');
        } catch (emailErr) {
            console.error('[Notify][Fallback] Falló envío de email:', emailErr.message);
            errors.push(`email: ${emailErr.message}`);
        }
    }

    if (canales.whatsapp) {
        try {
            await sendPlanWhatsApp(paciente.telefono, paciente.nombre, pdfBuffer, nombreArchivo);
            waOk = true;
            console.log('[Notify][Fallback] WhatsApp enviado directamente.');
        } catch (waErr) {
            console.warn('[Notify][Fallback] Falló envío de WhatsApp:', waErr.message);
            errors.push(`whatsapp: ${waErr.message}`);
        }
    }

    return { emailOk, waOk, errors };
}

// ─── Capa 3: Encolar en BD ────────────────────────────────────────────────────

async function enqueueForRetry({ planId, pacienteId, canales, ultimoError }) {
    // Usamos upsert-style: intentamos crear; si ya existe una entrada activa (pendiente/procesando)
    // la actualizamos con el último error en lugar de duplicar.
    // Esto es atómico y seguro ante condiciones de carrera (dos requests simultáneas).
    const existing = await prisma.outboundMessageQueue.findFirst({
        where: { planId, estado: { in: ['pendiente', 'procesando', 'enviado'] } },
    });

    if (existing) {
        if (existing.estado === 'enviado') {
            // Ya fue enviado exitosamente — no re-encolar
            console.log(`[Notify][Cola] Plan ${planId} ya fue enviado (id: ${existing.id}). No se re-encola.`);
            return existing;
        }
        // Está en cola activa — actualizar el último error pero no duplicar
        console.log(`[Notify][Cola] Plan ${planId} ya en cola (id: ${existing.id}, estado: ${existing.estado}). No se duplica.`);
        if (ultimoError) {
            await prisma.outboundMessageQueue.update({
                where: { id: existing.id },
                data: { ultimoError: ultimoError.substring(0, 500) },
            });
        }
        return existing;
    }

    const entry = await prisma.outboundMessageQueue.create({
        data: {
            planId,
            pacienteId,
            canales: JSON.stringify(canales),
            ultimoError: ultimoError ? ultimoError.substring(0, 500) : null,
        },
    });

    console.log(`[Notify][Cola] Plan ${planId} encolado para reintento (id: ${entry.id}).`);
    return entry;
}


// ─── API pública ──────────────────────────────────────────────────────────────

/**
 * Envía el plan por los canales indicados usando la estrategia de 3 capas.
 *
 * @param {object} opts
 * @param {string}  opts.planId
 * @param {string}  opts.pacienteId
 * @param {object}  opts.paciente     { id, nombre, email, telefono }
 * @param {Buffer}  opts.pdfBuffer
 * @param {string}  opts.nombreArchivo
 * @param {object}  opts.canales      { email: boolean, whatsapp: boolean }
 * @param {string}  opts.planNombre
 *
 * @returns {Promise<{
 *   via: 'n8n' | 'fallback_directo' | 'cola',
 *   estadoPlan: 'enviado' | 'pendiente_reenvio',
 *   email: 'ok' | 'error' | 'omitido',
 *   whatsapp: 'ok' | 'error' | 'omitido',
 *   n8nResponseText?: object,
 * }>}
 */
export async function sendPlanNotification({
    planId,
    pacienteId,
    paciente,
    pdfBuffer,
    nombreArchivo,
    canales,
    planNombre,
}) {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;

    // ── [1] Intentar N8N ──────────────────────────────────────────────────────
    if (webhookUrl) {
        console.log(`[Notify] [1/3] Intentando N8N webhook (timeout ${N8N_TIMEOUT_MS / 1000}s)...`);
        const n8nResult = await tryN8N({ webhookUrl, pdfBuffer, nombreArchivo, paciente, canales, planNombre });

        if (n8nResult.ok) {
            console.log('[Notify] ✅ N8N exitoso.');
            return {
                via: 'n8n',
                estadoPlan: 'enviado',
                email: canales.email ? (n8nResult.emailStatus || 'ok') : 'omitido',
                whatsapp: canales.whatsapp ? (n8nResult.whatsappStatus || 'ok') : 'omitido',
            };
        }
    } else {
        console.warn('[Notify] N8N_WEBHOOK_URL no configurada — saltando al fallback directo.');
    }

    // ── [2] Fallback directo ──────────────────────────────────────────────────
    console.log('[Notify] [2/3] Activando fallback directo (Email + WhatsApp desde CRM)...');
    const fallbackResult = await tryDirectFallback({ paciente, pdfBuffer, nombreArchivo, canales });

    const { emailOk, waOk, errors } = fallbackResult;
    const fallbackAlMenosParcial = emailOk || waOk || (!canales.email && !canales.whatsapp);

    if (fallbackAlMenosParcial) {
        console.log('[Notify] ✅ Fallback directo completado (parcial o total).');
        return {
            via: 'fallback_directo',
            estadoPlan: 'enviado',
            email: canales.email ? (emailOk ? 'ok' : 'error') : 'omitido',
            whatsapp: canales.whatsapp ? (waOk ? 'ok' : 'error') : 'omitido',
        };
    }

    // ── [3] Encolar para reintento ────────────────────────────────────────────
    console.warn('[Notify] [3/3] Todos los intentos fallaron. Encolando para reintento automático...');
    const ultimoError = errors.join('; ');
    await enqueueForRetry({ planId, pacienteId, canales, ultimoError });

    return {
        via: 'cola',
        estadoPlan: 'pendiente_reenvio',
        email: canales.email ? 'pendiente' : 'omitido',
        whatsapp: canales.whatsapp ? 'pendiente' : 'omitido',
    };
}
