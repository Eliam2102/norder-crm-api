import { Router } from 'express';
import { getContexto, agentKeyMiddleware } from '../controllers/agent.controller.js';

const router = Router();

// GET /api/agent/contexto?telefono=521234567890
// GET /api/agent/contexto?email=paciente@mail.com
// Header opcional: X-Agent-Key (si AGENT_API_KEY está en .env)
router.get('/contexto', agentKeyMiddleware, getContexto);

export default router;
