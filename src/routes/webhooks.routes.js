import { Router } from 'express';
import express from 'express';
import { stripeWebhook } from '../controllers/webhooks.controller.js';

const router = Router();

// Raw body required for Stripe signature verification
router.post('/stripe', express.raw({ type: 'application/json' }), stripeWebhook);

export default router;
