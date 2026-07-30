const ACTIVE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);
const PAID_CHECKOUT_STATUSES = new Set(['paid', 'no_payment_required']);
const PROCESSING_STALE_MS = 5 * 60 * 1000;

const stripeId = (value) => {
    if (!value) return null;
    return typeof value === 'string' ? value : value.id || null;
};

const asDate = (unixSeconds) => (
    Number.isFinite(Number(unixSeconds))
        ? new Date(Number(unixSeconds) * 1000)
        : null
);

export const normalizeMembershipLevel = (value) => {
    if (value === 'basica' || value === 'basico') return 'basica';
    if (value === 'premium' || value === 'norder_health') return 'premium';
    return null;
};

export const resolvePublicAppUrl = (env = process.env) => {
    const isProduction = env.NODE_ENV === 'production';
    let candidate = env.PUBLIC_APP_URL?.trim();

    if (!candidate && !isProduction) {
        const configured = (env.FRONTEND_URL || '')
            .split(',')
            .map(value => value.trim())
            .filter(Boolean);
        candidate = configured.find(value => /localhost|127\.0\.0\.1/.test(value))
            || configured[0]
            || 'http://localhost:8080';
    }

    if (!candidate) {
        throw new Error('PUBLIC_APP_URL es obligatoria para crear pagos en producción.');
    }

    let parsed;
    try {
        parsed = new URL(candidate);
    } catch {
        throw new Error('PUBLIC_APP_URL no contiene una URL válida.');
    }

    const isLocal = ['localhost', '127.0.0.1'].includes(parsed.hostname);
    if (isProduction && (parsed.protocol !== 'https:' || isLocal)) {
        throw new Error('PUBLIC_APP_URL debe ser HTTPS y no puede apuntar a localhost en producción.');
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('PUBLIC_APP_URL debe usar HTTP o HTTPS.');
    }

    parsed.pathname = parsed.pathname.replace(/\/+$/, '');
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString().replace(/\/$/, '');
};

export const buildCheckoutReturnUrls = ({ baseUrl, nivel }) => ({
    successUrl: `${baseUrl}/norder-health/activado?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${baseUrl}/norder-health/cancelado?nivel=${encodeURIComponent(nivel)}`,
});

export const getSubscriptionPeriod = (subscription) => {
    const itemPeriods = subscription?.items?.data || [];
    const starts = [
        subscription?.current_period_start,
        ...itemPeriods.map(item => item.current_period_start),
    ].filter(value => Number.isFinite(Number(value)));
    const ends = [
        subscription?.current_period_end,
        ...itemPeriods.map(item => item.current_period_end),
    ].filter(value => Number.isFinite(Number(value)));

    return {
        start: starts.length ? asDate(Math.min(...starts.map(Number))) : null,
        end: ends.length ? asDate(Math.max(...ends.map(Number))) : null,
    };
};

export const levelFromStripeData = ({ metadata = {}, subscription, env = process.env }) => {
    const metadataLevel = normalizeMembershipLevel(metadata.nivel || subscription?.metadata?.nivel);
    if (metadataLevel) return metadataLevel;

    const priceId = subscription?.items?.data?.[0]?.price?.id;
    if (priceId && priceId === env.STRIPE_PRICE_BASICA) return 'basica';
    if (priceId && priceId === env.STRIPE_PRICE_PREMIUM) return 'premium';
    return null;
};

const findPatientForStripeObject = async ({ object, subscription, prisma }) => {
    const metadata = { ...(subscription?.metadata || {}), ...(object?.metadata || {}) };
    const pacienteId = metadata.pacienteId || object?.client_reference_id;
    if (pacienteId) {
        return prisma.paciente.findUnique({ where: { id: pacienteId } });
    }

    const customerId = stripeId(object?.customer || subscription?.customer);
    if (customerId) {
        const byCustomer = await prisma.paciente.findUnique({ where: { stripeCustomerId: customerId } });
        if (byCustomer) return byCustomer;
    }

    const email = metadata.email || object?.customer_email || object?.customer_details?.email;
    if (email) {
        return prisma.paciente.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } },
        });
    }

    return null;
};

export const ensureStripeCustomer = async ({ paciente, stripe, prisma }) => {
    if (paciente.stripeCustomerId) return paciente.stripeCustomerId;

    const customer = await stripe.customers.create({
        email: paciente.email || undefined,
        name: [paciente.nombre, paciente.apellido].filter(Boolean).join(' ') || undefined,
        phone: paciente.telefono || undefined,
        metadata: { pacienteId: paciente.id },
    }, {
        idempotencyKey: `norder-customer-${paciente.id}`,
    });

    await prisma.paciente.update({
        where: { id: paciente.id },
        data: { stripeCustomerId: customer.id },
    });
    return customer.id;
};

export const retrieveActiveSubscription = async ({ paciente, stripe }) => {
    if (paciente.suscripcionIdExterno) {
        try {
            const subscription = await stripe.subscriptions.retrieve(paciente.suscripcionIdExterno);
            if (ACTIVE_SUBSCRIPTION_STATUSES.has(subscription.status)) return subscription;
        } catch (error) {
            if (error?.code !== 'resource_missing') throw error;
        }
    }

    if (!paciente.stripeCustomerId) return null;
    const subscriptions = await stripe.subscriptions.list({
        customer: paciente.stripeCustomerId,
        status: 'all',
        limit: 10,
    });
    return subscriptions.data.find(item => ACTIVE_SUBSCRIPTION_STATUSES.has(item.status)) || null;
};

export const fulfillCheckoutSession = async ({ session, stripe, prisma, env = process.env }) => {
    if (session.mode !== 'subscription') {
        return { activated: false, reason: 'unsupported_mode' };
    }
    if (session.status !== 'complete' || !PAID_CHECKOUT_STATUSES.has(session.payment_status)) {
        return { activated: false, reason: 'payment_pending' };
    }

    const subscriptionId = stripeId(session.subscription);
    if (!subscriptionId) throw new Error(`Checkout ${session.id} no contiene una suscripción.`);

    const subscription = typeof session.subscription === 'object'
        ? session.subscription
        : await stripe.subscriptions.retrieve(subscriptionId);
    const paciente = await findPatientForStripeObject({ object: session, subscription, prisma });
    if (!paciente) throw new Error(`No se encontró paciente para Checkout ${session.id}.`);

    const nivelMembresia = levelFromStripeData({
        metadata: session.metadata,
        subscription,
        env,
    });
    if (!nivelMembresia) throw new Error(`No se pudo determinar el nivel de Checkout ${session.id}.`);

    const period = getSubscriptionPeriod(subscription);
    if (!period.end) throw new Error(`La suscripción ${subscription.id} no contiene fecha de vigencia.`);

    await prisma.paciente.update({
        where: { id: paciente.id },
        data: {
            portalActivo: true,
            nivelMembresia,
            stripeCustomerId: stripeId(session.customer || subscription.customer),
            suscripcionIdExterno: subscription.id,
            suscripcionEstado: subscription.status,
            suscripcionInicio: period.start || new Date(),
            suscripcionFin: period.end,
            ultimaCheckoutId: session.id,
        },
    });

    return {
        activated: true,
        pacienteId: paciente.id,
        nivelMembresia,
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        periodEnd: period.end,
    };
};

export const syncSubscription = async ({ subscription, prisma, env = process.env }) => {
    const paciente = await findPatientForStripeObject({ object: subscription, subscription, prisma });
    if (!paciente) throw new Error(`No se encontró paciente para suscripción ${subscription.id}.`);

    const period = getSubscriptionPeriod(subscription);
    const status = subscription.status || 'unknown';
    const isEntitled = ACTIVE_SUBSCRIPTION_STATUSES.has(status);
    const nivelMembresia = levelFromStripeData({ subscription, env });

    if (isEntitled && !nivelMembresia) {
        throw new Error(`No se pudo determinar el nivel de la suscripción ${subscription.id}.`);
    }

    await prisma.paciente.update({
        where: { id: paciente.id },
        data: isEntitled
            ? {
                portalActivo: true,
                nivelMembresia,
                stripeCustomerId: stripeId(subscription.customer),
                suscripcionIdExterno: subscription.id,
                suscripcionEstado: status,
                ...(period.start ? { suscripcionInicio: period.start } : {}),
                ...(period.end ? { suscripcionFin: period.end } : {}),
            }
            : {
                nivelMembresia: 'ninguna',
                stripeCustomerId: stripeId(subscription.customer),
                suscripcionIdExterno: subscription.id,
                suscripcionEstado: status,
                ...(period.end ? { suscripcionFin: period.end } : {}),
            },
    });

    return { pacienteId: paciente.id, status, nivelMembresia: isEntitled ? nivelMembresia : 'ninguna' };
};

const retrieveInvoiceSubscription = async ({ invoice, stripe }) => {
    const subscriptionId = stripeId(
        invoice.subscription
        || invoice.parent?.subscription_details?.subscription
    );
    return subscriptionId ? stripe.subscriptions.retrieve(subscriptionId) : null;
};

const claimStripeEvent = async ({ event, prisma, now = new Date() }) => {
    try {
        await prisma.stripeEvento.create({
            data: { id: event.id, tipo: event.type, estado: 'procesando' },
        });
        return true;
    } catch (error) {
        if (error?.code !== 'P2002') throw error;
    }

    const existing = await prisma.stripeEvento.findUnique({ where: { id: event.id } });
    if (!existing || existing.estado === 'procesado') return false;
    if (
        existing.estado === 'procesando'
        && now.getTime() - new Date(existing.actualizadoEn).getTime() < PROCESSING_STALE_MS
    ) {
        return false;
    }

    await prisma.stripeEvento.update({
        where: { id: event.id },
        data: {
            estado: 'procesando',
            intentos: { increment: 1 },
            ultimoError: null,
        },
    });
    return true;
};

export const processStripeEvent = async ({ event, stripe, prisma, env = process.env }) => {
    const claimed = await claimStripeEvent({ event, prisma });
    if (!claimed) return { duplicate: true };

    try {
        let result = { ignored: true };
        switch (event.type) {
            case 'checkout.session.completed':
            case 'checkout.session.async_payment_succeeded':
                result = await fulfillCheckoutSession({
                    session: event.data.object,
                    stripe,
                    prisma,
                    env,
                });
                break;
            case 'customer.subscription.created':
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted':
                result = await syncSubscription({
                    subscription: event.data.object,
                    prisma,
                    env,
                });
                break;
            case 'invoice.paid':
            case 'invoice.payment_failed': {
                const subscription = await retrieveInvoiceSubscription({
                    invoice: event.data.object,
                    stripe,
                });
                result = subscription
                    ? await syncSubscription({ subscription, prisma, env })
                    : { ignored: true, reason: 'invoice_without_subscription' };
                break;
            }
            default:
                break;
        }

        await prisma.stripeEvento.update({
            where: { id: event.id },
            data: {
                estado: 'procesado',
                procesadoEn: new Date(),
                ultimoError: null,
            },
        });
        return result;
    } catch (error) {
        await prisma.stripeEvento.update({
            where: { id: event.id },
            data: {
                estado: 'fallido',
                ultimoError: String(error?.message || error).slice(0, 1000),
            },
        }).catch(() => {});
        throw error;
    }
};

export const getCheckoutSessionResult = async ({
    sessionId,
    pacienteId,
    stripe,
    prisma,
    env = process.env,
}) => {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription'],
    });
    const ownerId = session.metadata?.pacienteId || session.client_reference_id;
    if (!ownerId || ownerId !== pacienteId) {
        const error = new Error('La sesión de pago no pertenece al paciente autenticado.');
        error.statusCode = 403;
        throw error;
    }

    let fulfillment = null;
    if (session.status === 'complete' && PAID_CHECKOUT_STATUSES.has(session.payment_status)) {
        fulfillment = await fulfillCheckoutSession({ session, stripe, prisma, env });
    }

    const paciente = await prisma.paciente.findUnique({
        where: { id: pacienteId },
        select: {
            nivelMembresia: true,
            suscripcionEstado: true,
            suscripcionFin: true,
            ultimaCheckoutId: true,
        },
    });
    const sessionIsPaid = (
        session.status === 'complete'
        && PAID_CHECKOUT_STATUSES.has(session.payment_status)
    );
    const activated = Boolean(
        fulfillment?.activated
        || (
            sessionIsPaid
            && paciente?.ultimaCheckoutId === session.id
            && normalizeMembershipLevel(paciente?.nivelMembresia)
        )
    );

    return {
        sessionId: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
        nivel: normalizeMembershipLevel(session.metadata?.nivel),
        activated,
        continuationUrl: session.status === 'open'
            ? (session.url || null)
            : (session.after_expiration?.recovery?.url || null),
        membership: paciente ? {
            nivel: normalizeMembershipLevel(paciente.nivelMembresia) || 'gratis',
            status: paciente.suscripcionEstado,
            validUntil: paciente.suscripcionFin,
        } : null,
    };
};

export const getLatestCheckoutSessionResult = async ({
    pacienteId,
    stripe,
    prisma,
    env = process.env,
}) => {
    const paciente = await prisma.paciente.findUnique({
        where: { id: pacienteId },
        select: { ultimaCheckoutId: true },
    });
    if (!paciente?.ultimaCheckoutId) {
        const error = new Error('No existe una sesión de pago reciente.');
        error.statusCode = 404;
        throw error;
    }

    return getCheckoutSessionResult({
        sessionId: paciente.ultimaCheckoutId,
        pacienteId,
        stripe,
        prisma,
        env,
    });
};
