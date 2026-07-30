import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildCheckoutReturnUrls,
    fulfillCheckoutSession,
    getCheckoutSessionResult,
    getSubscriptionPeriod,
    normalizeMembershipLevel,
    processStripeEvent,
    resolvePublicAppUrl,
    retrieveActiveSubscription,
    syncSubscription,
} from './stripeCheckout.service.js';

const env = {
    NODE_ENV: 'production',
    PUBLIC_APP_URL: 'https://crm-norder-health.vercel.app/',
    STRIPE_PRICE_BASICA: 'price_basic',
    STRIPE_PRICE_PREMIUM: 'price_premium',
};

const subscription = {
    id: 'sub_123',
    status: 'active',
    customer: 'cus_123',
    metadata: { pacienteId: 'pac_123', nivel: 'premium' },
    current_period_start: 1785369600,
    current_period_end: 1788048000,
    items: { data: [{ price: { id: 'price_premium' } }] },
};

const paidSession = {
    id: 'cs_123',
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    customer: 'cus_123',
    subscription: 'sub_123',
    client_reference_id: 'pac_123',
    metadata: { pacienteId: 'pac_123', nivel: 'premium' },
};

const makePrisma = () => {
    const state = {
        patient: {
            id: 'pac_123',
            nivelMembresia: 'ninguna',
            suscripcionEstado: null,
            suscripcionFin: null,
            ultimaCheckoutId: null,
        },
        events: new Map(),
        updates: [],
    };

    return {
        state,
        paciente: {
            findUnique: async ({ where }) => {
                if (where.id === state.patient.id) return { ...state.patient };
                if (where.stripeCustomerId === 'cus_123') return { ...state.patient };
                return null;
            },
            findFirst: async () => null,
            update: async ({ data }) => {
                state.patient = { ...state.patient, ...data };
                state.updates.push(data);
                return { ...state.patient };
            },
        },
        stripeEvento: {
            create: async ({ data }) => {
                if (state.events.has(data.id)) {
                    const error = new Error('unique');
                    error.code = 'P2002';
                    throw error;
                }
                state.events.set(data.id, {
                    intentos: 1,
                    ...data,
                    actualizadoEn: new Date(),
                });
            },
            findUnique: async ({ where }) => state.events.get(where.id) || null,
            update: async ({ where, data }) => {
                const previous = state.events.get(where.id);
                const intentos = data.intentos?.increment
                    ? previous.intentos + data.intentos.increment
                    : (data.intentos ?? previous.intentos);
                const next = {
                    ...previous,
                    ...data,
                    intentos,
                    actualizadoEn: new Date(),
                };
                state.events.set(where.id, next);
                return next;
            },
        },
    };
};

const stripe = {
    subscriptions: {
        retrieve: async (id) => {
            assert.equal(id, 'sub_123');
            return subscription;
        },
    },
    checkout: {
        sessions: {
            retrieve: async (id) => {
                assert.equal(id, 'cs_123');
                return { ...paidSession, subscription };
            },
        },
    },
};

test('normaliza los nombres históricos del plan básico', () => {
    assert.equal(normalizeMembershipLevel('basico'), 'basica');
    assert.equal(normalizeMembershipLevel('basica'), 'basica');
    assert.equal(normalizeMembershipLevel('norder_health'), 'premium');
    assert.equal(normalizeMembershipLevel('gratis'), null);
});

test('exige una URL pública segura en producción', () => {
    assert.throws(
        () => resolvePublicAppUrl({ NODE_ENV: 'production' }),
        /PUBLIC_APP_URL es obligatoria/,
    );
    assert.throws(
        () => resolvePublicAppUrl({ NODE_ENV: 'production', PUBLIC_APP_URL: 'http://localhost:8080' }),
        /HTTPS/,
    );
    assert.equal(resolvePublicAppUrl(env), 'https://crm-norder-health.vercel.app');
});

test('construye retornos canónicos e incluye el session_id de Stripe', () => {
    assert.deepEqual(buildCheckoutReturnUrls({
        baseUrl: 'https://crm-norder-health.vercel.app',
        nivel: 'basica',
    }), {
        successUrl: 'https://crm-norder-health.vercel.app/norder-health/activado?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://crm-norder-health.vercel.app/norder-health/cancelado?nivel=basica',
    });
});

test('obtiene el periodo incluso cuando Stripe lo informa en los items', () => {
    const period = getSubscriptionPeriod({
        items: {
            data: [{
                current_period_start: 1785369600,
                current_period_end: 1788048000,
            }],
        },
    });
    assert.equal(period.start.toISOString(), '2026-07-30T00:00:00.000Z');
    assert.equal(period.end.toISOString(), '2026-08-30T00:00:00.000Z');
});

test('activa la membresía solamente con Checkout completo y pagado', async () => {
    const prisma = makePrisma();
    const result = await fulfillCheckoutSession({
        session: paidSession,
        stripe,
        prisma,
        env,
    });

    assert.equal(result.activated, true);
    assert.equal(prisma.state.patient.nivelMembresia, 'premium');
    assert.equal(prisma.state.patient.suscripcionIdExterno, 'sub_123');
    assert.equal(prisma.state.patient.ultimaCheckoutId, 'cs_123');
    assert.equal(prisma.state.patient.suscripcionFin.toISOString(), '2026-08-30T00:00:00.000Z');
});

test('no activa Checkout abierto o sin pago', async () => {
    const prisma = makePrisma();
    const result = await fulfillCheckoutSession({
        session: { ...paidSession, status: 'open', payment_status: 'unpaid' },
        stripe,
        prisma,
        env,
    });
    assert.deepEqual(result, { activated: false, reason: 'payment_pending' });
    assert.equal(prisma.state.updates.length, 0);
});

test('detecta una suscripción activa en Stripe aunque el webhook aún no la guarde localmente', async () => {
    const active = await retrieveActiveSubscription({
        paciente: {
            stripeCustomerId: 'cus_123',
            suscripcionIdExterno: null,
        },
        stripe: {
            subscriptions: {
                list: async ({ customer }) => {
                    assert.equal(customer, 'cus_123');
                    return { data: [subscription] };
                },
            },
        },
    });
    assert.equal(active.id, 'sub_123');
});

test('una cancelación baja el nivel pagado sin desactivar el acceso gratuito al portal', async () => {
    const prisma = makePrisma();
    prisma.state.patient = {
        ...prisma.state.patient,
        portalActivo: true,
        nivelMembresia: 'premium',
    };
    const result = await syncSubscription({
        subscription: { ...subscription, status: 'canceled' },
        prisma,
        env,
    });

    assert.equal(result.nivelMembresia, 'ninguna');
    assert.equal(prisma.state.patient.nivelMembresia, 'ninguna');
    assert.equal(prisma.state.patient.portalActivo, true);
    assert.equal(prisma.state.patient.suscripcionEstado, 'canceled');
});

test('la página de retorno confirma la sesión con Stripe y el paciente autenticado', async () => {
    const prisma = makePrisma();
    const result = await getCheckoutSessionResult({
        sessionId: 'cs_123',
        pacienteId: 'pac_123',
        stripe,
        prisma,
        env,
    });
    assert.equal(result.status, 'complete');
    assert.equal(result.paymentStatus, 'paid');
    assert.equal(result.activated, true);
    assert.equal(result.membership.nivel, 'premium');
});

test('rechaza consultar una sesión perteneciente a otro paciente', async () => {
    const prisma = makePrisma();
    await assert.rejects(
        getCheckoutSessionResult({
            sessionId: 'cs_123',
            pacienteId: 'pac_other',
            stripe,
            prisma,
            env,
        }),
        error => error.statusCode === 403,
    );
});

test('procesa un webhook una sola vez aunque Stripe lo reenvíe', async () => {
    const prisma = makePrisma();
    const event = {
        id: 'evt_123',
        type: 'checkout.session.completed',
        data: { object: paidSession },
    };

    const first = await processStripeEvent({ event, stripe, prisma, env });
    const second = await processStripeEvent({ event, stripe, prisma, env });

    assert.equal(first.activated, true);
    assert.deepEqual(second, { duplicate: true });
    assert.equal(prisma.state.events.get('evt_123').estado, 'procesado');
    assert.equal(prisma.state.updates.length, 1);
});

test('marca el webhook como fallido y permite que Stripe reciba un error', async () => {
    const prisma = makePrisma();
    const brokenStripe = {
        ...stripe,
        subscriptions: {
            retrieve: async () => {
                throw new Error('Stripe temporalmente no disponible');
            },
        },
    };
    const event = {
        id: 'evt_failed',
        type: 'checkout.session.completed',
        data: { object: paidSession },
    };

    await assert.rejects(
        processStripeEvent({ event, stripe: brokenStripe, prisma, env }),
        /temporalmente no disponible/,
    );
    assert.equal(prisma.state.events.get('evt_failed').estado, 'fallido');

    const retried = await processStripeEvent({ event, stripe, prisma, env });
    assert.equal(retried.activated, true);
    assert.equal(prisma.state.events.get('evt_failed').estado, 'procesado');
    assert.equal(prisma.state.events.get('evt_failed').intentos, 2);
});
