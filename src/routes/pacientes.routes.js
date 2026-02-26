import { Router } from 'express';
import * as pacientesController from '../controllers/pacientes.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';
import valoracionRoutes from './valoraciones.routes.js';
import revisionRoutes from './revisiones.routes.js';
import planRoutes from './planes.routes.js';
import requerimientosRoutes from './requerimientos.routes.js';

const router = Router();

router.use(authMiddleware);

router.get('/', pacientesController.getAll);
router.post('/', pacientesController.create);
router.get('/:id', pacientesController.getById);
router.put('/:id', pacientesController.update);
router.delete('/:id', pacientesController.remove);

router.get('/:id/ejercicio', pacientesController.getEjercicio);
router.put('/:id/ejercicio', pacientesController.upsertEjercicio);

router.get('/:id/antecedentes', pacientesController.getAntecedentes);
router.put('/:id/antecedentes', pacientesController.upsertAntecedentes);

router.get('/:id/consumo', pacientesController.getConsumo);
router.put('/:id/consumo', pacientesController.upsertConsumo);

router.put('/:id/membresia', pacientesController.updateMembresia);

// Nested routes
router.use('/:pacienteId/valoraciones', valoracionRoutes);
router.use('/:pacienteId/revisiones', revisionRoutes);
router.use('/:pacienteId/planes', planRoutes);
router.use('/:pacienteId/requerimientos', requerimientosRoutes);

export default router;
