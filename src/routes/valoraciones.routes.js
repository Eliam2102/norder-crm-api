import { Router } from 'express';
import * as valoracionesController from '../controllers/valoraciones.controller.js';

const router = Router({ mergeParams: true });

router.get('/', valoracionesController.getAll);
router.post('/', valoracionesController.create);
router.get('/comparar', valoracionesController.comparar);
router.get('/:id', valoracionesController.getById);
router.put('/:id', valoracionesController.update);

export default router;
