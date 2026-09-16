import { Router } from 'express';
import { updateProfile, updateSettings } from '../controllers/userController.js';
import {
  updateProfileValidation,
  updateSettingsValidation,
  validate,
} from '../middleware/validation.js';
import { requireAuth } from '../auth/index.js';

const router: Router = Router();

router.put('/:userID', requireAuth, updateProfileValidation, validate, updateProfile);
router.put('/:userID/settings', requireAuth, updateSettingsValidation, validate, updateSettings);

export default router;
