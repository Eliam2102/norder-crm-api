import { Router } from 'express';
import * as revisionesController from '../controllers/revisiones.controller.js';

const router = Router({ mergeParams: true });

router.get('/', revisionesController.getAll);
router.post('/', revisionesController.create);
router.get('/:id', revisionesController.getById);
router.put('/:id', revisionesController.update);

export default router;
