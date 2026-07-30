import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { randomUUID } from 'node:crypto';
import prisma from '../lib/prisma.js';
import { normalizarTelefono, getContextoPaciente, hoyMexicoCity } from '../lib/pacienteContext.js';
import {
    buildCheckoutReturnUrls,
    ensureStripeCustomer,
    getLatestCheckoutSessionResult,
    getCheckoutSessionResult,
    normalizeMembershipLevel,
    resolvePublicAppUrl,
    retrieveActiveSubscription,
} from '../services/stripeCheckout.service.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginPortal = async (req, res) => {
    try {
        const { telefono, fechaNacimiento } = req.body;

        if (!telefono || !fechaNacimiento) {
            return res.status(400).json({ error: 'Teléfono y fecha de nacimiento son requeridos.' });
        }

        const tel = normalizarTelefono(telefono);
        const paciente = await prisma.paciente.findFirst({
            where: { telefono: { endsWith: tel } },
            select: {
                id: true,
                nombre: true,
                apellido: true,
                telefono: true,
                fechaNacimiento: true,
                nivelMembresia: true,
                portalActivo: true,
            }
        });

        if (!paciente) {
            return res.status(401).json({ error: 'Teléfono o fecha de nacimiento incorrectos.', codigo: 'credenciales_invalidas' });
        }

        // Comparar fecha de nacimiento (timezone-safe)
        const dbDate = paciente.fechaNacimiento.toISOString().split('T')[0];
        if (dbDate !== fechaNacimiento) {
            return res.status(401).json({ error: 'Teléfono o fecha de nacimiento incorrectos.', codigo: 'credenciales_invalidas' });
        }

        if (!paciente.portalActivo) {
            return res.status(403).json({
                error: 'Tu portal no está activado aún. Contacta a tu nutriólogo.',
                codigo: 'portal_inactivo'
            });
        }

        const token = jwt.sign(
            { sub: paciente.id, telefono: paciente.telefono, type: 'portal' },
            process.env.JWT_SECRET,
            { expiresIn: process.env.PORTAL_JWT_EXPIRES_IN || '30d' }
        );

        return res.json({
            token,
            paciente: {
                id: paciente.id,
                nombre: paciente.nombre,
                apellido: paciente.apellido,
                nivelMembresia: paciente.nivelMembresia,
            }
        });
    } catch (err) {
        console.error('[Portal] loginPortal error:', err);
        return res.status(500).json({ error: 'Error interno. Intenta de nuevo.' });
    }
};

// ─── Plan ─────────────────────────────────────────────────────────────────────

export const getPlan = async (req, res) => {
    try {
        console.log('[Portal] getPlan para pacienteId:', req.paciente.id);

        const plan = await prisma.plan.findFirst({
            where: {
                pacienteId: req.paciente.id,
                estadoEnvio: 'enviado',
            },
            orderBy: { fechaCreacion: 'desc' },
            include: {
                menus: {
                    orderBy: { orden: 'asc' },
                    include: {
                        tiemposComida: {
                            orderBy: { orden: 'asc' },
                            include: {
                                ingredientes: {
                                    orderBy: { orden: 'asc' },
                                    select: {
                                        descripcion: true,
                                        cantidad: true,
                                        unidad: true,
                                        eqCantidad: true,
                                        eqGrupo: true,
                                        nota: true,
                                        platillo: true,
                                        orden: true,
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });

        console.log('[Portal] Plan encontrado:', plan ? plan.nombre : 'NINGUNO');

        if (!plan) return res.json({ plan: null });

        return res.json({
            plan: {
                nombre: plan.nombre,
                calorias: plan.calorias,
                tipoPlan: plan.tipoPlan,
                proteinasPct: plan.proteinasPct,
                carbohidratosPct: plan.carbohidratosPct,
                grasasPct: plan.grasasPct,
                proteinasGr: plan.proteinasGr,
                carbohidratosGr: plan.carbohidratosGr,
                grasasGr: plan.grasasGr,
                notasGenerales: plan.notasGenerales,
                proximaSesion: plan.proximaSesion,
                menus: plan.menus.map(m => ({
                    nombre: m.nombre,
                    tiempos: m.tiemposComida.map(t => ({
                        nombre: t.nombre,
                        nota: t.notaPie || null,
                        bebida: t.bebida || null,
                        ingredientes: (t.ingredientes || []).map(i => ({
                            descripcion: i.descripcion,
                            cantidad: i.cantidad ? Number(i.cantidad) : null,
                            unidad: i.unidad || null,
                            eqCantidad: i.eqCantidad ? Number(i.eqCantidad) : null,
                            eqGrupo: i.eqGrupo || null,
                            nota: i.nota || null,
                            platillo: i.platillo || null,
                        })),
                    }))
                }))
            }
        });
    } catch (err) {
        console.error('[Portal] getPlan error:', err);
        return res.status(500).json({ error: 'Error al obtener el plan.' });
    }
};

// ─── Me ───────────────────────────────────────────────────────────────────────

export const getMe = async (req, res) => {
    try {
        const paciente = await prisma.paciente.findUnique({
            where: { id: req.paciente.id },
            select: {
                id: true,
                nombre: true,
                apellido: true,
                nivelMembresia: true,
                suscripcionFin: true,
                portalActivo: true,
            }
        });

        if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado.' });

        // Últimas 2 valoraciones para calcular progreso y deltas
        const ultimasVals = await prisma.valoracion.findMany({
            where: { pacienteId: req.paciente.id, deletedAt: null },
            orderBy: [{ fecha: 'desc' }, { numeroValoracion: 'desc' }],
            take: 2,
            select: {
                fecha: true,
                pesoActual: true,
                pctGrasaCorp: true,
                pctGrasa2comp: true,
                masaMagra: true,
                masaGrasaReal: true,
                kgGrasa2comp: true,
                imc: true,
                medicionesEstado: true,
            }
        });

        const toNum = (v) => v != null ? Number(v) : null;
        const actual   = ultimasVals[0] || null;
        const anterior = ultimasVals[1] || null;

        const pesoActual       = actual ? toNum(actual.pesoActual) : null;
        const pctGrasaActual   = actual ? (toNum(actual.pctGrasaCorp) ?? toNum(actual.pctGrasa2comp)) : null;
        const masaMagraActual  = actual ? toNum(actual.masaMagra) : null;
        const imcActual        = actual ? toNum(actual.imc) : null;
        const kgGrasaActual    = actual ? (toNum(actual.masaGrasaReal) ?? toNum(actual.kgGrasa2comp)) : null;

        const pesoAnterior      = anterior ? toNum(anterior.pesoActual) : null;
        const pctGrasaAnterior  = anterior ? (toNum(anterior.pctGrasaCorp) ?? toNum(anterior.pctGrasa2comp)) : null;
        const masaMagraAnterior = anterior ? toNum(anterior.masaMagra) : null;

        const delta = anterior ? {
            peso:     pesoActual      != null && pesoAnterior      != null ? +(pesoActual      - pesoAnterior).toFixed(1)      : null,
            pctGrasa: pctGrasaActual  != null && pctGrasaAnterior  != null ? +(pctGrasaActual  - pctGrasaAnterior).toFixed(1)  : null,
            masaMagra:masaMagraActual != null && masaMagraAnterior != null ? +(masaMagraActual - masaMagraAnterior).toFixed(1) : null,
        } : null;

        // Tier gratuito: contar preguntas usadas hoy
        let gratisInfo = {};
        const esTierGratis = !paciente.nivelMembresia || paciente.nivelMembresia === 'ninguna';
        if (esTierGratis) {
            const LIMITE = 5;
            const preguntasHoy = await prisma.mensajePortal.count({
                where: { pacienteId: req.paciente.id, rol: 'user', createdAt: { gte: hoyMexicoCity() } }
            });
            gratisInfo = { preguntasHoy, preguntasRestantes: Math.max(0, LIMITE - preguntasHoy), limiteGratis: LIMITE };
        }

        return res.json({
            ...paciente,
            ...gratisInfo,
            progreso: {
                peso:          pesoActual,
                pctGrasa:      pctGrasaActual,
                masaMagra:     masaMagraActual,
                kgGrasa:       kgGrasaActual,
                imc:           imcActual,
                medicionesEstado: actual?.medicionesEstado || {},
                fechaUltimaVal: actual?.fecha || null,
                delta,
            }
        });
    } catch (err) {
        console.error('[Portal] getMe error:', err);
        return res.status(500).json({ error: 'Error interno.' });
    }
};

// ─── Mensajes (historial) ─────────────────────────────────────────────────────

export const getMensajes = async (req, res) => {
    try {
        const limite = Math.min(parseInt(req.query.limite) || 30, 50);
        const cursor = req.query.cursor;

        const where = { pacienteId: req.paciente.id };
        if (cursor) {
            where.createdAt = { lt: new Date(cursor) };
        }

        const rows = await prisma.mensajePortal.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limite + 1,
            select: { id: true, rol: true, contenido: true, tieneImagen: true, createdAt: true },
        });

        const hasMore = rows.length > limite;
        if (hasMore) rows.pop();
        rows.reverse(); // chronological order

        return res.json({
            mensajes: rows,
            hasMore,
            nextCursor: hasMore ? rows[0].createdAt.toISOString() : null,
        });
    } catch (err) {
        console.error('[Portal] getMensajes error:', err);
        return res.status(500).json({ error: 'Error al obtener historial.' });
    }
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const chat = async (req, res) => {
    try {
        const { mensaje, imagen_base64 } = req.body;

        if (!mensaje?.trim() && !imagen_base64) {
            return res.status(400).json({ error: 'Envía un mensaje o una imagen.' });
        }

        const contexto = await getContextoPaciente({ pacienteId: req.paciente.id });

        if (!contexto.acceso) {
            return res.status(403).json({ error: contexto.mensaje, codigo: contexto.razon });
        }

        const webhookUrl = process.env.N8N_CHAT_WEBHOOK_URL;
        if (!webhookUrl) {
            console.error('[Portal] N8N_CHAT_WEBHOOK_URL no configurada');
            return res.status(503).json({ error: 'Servicio de chat no disponible temporalmente.' });
        }

        // Persistir mensaje del usuario en CRM
        await prisma.mensajePortal.create({
            data: {
                pacienteId: req.paciente.id,
                rol: 'user',
                contenido: mensaje?.trim() || '',
                tieneImagen: !!imagen_base64,
            },
        });

        const { default: axios } = await import('axios');
        const payload = {
            mensaje: mensaje?.trim() || '',
            Numero_Telefono: contexto.paciente?.telefono || contexto.telefono,
            nivelMembresia: contexto.nivelMembresia || 'ninguna',
            planTexto: contexto.planTexto || '',
            tienePlan: !!contexto.tienePlan,
        };
        if (imagen_base64) {
            payload.imagen_base64 = imagen_base64;
        }

        const n8nResponse = await axios.post(webhookUrl, payload, { timeout: 180_000 });

        const respuesta =
            n8nResponse.data?.output ||
            n8nResponse.data?.message ||
            n8nResponse.data?.text ||
            (typeof n8nResponse.data === 'string' ? n8nResponse.data : null) ||
            'Sin respuesta del agente.';

        // Persistir respuesta de Eyder en CRM
        await prisma.mensajePortal.create({
            data: {
                pacienteId: req.paciente.id,
                rol: 'eyder',
                contenido: respuesta,
                tieneImagen: false,
            },
        });

        // Retornar preguntas restantes para tier gratis (para actualizar UI sin re-fetch)
        let chatExtra = {};
        const esGratis = !contexto.nivelMembresia || contexto.nivelMembresia === 'ninguna' || contexto.nivelMembresia === 'gratis';
        if (esGratis) {
            const LIMITE = 5;
            const preguntasHoy = await prisma.mensajePortal.count({
                where: { pacienteId: req.paciente.id, rol: 'user', createdAt: { gte: hoyMexicoCity() } }
            });
            chatExtra = { preguntasRestantes: Math.max(0, LIMITE - preguntasHoy), limiteGratis: LIMITE };
        }

        return res.json({ respuesta, ...chatExtra });
    } catch (err) {
        if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
            return res.status(504).json({ error: 'El agente tardó demasiado en responder. Intenta de nuevo.' });
        }
        console.error('[Portal] chat error:', err);
        return res.status(500).json({ error: 'Error al comunicarse con el agente.' });
    }
};

// ─── Checkout Stripe ──────────────────────────────────────────────────────────

export const crearCheckout = async (req, res) => {
    try {
        const nivel = normalizeMembershipLevel(req.body?.nivel);
        const requestedAttemptId = String(req.body?.attemptId || '');
        const attemptId = /^[a-f0-9-]{16,64}$/i.test(requestedAttemptId)
            ? requestedAttemptId
            : randomUUID();

        const priceMap = {
            basica: process.env.STRIPE_PRICE_BASICA,
            premium: process.env.STRIPE_PRICE_PREMIUM,
        };

        const priceId = priceMap[nivel];
        if (!priceId) {
            return res.status(400).json({ error: 'Nivel inválido. Usa "basica" o "premium".' });
        }

        const paciente = await prisma.paciente.findUnique({
            where: { id: req.paciente.id },
            select: {
                id: true,
                telefono: true,
                email: true,
                nombre: true,
                apellido: true,
                stripeCustomerId: true,
                suscripcionIdExterno: true,
            }
        });

        if (!paciente) return res.status(404).json({ error: 'Paciente no encontrado.' });

        const frontendBase = resolvePublicAppUrl();
        const activeSubscription = await retrieveActiveSubscription({ paciente, stripe });
        if (activeSubscription) {
            const currentLevel = normalizeMembershipLevel(activeSubscription.metadata?.nivel)
                || (
                    activeSubscription.items?.data?.[0]?.price?.id === process.env.STRIPE_PRICE_BASICA
                        ? 'basica'
                        : activeSubscription.items?.data?.[0]?.price?.id === process.env.STRIPE_PRICE_PREMIUM
                            ? 'premium'
                            : null
                );
            if (currentLevel === 'basica' && nivel === 'premium') {
                const subscriptionItem = activeSubscription.items?.data?.[0];
                if (!subscriptionItem?.id) {
                    throw new Error('La suscripción activa no contiene un item actualizable.');
                }
                if (process.env.NODE_ENV === 'production' && !process.env.STRIPE_PORTAL_CONFIGURATION_ID) {
                    throw new Error('STRIPE_PORTAL_CONFIGURATION_ID es obligatoria para actualizar planes.');
                }

                const portalSession = await stripe.billingPortal.sessions.create({
                    customer: activeSubscription.customer,
                    ...(process.env.STRIPE_PORTAL_CONFIGURATION_ID
                        ? { configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID }
                        : {}),
                    locale: 'es',
                    return_url: `${frontendBase}/norder-health`,
                    flow_data: {
                        type: 'subscription_update_confirm',
                        after_completion: {
                            type: 'redirect',
                            redirect: {
                                return_url: `${frontendBase}/norder-health`,
                            },
                        },
                        subscription_update_confirm: {
                            subscription: activeSubscription.id,
                            items: [{
                                id: subscriptionItem.id,
                                price: priceId,
                                quantity: 1,
                            }],
                        },
                    },
                });
                return res.json({
                    url: portalSession.url,
                    flow: 'subscription_update',
                    subscriptionId: activeSubscription.id,
                });
            }

            return res.status(409).json({
                error: 'Ya existe una suscripción activa. No se generó un cobro nuevo.',
                code: 'suscripcion_activa',
                nivelActual: currentLevel,
            });
        }

        const { successUrl, cancelUrl } = buildCheckoutReturnUrls({
            baseUrl: frontendBase,
            nivel,
        });
        const customerId = await ensureStripeCustomer({ paciente, stripe, prisma });
        const metadata = {
            pacienteId: paciente.id,
            telefono: paciente.telefono || '',
            email: paciente.email || '',
            nivel,
            attemptId,
        };

        const session = await stripe.checkout.sessions.create({
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            customer: customerId,
            client_reference_id: paciente.id,
            metadata,
            subscription_data: {
                metadata,
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
            locale: 'es',
            after_expiration: {
                recovery: { enabled: true },
            },
        }, {
            idempotencyKey: `norder-checkout-${paciente.id}-${nivel}-${attemptId}`,
        });

        await prisma.paciente.update({
            where: { id: paciente.id },
            data: { ultimaCheckoutId: session.id },
        });

        return res.json({ url: session.url, sessionId: session.id });
    } catch (err) {
        console.error('[Portal] crearCheckout error:', err);
        const configError = /PUBLIC_APP_URL|STRIPE_PORTAL_CONFIGURATION_ID/.test(String(err?.message || ''));
        return res.status(configError ? 503 : 500).json({
            error: configError
                ? 'Los pagos no están disponibles temporalmente por una configuración pendiente.'
                : 'Error al crear sesión de pago.',
            code: configError ? 'checkout_config_error' : 'checkout_error',
        });
    }
};

export const getCheckoutStatus = async (req, res) => {
    try {
        const result = await getCheckoutSessionResult({
            sessionId: req.params.sessionId,
            pacienteId: req.paciente.id,
            stripe,
            prisma,
        });
        return res.json(result);
    } catch (err) {
        console.error('[Portal] getCheckoutStatus error:', err);
        return res.status(err.statusCode || 500).json({
            error: err.statusCode === 403
                ? err.message
                : 'No se pudo confirmar el estado del pago. Intenta de nuevo.',
            code: err.statusCode === 403 ? 'checkout_forbidden' : 'checkout_status_error',
        });
    }
};

export const getLatestCheckoutStatus = async (req, res) => {
    try {
        const result = await getLatestCheckoutSessionResult({
            pacienteId: req.paciente.id,
            stripe,
            prisma,
        });
        return res.json(result);
    } catch (err) {
        console.error('[Portal] getLatestCheckoutStatus error:', err);
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            error: statusCode === 404
                ? err.message
                : 'No se pudo revisar el último intento de pago.',
            code: statusCode === 404 ? 'checkout_not_found' : 'checkout_status_error',
        });
    }
};

// ─── Activar/Desactivar (staff) ───────────────────────────────────────────────

export const activarPortalManual = async (req, res) => {
    try {
        const { id } = req.params;
        const { activar, nivelMembresia, suscripcionFin } = req.body;

        const data = { portalActivo: Boolean(activar) };
        if (nivelMembresia) data.nivelMembresia = nivelMembresia;
        if (suscripcionFin) data.suscripcionFin = new Date(suscripcionFin);
        if (activar) {
            const actual = await prisma.paciente.findUnique({
                where: { id },
                select: { nivelMembresia: true, suscripcionFin: true }
            });
            // Si no se especifica nivel y el paciente no tenía ninguno, dejar en 'ninguna' (gratis)
            if (!nivelMembresia && !actual?.nivelMembresia) {
                data.nivelMembresia = 'ninguna';
            }
            // Si no tiene suscripcionFin o ya venció, poner +1 año por defecto
            const hoy = new Date();
            if (!suscripcionFin && (!actual?.suscripcionFin || new Date(actual.suscripcionFin) < hoy)) {
                const fin = new Date();
                fin.setFullYear(fin.getFullYear() + 1);
                data.suscripcionFin = fin;
                if (!data.suscripcionInicio) data.suscripcionInicio = hoy;
            }
        }

        const updated = await prisma.paciente.update({ where: { id }, data });
        return res.json({ ok: true, portalActivo: updated.portalActivo, nivelMembresia: updated.nivelMembresia });
    } catch (err) {
        console.error('[Portal] activarPortalManual error:', err);
        return res.status(500).json({ error: 'Error al actualizar portal.' });
    }
};
