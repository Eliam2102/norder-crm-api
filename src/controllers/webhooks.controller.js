import Stripe from 'stripe';
import prisma from '../lib/prisma.js';
import { processStripeEvent } from '../services/stripeCheckout.service.js';

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
        const result = await processStripeEvent({ event, stripe, prisma });
        return res.status(200).json({ received: true, duplicate: Boolean(result?.duplicate) });
    } catch (err) {
        // Un 5xx permite que Stripe reintente. El evento se procesa de forma idempotente.
        console.error(`[Webhook] Error procesando evento ${event.id}:`, err);
        return res.status(500).json({ received: false, error: 'No se pudo procesar el evento.' });
    }
};
