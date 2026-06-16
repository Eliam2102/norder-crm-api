import { Router } from 'express';
import { getContexto, getHistorial, guardarResumen, actualizarMemoria, agentKeyMiddleware } from '../controllers/agent.controller.js';

const router = Router();

router.get('/contexto', agentKeyMiddleware, getContexto);
router.get('/historial', agentKeyMiddleware, getHistorial);
router.post('/guardar-resumen', agentKeyMiddleware, guardarResumen);
router.post('/actualizar-memoria', agentKeyMiddleware, actualizarMemoria);

export default router;
