import rateLimit from 'express-rate-limit';

// Bound password guessing per account without making all users behind one proxy
// share the same small IP bucket. Successful logins do not consume attempts.
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => String(req.body?.email || '').trim().toLowerCase().slice(0, 254) || 'missing-email',
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { success: false, error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
});

export const noStoreLogin = (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
};
