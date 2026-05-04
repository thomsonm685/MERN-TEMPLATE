import User from '../models/User.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

// @desc    Update user profile
// @route   PUT /api/user/:userID
// @access  Private
export const updateProfile = asyncHandler(async (req, res) => {
  const { userID } = req.params;
  const { firstName, lastName, email } = req.body;

  // Check if user is updating their own profile
  if (req.user._id.toString() !== userID) {
    return res.status(403).json(
      errorResponse('Not authorized to update this profile', 'FORBIDDEN')
    );
  }

  // Check if email is being changed and if it's already taken
  if (email && email !== req.user.email) {
    const emailExists = await User.findOne({ email });
    if (emailExists) {
      return res.status(400).json(
        errorResponse('Email already in use', 'EMAIL_IN_USE')
      );
    }
  }

  // Update user
  const user = await User.findByIdAndUpdate(
    userID,
    {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(email && { email }),
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!user) {
    return res.status(404).json(
      errorResponse('User not found', 'USER_NOT_FOUND')
    );
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
      'Profile updated successfully'
    )
  );
});

// @desc    Update user settings
// @route   PUT /api/user/:userID/settings
// @access  Private
export const updateSettings = asyncHandler(async (req, res) => {
  const { userID } = req.params;
  const { themePreference } = req.body;

  // Check if user is updating their own settings
  if (req.user._id.toString() !== userID) {
    return res.status(403).json(
      errorResponse('Not authorized to update these settings', 'FORBIDDEN')
    );
  }

  // Update settings
  const user = await User.findByIdAndUpdate(
    userID,
    {
      'settings.themePreference': themePreference,
    },
    {
      new: true,
      runValidators: true,
    }
  );

  if (!user) {
    return res.status(404).json(
      errorResponse('User not found', 'USER_NOT_FOUND')
    );
  }

  res.status(200).json(
    successResponse(
      {
        themePreference: user.settings.themePreference,
      },
      'Settings updated successfully'
    )
  );
});

