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

            // Identificar paciente: pacienteId (metadata) > telefono > email
            const pacienteIdMeta = session.metadata?.pacienteId;
            const telefono = session.metadata?.telefono;
            const email = session.metadata?.email || session.customer_email;

            let where = null;
            if (pacienteIdMeta) {
                where = { id: pacienteIdMeta };
            } else if (telefono) {
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
                console.warn('[Webhook] Paciente no encontrado para identificador:', pacienteIdMeta || telefono || email);
                return res.status(200).json({ received: true });
            }

            // Determinar nivel de membresía según el price pagado
            const priceBasica = process.env.STRIPE_PRICE_BASICA;
            const pricePremium = process.env.STRIPE_PRICE_PREMIUM;
            let nivelMembresia = session.metadata?.nivel || 'premium'; // metadata tiene prioridad

            if (!session.metadata?.nivel) {
                // Detectar por price_id de la suscripción o pago único
                let priceId = null;
                if (session.subscription) {
                    try {
                        const sub = await stripe.subscriptions.retrieve(session.subscription);
                        priceId = sub.items?.data?.[0]?.price?.id;
                    } catch {}
                }
                if (!priceId) priceId = session.line_items?.data?.[0]?.price?.id;

                if (priceId === priceBasica) nivelMembresia = 'basica';
                else if (priceId === pricePremium) nivelMembresia = 'premium';
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
                    nivelMembresia,
                    suscripcionInicio: new Date(),
                    suscripcionFin,
                    suscripcionIdExterno: session.subscription || session.payment_intent || null,
                }
            });

            console.log(`[Webhook] Portal activado para paciente ${paciente.id} — nivel: ${nivelMembresia} — hasta ${suscripcionFin.toISOString()}`);
        }
    } catch (err) {
        // Siempre 200 — Stripe reintenta si recibe otro código
        console.error('[Webhook] Error procesando evento:', err);
    }

    return res.status(200).json({ received: true });
};
