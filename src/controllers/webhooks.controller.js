import Stripe from 'stripe';
import prisma from '../lib/prisma.js';
import { normalizarTelefono } from '../lib/pacienteContext.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export const stripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('[Webhook] Stripe signature verification failed:', err.message);
        return res.status(400).json({ error: `Webhook Error: ${err.message}` });
    }

    try {
        if (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.created') {
            const session = event.data.object;

            // Extraer identificador del paciente: metadata.telefono > metadata.email > customer_email
            const telefono = session.metadata?.telefono;
            const email = session.metadata?.email || session.customer_email;

            let where = null;
            if (telefono) {
                const tel = normalizarTelefono(telefono);
                where = { telefono: { endsWith: tel } };
            } else if (email) {
                where = { email: { equals: email, mode: 'insensitive' } };
            }

            if (!where) {
                console.warn('[Webhook] No se encontró identificador de paciente en el evento:', event.id);
                return res.status(200).json({ received: true });
            }

            const paciente = await prisma.paciente.findFirst({ where, select: { id: true } });
            if (!paciente) {
                console.warn('[Webhook] Paciente no encontrado para identificador:', telefono || email);
                return res.status(200).json({ received: true });
            }

            // Determinar fecha de fin de suscripción
            let suscripcionFin = new Date();
            suscripcionFin.setFullYear(suscripcionFin.getFullYear() + 1); // default: +1 año

            if (session.subscription) {
                try {
                    const sub = await stripe.subscriptions.retrieve(session.subscription);
                    if (sub.current_period_end) {
                        suscripcionFin = new Date(sub.current_period_end * 1000);
                    }
                } catch (subErr) {
                    console.warn('[Webhook] No se pudo obtener suscripción de Stripe:', subErr.message);
                }
            }

            await prisma.paciente.update({
                where: { id: paciente.id },
                data: {
                    portalActivo: true,
                    nivelMembresia: 'norder_health',
                    suscripcionInicio: new Date(),
                    suscripcionFin,
                    suscripcionIdExterno: session.subscription || session.payment_intent || null,
                }
            });

            console.log(`[Webhook] Portal activado para paciente ${paciente.id} hasta ${suscripcionFin.toISOString()}`);
        }
    } catch (err) {
        // Siempre 200 — Stripe reintenta si recibe otro código
        console.error('[Webhook] Error procesando evento:', err);
    }

    return res.status(200).json({ received: true });
};
