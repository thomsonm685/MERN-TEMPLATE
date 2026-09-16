import type { RequestHandler } from 'express';
import { body, validationResult } from 'express-validator';
import { errorResponse } from '../utils/helpers.js';

export const validate: RequestHandler = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json(errorResponse('Validation failed', 'VALIDATION_ERROR', errors.array()));
    return;
  }
  next();
};

export const signupValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
];

export const loginValidation = [
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

export const updateProfileValidation = [
  body('firstName').optional().trim().notEmpty().withMessage('First name cannot be empty'),
  body('lastName').optional().trim().notEmpty().withMessage('Last name cannot be empty'),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
];

export const askValidation = [
  body('messages')
    .isArray({ min: 1, max: 100 })
    .withMessage('messages must be an array of 1-100 turns'),
  body('messages.*.role').isIn(['user', 'assistant']).withMessage('role must be user or assistant'),
  body('messages.*.content').notEmpty().withMessage('Each message needs content'),
  body('system').optional().isString().isLength({ max: 20000 }),
  // Capped well under the model's 128k ceiling; raise deliberately, and stream when you do.
  body('maxTokens').optional().isInt({ min: 1, max: 32000 }).toInt(),
  body('effort').optional().isIn(['low', 'medium', 'high', 'xhigh', 'max']),
];

export const updateSettingsValidation = [
  body('themePreference').isIn(['light', 'dark']).withMessage('Theme must be light or dark'),
];
