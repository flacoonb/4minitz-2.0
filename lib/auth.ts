import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import type { IUser } from '@/models/User';
import { getJwtSecret } from '@/lib/validateEnv';
import { verifyAuthTokenString } from '@/lib/verify-auth-token-string';


export interface AuthResult {
  success: boolean;
  user?: IUser;
  error?: string;
}

export interface RoleResult {
  success: boolean;
  error?: string;
}

export async function verifyToken(request: NextRequest): Promise<AuthResult> {
  // Cookie is the primary browser auth mechanism. Bearer is optional and disabled in
  // production unless ALLOW_BEARER_AUTH=true (reduces token leakage via XSS / logs).
  const cookieToken = request.cookies.get('auth-token')?.value;
  const bearerAllowed =
    process.env.NODE_ENV !== 'production' || process.env.ALLOW_BEARER_AUTH === 'true';
  const headerToken = bearerAllowed
    ? request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')?.trim()
    : undefined;
  const token = cookieToken || headerToken;
  return verifyAuthTokenString(token);
}

export async function requireRole(user: IUser, requiredRole: 'admin' | 'moderator' | 'user'): Promise<RoleResult> {
  const roleHierarchy = {
    user: 1,
    moderator: 2,
    admin: 3
  };

  const userLevel = roleHierarchy[user.role];
  const requiredLevel = roleHierarchy[requiredRole];

  if (userLevel < requiredLevel) {
    return {
      success: false,
      error: 'Unzureichende Berechtigung'
    };
  }

  return {
    success: true
  };
}

export async function requireAdmin(user: IUser): Promise<RoleResult> {
  if (user.role !== 'admin') {
    return {
      success: false,
      error: 'Administratorrechte erforderlich'
    };
  }

  return {
    success: true
  };
}

export async function requireModerator(user: IUser): Promise<RoleResult> {
  if (!['admin', 'moderator'].includes(user.role)) {
    return {
      success: false,
      error: 'Moderatorrechte erforderlich'
    };
  }

  return {
    success: true
  };
}

export function generateToken(user: IUser, expiresInSeconds?: number): string {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      username: user.username,
      role: user.role,
      tokenVersion: (user as any).tokenVersion || 0,
    },
    getJwtSecret(),
    { expiresIn: expiresInSeconds || 28800 } // Default 8 hours (480 min)
  );
}

// requirePermission is now consolidated in lib/permissions.ts
// Re-export for backward compatibility
export { requirePermission } from '@/lib/permissions';
