import type { RequestHandler } from 'express';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env.js';
import User, { type UserDoc } from '../models/User.js';
import { errorResponse } from '../utils/helpers.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: UserDoc;
    admin?: { id: string; role: string };
  }
}

interface UserTokenPayload {
  id: string;
}

interface AdminTokenPayload {
  id: string;
  role: 'admin';
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export const protect: RequestHandler = async (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json(errorResponse('Not authorized to access this route', 'UNAUTHORIZED'));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as UserTokenPayload;
    const user = await User.findById(decoded.id);
    if (!user) {
      res.status(401).json(errorResponse('User not found', 'UNAUTHORIZED'));
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json(errorResponse('Token is invalid or expired', 'TOKEN_INVALID'));
  }
};

export const adminProtect: RequestHandler = (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    res.status(401).json(errorResponse('Not authorized to access this route', 'UNAUTHORIZED'));
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AdminTokenPayload;
    if (decoded.role !== 'admin') {
      res.status(403).json(errorResponse('Admin access required', 'FORBIDDEN'));
      return;
    }
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json(errorResponse('Token is invalid or expired', 'TOKEN_INVALID'));
  }
};

export function generateToken(userId: string): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRE as SignOptions['expiresIn'] };
  return jwt.sign({ id: userId } satisfies UserTokenPayload, env.JWT_SECRET, options);
}

export function generateAdminToken(): string {
  const options: SignOptions = { expiresIn: env.JWT_EXPIRE as SignOptions['expiresIn'] };
  return jwt.sign(
    { id: 'admin', role: 'admin' } satisfies AdminTokenPayload,
    env.JWT_SECRET,
    options,
  );
}
