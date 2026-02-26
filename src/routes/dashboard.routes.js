import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller.js';
import authMiddleware from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/metricas', dashboardController.getMetricas);
router.get('/alertas', dashboardController.getAlertas);

export default router;
