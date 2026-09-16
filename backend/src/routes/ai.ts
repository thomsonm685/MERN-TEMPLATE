/**
 * AI routes — mounted only when ANTHROPIC_API_KEY is set (see app.ts).
 *
 * These cost real money per call, so they are authenticated and separately rate limited,
 * well below the global /api allowance.
 */
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { postMessage, postMessageStream } from '../controllers/aiController.js';
import { askValidation, validate } from '../middleware/validation.js';
import { requireAuth } from '../auth/index.js';
import { env } from '../config/env.js';

const router: Router = Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: env.AI_RATE_LIMIT_PER_HOUR,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  // Per user rather than per IP: several users behind one office NAT should not
  // exhaust each other's allowance.
  keyGenerator: (req) => req.authUser?.id ?? req.ip ?? 'anonymous',
});

router.post('/message', requireAuth, aiLimiter, askValidation, validate, postMessage);
router.post('/stream', requireAuth, aiLimiter, askValidation, validate, postMessageStream);

export default router;
