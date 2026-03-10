import { Router } from 'express';
import * as alimentosController from '../controllers/alimentosSmae.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/', alimentosController.getAll);
router.post('/', alimentosController.create);
router.put('/:id', alimentosController.update);
router.delete('/:id', alimentosController.remove);

export default router;
