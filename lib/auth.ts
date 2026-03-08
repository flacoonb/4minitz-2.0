import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import User, { IUser } from '@/models/User';
import connectDB from '@/lib/mongodb';
import { getJwtSecret } from '@/lib/validateEnv';


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
  try {
    await connectDB();
    // Get token from cookie or Authorization header
    const cookieToken = request.cookies.get('auth-token')?.value;
    const headerToken = request.headers.get('Authorization')?.replace('Bearer ', '');
    const token = cookieToken || headerToken;

    if (!token) {
      return {
        success: false,
        error: 'Nicht authentifiziert'
      };
    }

    // Verify token
    const decoded = jwt.verify(token, getJwtSecret()) as any;
    
    // Get user
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return {
        success: false,
        error: 'Benutzer nicht gefunden oder deaktiviert'
      };
    }

    return {
      success: true,
      user
    };

  } catch (error: any) {
    if (error.name === 'JsonWebTokenError') {
      return {
        success: false,
        error: 'Ungültiger Token'
      };
    }
    
    if (error.name === 'TokenExpiredError') {
      return {
        success: false,
        error: 'Token abgelaufen'
      };
    }

    return {
      success: false,
      error: 'Authentifizierungsfehler'
    };
  }
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
      role: user.role
    },
    getJwtSecret(),
    { expiresIn: expiresInSeconds || 28800 } // Default 8 hours (480 min)
  );
}

// requirePermission is now consolidated in lib/permissions.ts
// Re-export for backward compatibility
export { requirePermission } from '@/lib/permissions';