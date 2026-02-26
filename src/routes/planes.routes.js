import { Router } from 'express';
import * as planesController from '../controllers/planes.controller.js';

const router = Router({ mergeParams: true });

router.get('/', planesController.getAll);
router.get('/activo', planesController.getActivo);
router.post('/', planesController.create);
router.get('/:id', planesController.getById);
router.put('/:id', planesController.update);
router.get('/:id/pdf', planesController.generatePdf);
router.post('/:id/enviar', planesController.sendPlan);
router.put('/:id/estado', planesController.updateEstado);
router.post('/:id/asignar', planesController.asignarPlan);

export default router;
