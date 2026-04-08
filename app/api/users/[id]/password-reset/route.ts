import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import { sendPasswordResetEmail } from '@/lib/email-service';
import { checkRateLimitByKey } from '@/lib/rate-limit';
import { getTranslations } from 'next-intl/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations('errors');

  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const permissionResult = await requirePermission(authResult.user!, 'canManageUsers');
    if (!permissionResult.success) {
      return NextResponse.json({ error: permissionResult.error }, { status: 403 });
    }

    const { id } = await params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ error: 'Ungültige Benutzer-ID' }, { status: 400 });
    }

    const targetRateLimit = checkRateLimitByKey(`admin-password-reset:${id}`, 5, 60 * 60 * 1000);
    if (!targetRateLimit.allowed) {
      return NextResponse.json({ error: t('tooManyPasswordResetAttempts') }, { status: 429 });
    }

    const user = await User.findById(id).select('email firstName lastName preferences isActive');
    if (!user) {
      return NextResponse.json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Passwort-Zurücksetzen ist für inaktive Benutzer nicht möglich' },
        { status: 400 }
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    user.passwordResetTokenHash = tokenHash;
    user.passwordResetExpires = expires;
    await user.save();

    const locale = (user.preferences?.language === 'en' ? 'en' : 'de') as 'de' | 'en';

    await sendPasswordResetEmail(
      { email: user.email, firstName: user.firstName, lastName: user.lastName },
      token,
      locale
    );

    return NextResponse.json({
      success: true,
      message: 'E-Mail zum Zurücksetzen des Passworts wurde gesendet',
    });
  } catch (error) {
    console.error('Error sending admin password reset email:', error);
    return NextResponse.json({ error: t('serverError') }, { status: 500 });
  }
}
