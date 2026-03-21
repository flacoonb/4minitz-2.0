import { cookies } from 'next/headers';
import type { IUser } from '@/models/User';
import { verifyAuthTokenString } from '@/lib/verify-auth-token-string';

export interface AuthPageResult {
  success: boolean;
  user?: IUser;
  error?: string;
}

/** Server layouts: session from auth-token cookie only (no Bearer). */
export async function getSessionFromCookies(): Promise<AuthPageResult> {
  const cookieStore = await cookies();
  return verifyAuthTokenString(cookieStore.get('auth-token')?.value);
}
