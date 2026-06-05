import { Router } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { loginPortal, getMe, getPlan, getMensajes, chat, activarPortalManual } from '../controllers/portal.controller.js';
import { portalAuthMiddleware } from '../middlewares/portalAuth.middleware.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

// Max 5 mensajes por minuto por IP (N8N tarda ~15s c/u, 5 es suficiente)
const chatLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    keyGenerator: (req) => req.paciente?.id || ipKeyGenerator(req),
    handler: (req, res) => res.status(429).json({ error: 'Demasiados mensajes. Espera un momento.' }),
    standardHeaders: true,
    legacyHeaders: false,
});

// Max 10 intentos de login por IP cada 15 min
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    handler: (req, res) => res.status(429).json({ error: 'Demasiados intentos. Intenta en 15 minutos.' }),
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/login', loginLimiter, loginPortal);
router.get('/me', portalAuthMiddleware, getMe);
router.get('/plan', portalAuthMiddleware, getPlan);
router.get('/mensajes', portalAuthMiddleware, getMensajes);
router.post('/chat', portalAuthMiddleware, chatLimiter, chat);
router.put('/activar/:id', authMiddleware, activarPortalManual);

export default router;
