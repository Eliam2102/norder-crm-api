import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildCheckoutIdempotencyKey,
    buildCheckoutReturnUrls,
    fulfillCheckoutSession,
    getLatestCheckoutSessionResult,
    getCheckoutSessionResult,
    getSubscriptionPeriod,
    normalizeMembershipLevel,
    prepareCheckoutSessionTransition,
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
    url: null,
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
            findFirst: async ({ where } = {}) => {
                if (
                    where?.suscripcionIdExterno
                    && where.suscripcionIdExterno === state.patient.suscripcionIdExterno
                ) {
                    return { ...state.patient };
                }
                return null;
            },
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
    assert.throws(
        () => resolvePublicAppUrl({ RAILWAY_ENVIRONMENT: 'production' }),
        /PUBLIC_APP_URL es obligatoria/,
    );
    assert.throws(
        () => resolvePublicAppUrl({
            RAILWAY_PROJECT_ID: 'railway-project',
            PUBLIC_APP_URL: 'http://localhost:5173',
        }),
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

test('la idempotencia usa el estado anterior y no el plan solicitado', () => {
    assert.equal(buildCheckoutIdempotencyKey({
        pacienteId: 'pac_123',
        previousSessionId: null,
    }), 'norder-checkout-pac_123-initial');
    assert.equal(buildCheckoutIdempotencyKey({
        pacienteId: 'pac_123',
        previousSessionId: 'cs_previous',
    }), 'norder-checkout-pac_123-cs_previous');
});

test('reutiliza la misma sesión abierta cuando el paciente conserva el plan', async () => {
    let expired = false;
    const result = await prepareCheckoutSessionTransition({
        paciente: {
            id: 'pac_123',
            ultimaCheckoutId: 'cs_open',
        },
        nivel: 'basica',
        stripe: {
            checkout: {
                sessions: {
                    retrieve: async () => ({
                        id: 'cs_open',
                        status: 'open',
                        payment_status: 'unpaid',
                        client_reference_id: 'pac_123',
                        metadata: { nivel: 'basica' },
                        url: 'https://checkout.stripe.com/c/pay/cs_open',
                    }),
                    expire: async () => {
                        expired = true;
                    },
                },
            },
        },
    });

    assert.deepEqual(result, {
        action: 'reuse',
        sessionId: 'cs_open',
        url: 'https://checkout.stripe.com/c/pay/cs_open',
    });
    assert.equal(expired, false);
});

test('expira la sesión abierta anterior antes de cambiar de plan', async () => {
    const expiredSessions = [];
    const result = await prepareCheckoutSessionTransition({
        paciente: {
            id: 'pac_123',
            ultimaCheckoutId: 'cs_basic',
        },
        nivel: 'premium',
        stripe: {
            checkout: {
                sessions: {
                    retrieve: async () => ({
                        id: 'cs_basic',
                        status: 'open',
                        payment_status: 'unpaid',
                        client_reference_id: 'pac_123',
                        metadata: { nivel: 'basica' },
                        url: 'https://checkout.stripe.com/c/pay/cs_basic',
                    }),
                    expire: async (sessionId) => {
                        expiredSessions.push(sessionId);
                        return { id: sessionId, status: 'expired' };
                    },
                },
            },
        },
    });

    assert.deepEqual(result, {
        action: 'create',
        expiredSessionId: 'cs_basic',
    });
    assert.deepEqual(expiredSessions, ['cs_basic']);
});

test('no crea otra sesión cuando el pago anterior está pendiente o pagado', async () => {
    const makeStripe = paymentStatus => ({
        checkout: {
            sessions: {
                retrieve: async () => ({
                    id: 'cs_complete',
                    status: 'complete',
                    payment_status: paymentStatus,
                    client_reference_id: 'pac_123',
                    metadata: { nivel: 'basica' },
                }),
            },
        },
    });
    const paciente = { id: 'pac_123', ultimaCheckoutId: 'cs_complete' };

    assert.deepEqual(await prepareCheckoutSessionTransition({
        paciente,
        nivel: 'premium',
        stripe: makeStripe('unpaid'),
    }), {
        action: 'pending',
        sessionId: 'cs_complete',
    });
    assert.deepEqual(await prepareCheckoutSessionTransition({
        paciente,
        nivel: 'premium',
        stripe: makeStripe('paid'),
    }), {
        action: 'paid',
        sessionId: 'cs_complete',
    });
});

test('recupera una sesión expirada solo cuando conserva el mismo plan', async () => {
    const stripeWithRecovery = {
        checkout: {
            sessions: {
                retrieve: async () => ({
                    id: 'cs_expired',
                    status: 'expired',
                    payment_status: 'unpaid',
                    client_reference_id: 'pac_123',
                    metadata: { nivel: 'basica' },
                    after_expiration: {
                        recovery: {
                            url: 'https://checkout.stripe.com/c/pay/recovery',
                        },
                    },
                }),
            },
        },
    };
    const paciente = { id: 'pac_123', ultimaCheckoutId: 'cs_expired' };

    assert.deepEqual(await prepareCheckoutSessionTransition({
        paciente,
        nivel: 'basica',
        stripe: stripeWithRecovery,
    }), {
        action: 'recover',
        sessionId: 'cs_expired',
        url: 'https://checkout.stripe.com/c/pay/recovery',
    });
    assert.deepEqual(await prepareCheckoutSessionTransition({
        paciente,
        nivel: 'premium',
        stripe: stripeWithRecovery,
    }), {
        action: 'create',
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

test('sincroniza una suscripción histórica por su ID aunque no tenga metadata ni customer local', async () => {
    const prisma = makePrisma();
    prisma.state.patient = {
        ...prisma.state.patient,
        stripeCustomerId: null,
        suscripcionIdExterno: 'sub_123',
    };
    const result = await syncSubscription({
        subscription: {
            ...subscription,
            metadata: {},
        },
        prisma,
        env,
    });

    assert.equal(result.nivelMembresia, 'premium');
    assert.equal(prisma.state.patient.nivelMembresia, 'premium');
    assert.equal(prisma.state.patient.stripeCustomerId, 'cus_123');
    assert.equal(prisma.state.patient.suscripcionEstado, 'active');
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

test('una membresía local antigua no convierte una sesión abierta en pago confirmado', async () => {
    const prisma = makePrisma();
    prisma.state.patient = {
        ...prisma.state.patient,
        nivelMembresia: 'premium',
        ultimaCheckoutId: 'cs_123',
    };
    const openStripe = {
        ...stripe,
        checkout: {
            sessions: {
                retrieve: async () => ({
                    ...paidSession,
                    status: 'open',
                    payment_status: 'unpaid',
                    subscription: null,
                    url: 'https://checkout.stripe.com/c/pay/cs_123',
                }),
            },
        },
    };

    const result = await getCheckoutSessionResult({
        sessionId: 'cs_123',
        pacienteId: 'pac_123',
        stripe: openStripe,
        prisma,
        env,
    });

    assert.equal(result.status, 'open');
    assert.equal(result.paymentStatus, 'unpaid');
    assert.equal(result.activated, false);
    assert.equal(result.continuationUrl, 'https://checkout.stripe.com/c/pay/cs_123');
});

test('recupera la última sesión desde el servidor aunque el navegador pierda su estado', async () => {
    const prisma = makePrisma();
    prisma.state.patient.ultimaCheckoutId = 'cs_123';

    const result = await getLatestCheckoutSessionResult({
        pacienteId: 'pac_123',
        stripe,
        prisma,
        env,
    });

    assert.equal(result.sessionId, 'cs_123');
    assert.equal(result.activated, true);
});

test('informa cuando el paciente no tiene una sesión reciente que recuperar', async () => {
    const prisma = makePrisma();
    await assert.rejects(
        getLatestCheckoutSessionResult({
            pacienteId: 'pac_123',
            stripe,
            prisma,
            env,
        }),
        error => error.statusCode === 404,
    );
});

test('devuelve la URL de recuperación de una sesión expirada', async () => {
    const prisma = makePrisma();
    prisma.state.patient.ultimaCheckoutId = 'cs_123';
    const expiredStripe = {
        ...stripe,
        checkout: {
            sessions: {
                retrieve: async () => ({
                    ...paidSession,
                    status: 'expired',
                    payment_status: 'unpaid',
                    subscription: null,
                    after_expiration: {
                        recovery: {
                            url: 'https://checkout.stripe.com/c/pay/recover_123',
                        },
                    },
                }),
            },
        },
    };

    const result = await getLatestCheckoutSessionResult({
        pacienteId: 'pac_123',
        stripe: expiredStripe,
        prisma,
        env,
    });

    assert.equal(result.activated, false);
    assert.equal(result.continuationUrl, 'https://checkout.stripe.com/c/pay/recover_123');
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
