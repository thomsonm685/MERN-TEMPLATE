import User from '../models/User.js';
import { generateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { successResponse, errorResponse } from '../utils/helpers.js';

// @desc    Register new user
// @route   POST /api/auth/signup
// @access  Public
export const signup = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName} = req.body;

  // Check if user already exists
  const userExists = await User.findOne({ email });

  if (userExists) {
    return res.status(400).json(
      errorResponse('User already exists with this email', 'USER_EXISTS')
    );
  }

  // Create user
  const user = await User.create({
    email,
    password,
    firstName,
    lastName
  });

  // Generate token
  const token = generateToken(user._id);

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
      'User registered successfully'
    )
  );
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user and include password field
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return res.status(401).json(
      errorResponse('Invalid credentials', 'INVALID_CREDENTIALS')
    );
  }

  // Check password
  const isPasswordMatch = await user.comparePassword(password);

  if (!isPasswordMatch) {
    return res.status(401).json(
      errorResponse('Invalid credentials', 'INVALID_CREDENTIALS')
    );
  }

  // Generate token
  const token = generateToken(user._id);

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
      'Login successful'
    )
  );
});

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
export const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  res.status(200).json(
    successResponse(
      {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        settings: user.settings,
      },
      'User retrieved successfully'
    )
  );
});
