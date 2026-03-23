import express from 'express';
import { getSlots, agendarCita, getEventType } from '../controllers/citas.controller.js';

const router = express.Router();

router.get('/slots', getSlots);
router.get('/event-type/:id', getEventType);
router.post('/agendar', agendarCita);

export default router;
