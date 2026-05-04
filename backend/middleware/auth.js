import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { errorResponse } from '../utils/helpers.js';

// Protect routes - verify JWT token
export const protect = async (req, res, next) => {
  try {
    let token;

    // Check for token in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Check if token exists
    if (!token) {
      return res.status(401).json(
        errorResponse('Not authorized to access this route', 'UNAUTHORIZED')
      );
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Get user from token
      req.user = await User.findById(decoded.id);

      if (!req.user) {
        return res.status(401).json(
          errorResponse('User not found', 'UNAUTHORIZED')
        );
      }

      next();
    } catch (error) {
      return res.status(401).json(
        errorResponse('Token is invalid or expired', 'TOKEN_INVALID')
      );
    }
  } catch (error) {
    return res.status(500).json(
      errorResponse('Server error during authentication', 'AUTH_ERROR')
    );
  }
};

// Generate JWT token
export const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// Generate admin JWT token
export const generateAdminToken = () => {
  return jwt.sign({ id: 'admin', role: 'admin' }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
  });
};

// Admin protect middleware — verifies JWT and checks admin role, no DB lookup
export const adminProtect = (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json(
        errorResponse('Not authorized to access this route', 'UNAUTHORIZED')
      );
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (decoded.role !== 'admin') {
        return res.status(403).json(
          errorResponse('Admin access required', 'FORBIDDEN')
        );
      }

      req.admin = decoded;
      next();
    } catch (error) {
      return res.status(401).json(
        errorResponse('Token is invalid or expired', 'TOKEN_INVALID')
      );
    }
  } catch (error) {
    return res.status(500).json(
      errorResponse('Server error during authentication', 'AUTH_ERROR')
    );
  }
};