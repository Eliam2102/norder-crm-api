import { Router } from 'express';
import * as reqsController from '../controllers/requerimientos.controller.js';

const router = Router({ mergeParams: true }); // Para poder acceder a req.params.pacienteId

router.get('/', reqsController.getAll);
router.post('/', reqsController.create);
router.get('/:id', reqsController.getById);
router.put('/:id', reqsController.update);

export default router;
