import { Router } from 'express';
import * as valoracionesController from '../controllers/valoraciones.controller.js';

const router = Router({ mergeParams: true });

router.get('/', valoracionesController.getAll);
router.post('/', valoracionesController.create);
router.get('/comparar', valoracionesController.comparar);
router.get('/archivadas', valoracionesController.getArchivadas);  // B9: lista archivadas
router.get('/:id', valoracionesController.getById);
router.put('/:id', valoracionesController.update);
router.delete('/:id', valoracionesController.softDelete);         // A1: soft delete
router.patch('/:id/restore', valoracionesController.restore);     // B9: restore

export default router;
