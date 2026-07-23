import { Router } from 'express';
import * as valoracionesController from '../controllers/valoraciones.controller.js';
import * as fotosController from '../controllers/fotosSeguimiento.controller.js';
import { requirePermiso } from '../middlewares/auth.middleware.js';

const router = Router({ mergeParams: true });

router.get('/', valoracionesController.getAll);
router.post('/', valoracionesController.create);
router.get('/comparar', valoracionesController.comparar);
router.get('/archivadas', valoracionesController.getArchivadas);  // B9: lista archivadas
router.get('/:id', valoracionesController.getById);
router.put('/:id', valoracionesController.update);
router.get('/:id/fotos', fotosController.list);
router.get('/:id/fotos/:fotoId/archivo', fotosController.file);
router.post('/:id/fotos', requirePermiso('pacientes', 'write'), fotosController.create);
router.patch('/:id/fotos/:fotoId/principal', requirePermiso('pacientes', 'write'), fotosController.setPrincipal);
router.delete('/:id/fotos/:fotoId', requirePermiso('pacientes', 'write'), fotosController.remove);
router.delete('/:id', valoracionesController.softDelete);         // A1: soft delete
router.patch('/:id/restore', valoracionesController.restore);     // B9: restore

export default router;
