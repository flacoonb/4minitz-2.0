import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { checkRateLimit } from '@/lib/rate-limit';
import { resetPasswordSchema, validateBody } from '@/lib/validations';
import crypto from 'crypto';
import { getTranslations } from 'next-intl/server';

// POST /api/auth/reset-password
export async function POST(request: NextRequest) {
  const t = await getTranslations('errors');

  try {
    // Rate Limit: 10 attempts per hour
    const rateLimit = checkRateLimit(request, 10, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: t('tooManyRequests') }, { status: 429 });
    }

    await connectDB();

    const body = await request.json().catch(() => ({}));
    const validation = validateBody(resetPasswordSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: t('required') }, { status: 400 });
    }
    const { token, password } = validation.data;

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: { $gt: Date.now() },
      isActive: true,
    });

    if (!user) {
      return NextResponse.json({ error: t('invalidOrExpiredToken') }, { status: 400 });
    }

    user.password = password; // hashed via pre-save hook
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    const response = NextResponse.json({
      success: true,
      message: t('passwordResetSuccess'),
    });

    // Force logout on password reset
    const isProduction = process.env.NODE_ENV === 'production';
    const isHttp = process.env.APP_URL?.startsWith('http://');
    const useSecureCookies = isProduction && !isHttp && process.env.DISABLE_SECURE_COOKIES !== 'true';

    response.cookies.set({
      name: 'auth-token',
      value: '',
      httpOnly: true,
      secure: useSecureCookies,
      sameSite: 'lax',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('Error resetting password:', error);
    return NextResponse.json({ error: t('serverError') }, { status: 500 });
  }
}
