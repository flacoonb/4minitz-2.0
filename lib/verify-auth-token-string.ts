import jwt from 'jsonwebtoken';
import User, { IUser } from '@/models/User';
import connectDB from '@/lib/mongodb';
import { getJwtSecret } from '@/lib/validateEnv';

export interface VerifyTokenStringResult {
  success: boolean;
  user?: IUser;
  error?: string;
}

/** Shared JWT + DB validation (user active, tokenVersion). */
export async function verifyAuthTokenString(
  token: string | undefined | null
): Promise<VerifyTokenStringResult> {
  try {
    await connectDB();

    if (!token) {
      return { success: false, error: 'Nicht authentifiziert' };
    }

    const decoded = jwt.verify(token, getJwtSecret()) as {
      userId: string;
      tokenVersion?: number;
    };

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return { success: false, error: 'Benutzer nicht gefunden oder deaktiviert' };
    }

    const decodedTokenVersion = typeof decoded.tokenVersion === 'number' ? decoded.tokenVersion : 0;
    const currentTokenVersion =
      typeof (user as { tokenVersion?: number }).tokenVersion === 'number'
        ? (user as { tokenVersion: number }).tokenVersion
        : 0;
    if (decodedTokenVersion !== currentTokenVersion) {
      return { success: false, error: 'Ungültiger Token' };
    }

    return { success: true, user };
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'JsonWebTokenError') {
      return { success: false, error: 'Ungültiger Token' };
    }
    if (err.name === 'TokenExpiredError') {
      return { success: false, error: 'Token abgelaufen' };
    }
    return { success: false, error: 'Authentifizierungsfehler' };
  }
}
