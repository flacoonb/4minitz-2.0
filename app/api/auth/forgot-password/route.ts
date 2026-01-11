import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { checkRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';
import { getTranslations } from 'next-intl/server';
import { sendPasswordResetEmail } from '@/lib/emailService';

// POST /api/auth/forgot-password
export async function POST(request: NextRequest) {
  const t = await getTranslations('errors');

  try {
    // Rate Limit: 5 attempts per hour
    const rateLimit = checkRateLimit(request, 5, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: t('tooManyPasswordResetAttempts') }, { status: 429 });
    }

    await connectDB();

    const body = await request.json().catch(() => ({}));
    const emailRaw = (body?.email || '').toString().trim().toLowerCase();

    if (!emailRaw) {
      return NextResponse.json({ error: t('required') }, { status: 400 });
    }

    // Basic email validation
    if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/.test(emailRaw)) {
      return NextResponse.json({ error: t('invalidEmail') }, { status: 400 });
    }

    const user = await User.findOne({ email: emailRaw });

    // Always return success (avoid user enumeration)
    if (user && user.isActive) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      user.passwordResetTokenHash = tokenHash;
      user.passwordResetExpires = expires;
      await user.save();

      const locale = (user.preferences?.language === 'en' ? 'en' : 'de') as 'de' | 'en';

      try {
        await sendPasswordResetEmail(
          { email: user.email, firstName: user.firstName, lastName: user.lastName },
          token,
          locale
        );
      } catch (emailError) {
        console.error('Failed to send password reset email:', emailError);
      }
    }

    return NextResponse.json({
      success: true,
      message: t('passwordResetEmailSent'),
    });
  } catch (error) {
    console.error('Error requesting password reset:', error);
    return NextResponse.json({ error: t('serverError') }, { status: 500 });
  }
}
