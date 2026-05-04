import type { RequestHandler } from 'express';
import User from '../models/User.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

export const updateProfile: RequestHandler = async (req, res) => {
  const { userID } = req.params;
  const { firstName, lastName, email } = req.body as {
    firstName?: string;
    lastName?: string;
    email?: string;
  };

  if (req.user!._id.toString() !== userID) {
    res.status(403).json(errorResponse('Not authorized to update this profile', 'FORBIDDEN'));
    return;
  }

  if (email && email !== req.user!.email) {
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

  if (req.user!._id.toString() !== userID) {
    res.status(403).json(errorResponse('Not authorized to update these settings', 'FORBIDDEN'));
    return;
  }

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
