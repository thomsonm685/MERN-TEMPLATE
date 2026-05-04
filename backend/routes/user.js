

import express from 'express';
import { updateProfile, updateSettings } from '../controllers/userController.js';
import { updateProfileValidation, updateSettingsValidation, validate } from '../middleware/validation.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.put('/:userID', protect, updateProfileValidation, validate, updateProfile);
router.put('/:userID/settings', protect, updateSettingsValidation, validate, updateSettings);

export default router;
