import { Router } from 'express';
import * as configController from '../controllers/configuracion.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', configController.get);
router.put('/', configController.update);

export default router;
