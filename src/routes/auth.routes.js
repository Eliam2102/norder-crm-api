import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { loginLimiter, noStoreLogin } from '../middlewares/loginProtection.js';

const router = Router();

router.post('/login', noStoreLogin, loginLimiter, authController.login);
router.get('/me', authMiddleware, authController.me);

export default router;
