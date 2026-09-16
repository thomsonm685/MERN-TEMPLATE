/**
 * LEGACY — signup/login/me for the original JWT auth system.
 *
 * Only mounted when AUTH_PROVIDER=jwt. Better Auth serves /api/auth otherwise; see
 * `src/auth/`. Kept so switching back is a one-line env change.
 */
import type { RequestHandler } from 'express';
import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';
import { successResponse, errorResponse } from '../utils/helpers.js';
import { emailTriggers } from '../email/index.js';

/** @deprecated LEGACY — active only when AUTH_PROVIDER=jwt. */
export const signup: RequestHandler = async (req, res) => {
  const { email, password, firstName, lastName } = req.body as {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  };

  const userExists = await User.findOne({ email });
  if (userExists) {
    res.status(400).json(errorResponse('User already exists with this email', 'USER_EXISTS'));
    return;
  }

  const user = await User.create({ email, password, firstName, lastName });
  const token = generateToken(user._id.toString());

  // Fire-and-forget: the account already exists, so a mail failure must not fail the request.
  // Triggers never throw and log their own errors. Without RESEND_API_KEY this just logs.
  void emailTriggers.userRegistered({ email: user.email, firstName: user.firstName });

  res.status(201).json(
    successResponse(
      {
        token,
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      },
      'User registered successfully',
    ),
  );
};

/** @deprecated LEGACY — active only when AUTH_PROVIDER=jwt. */
export const login: RequestHandler = async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    res.status(401).json(errorResponse('Invalid credentials', 'INVALID_CREDENTIALS'));
    return;
  }

  const isPasswordMatch = await user.comparePassword(password);
  if (!isPasswordMatch) {
    res.status(401).json(errorResponse('Invalid credentials', 'INVALID_CREDENTIALS'));
    return;
  }

  const token = generateToken(user._id.toString());

  res.status(200).json(
    successResponse(
      {
        token,
        user: {
          _id: user._id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          settings: user.settings,
        },
      },
      'Login successful',
    ),
  );
};

/** @deprecated LEGACY — active only when AUTH_PROVIDER=jwt. */
export const getMe: RequestHandler = async (req, res) => {
  const user = await User.findById(req.user!._id);
  if (!user) {
    res.status(404).json(errorResponse('User not found', 'USER_NOT_FOUND'));
    return;
  }

  res.status(200).json(
    successResponse(
      {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        settings: user.settings,
      },
      'User retrieved successfully',
    ),
  );
};
