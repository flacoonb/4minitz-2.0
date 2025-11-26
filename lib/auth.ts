import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import User, { IUser } from '@/models/User';
import Settings from '@/models/Settings';
import connectDB from '@/lib/mongodb';


export interface AuthResult {
  success: boolean;
  user?: IUser;
  error?: string;
}

export interface RoleResult {
  success: boolean;
  error?: string;
}

// async function resolveUserFromHeader(identifier: string): Promise<IUser | null> {
//   await connectDB();
//   // Do not special-case 'demo-user' here. Demo fallbacks are controlled
//   // centrally via environment flags in `verifyToken`.

//   // Try to resolve as ObjectId
//   if (Types.ObjectId.isValid(identifier)) {
//     return await User.findById(identifier);
//   }
  
//   // Try to resolve as username
//   return await User.findOne({ username: identifier });
// }

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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as any;
    
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

export function getUserFromRequest(_request: NextRequest): string | null {
  // Legacy helper: do not derive user from headers anymore.
  return null;
}

export function generateToken(user: IUser): string {
  return jwt.sign(
    {
      userId: user._id,
      email: user.email,
      username: user.username,
      role: user.role
    },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: '7d' }
  );
}

export async function requirePermission(user: IUser, permission: string): Promise<RoleResult> {
  try {
    await connectDB();
    const settings = await Settings.findOne({}).sort({ version: -1 });
    
    let hasPermission = false;
    
    if (settings && settings.roles && settings.roles[user.role]) {
      hasPermission = !!settings.roles[user.role][permission];
    } else {
      // Fallback defaults if no settings found
      if (user.role === 'admin') {
        hasPermission = true;
      } else if (user.role === 'moderator') {
        // Hardcoded defaults for moderator
        const modDefaults = ['canCreateMeetings', 'canViewAllMeetings', 'canEditAllMinutes'];
        hasPermission = modDefaults.includes(permission);
      }
    }

    if (!hasPermission) {
      return {
        success: false,
        error: `Fehlende Berechtigung: ${permission}`
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Error checking permission:', error);
    return { success: false, error: 'Fehler bei der Berechtigungsprüfung' };
  }
}