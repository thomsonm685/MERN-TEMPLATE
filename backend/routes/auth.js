import express from 'express';
import { signup, login, getMe } from '../controllers/authController.js';
import { signupValidation, loginValidation, validate } from '../middleware/validation.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/signup', signupValidation, validate, signup);
router.post('/login', loginValidation, validate, login);
router.get('/me', protect, getMe);

export default router;
