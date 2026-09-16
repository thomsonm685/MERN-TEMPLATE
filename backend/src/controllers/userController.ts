import type { RequestHandler } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import User from '../models/User.js';
import { getAuth, isBetterAuth } from '../auth/index.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

/**
 * Profile routes, provider-neutral.
 *
 * Identity comes from `req.authUser`, which `requireAuth` populates from whichever provider
 * AUTH_PROVIDER selects. Writes then go to that provider's own store: Better Auth owns its
 * `user` collection, the legacy system owns the Mongoose `users` collection.
 */

export const updateProfile: RequestHandler = async (req, res) => {
  const { userID } = req.params;
  const { firstName, lastName, email } = req.body as {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
  const authUser = req.authUser!;

  if (authUser.id !== userID) {
    res.status(403).json(errorResponse('Not authorized to update this profile', 'FORBIDDEN'));
    return;
  }

  if (isBetterAuth) {
    const nextFirst = firstName ?? authUser.firstName;
    const nextLast = lastName ?? authUser.lastName;

    // Changing an email goes through changeEmail, which can require re-verification —
    // updateUser deliberately will not touch it.
    if (email && email !== authUser.email) {
      res
        .status(400)
        .json(
          errorResponse(
            'Use POST /api/auth/change-email to change your email address',
            'EMAIL_CHANGE_UNSUPPORTED',
          ),
        );
      return;
    }

    const updated = await getAuth().api.updateUser({
      headers: fromNodeHeaders(req.headers),
      body: {
        name: [nextFirst, nextLast].filter(Boolean).join(' '),
        firstName: nextFirst,
        lastName: nextLast,
      },
    });

    if (!updated) {
      res.status(404).json(errorResponse('User not found', 'USER_NOT_FOUND'));
      return;
    }

    res.status(200).json(
      successResponse(
        {
          _id: authUser.id,
          email: authUser.email,
          firstName: nextFirst,
          lastName: nextLast,
          settings: { themePreference: authUser.themePreference },
        },
        'Profile updated successfully',
      ),
    );
    return;
  }

  // --- LEGACY (AUTH_PROVIDER=jwt) ---
  if (email && email !== authUser.email) {
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      res.status(400).json(errorResponse('Email already in use', 'EMAIL_IN_USE'));
      return;
    }
  }

  const user = await User.findByIdAndUpdate(
    userID,
    {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(email && { email }),
    },
    { new: true, runValidators: true },
  );

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
      'Profile updated successfully',
    ),
  );
};

export const updateSettings: RequestHandler = async (req, res) => {
  const { userID } = req.params;
  const { themePreference } = req.body as { themePreference: 'light' | 'dark' };
  const authUser = req.authUser!;

  if (authUser.id !== userID) {
    res.status(403).json(errorResponse('Not authorized to update these settings', 'FORBIDDEN'));
    return;
  }

  if (isBetterAuth) {
    // themePreference is declared as an additionalField on the Better Auth user.
    await getAuth().api.updateUser({
      headers: fromNodeHeaders(req.headers),
      body: { themePreference },
    });

    res.status(200).json(successResponse({ themePreference }, 'Settings updated successfully'));
    return;
  }

  // --- LEGACY (AUTH_PROVIDER=jwt) ---
  const user = await User.findByIdAndUpdate(
    userID,
    { 'settings.themePreference': themePreference },
    { new: true, runValidators: true },
  );

  if (!user) {
    res.status(404).json(errorResponse('User not found', 'USER_NOT_FOUND'));
    return;
  }

  res
    .status(200)
    .json(
      successResponse(
        { themePreference: user.settings?.themePreference },
        'Settings updated successfully',
      ),
    );
};
