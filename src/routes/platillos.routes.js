import { Router } from 'express';
import * as platillosController from '../controllers/platillos.controller.js';
import { authMiddleware, requirePermiso } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', authMiddleware, platillosController.getAll);
router.get('/:id', authMiddleware, platillosController.getById);
router.post('/', authMiddleware, requirePermiso('planes', 'write'), platillosController.create);
router.put('/:id', authMiddleware, requirePermiso('planes', 'write'), platillosController.update);
router.delete('/:id', authMiddleware, requirePermiso('planes', 'write'), platillosController.remove);

export default router;
