import { Router } from 'express';
import { loginPortal, getMe, chat, activarPortalManual } from '../controllers/portal.controller.js';
import { portalAuthMiddleware } from '../middlewares/portalAuth.middleware.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/login', loginPortal);
router.get('/me', portalAuthMiddleware, getMe);
router.post('/chat', portalAuthMiddleware, chat);
router.put('/activar/:id', authMiddleware, activarPortalManual);

export default router;
