import { Router } from 'express';
import * as barridoController from '../controllers/barrido.controller.js';

// mergeParams para acceder a :pacienteId y :valoracionId del route padre
const router = Router({ mergeParams: true });

router.get('/', barridoController.get);
router.post('/', barridoController.upsert);
router.put('/', barridoController.upsert);

export default router;
