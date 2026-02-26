import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Settings from '@/models/Settings';
import { generateToken } from '@/lib/auth';
import { logAction } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';
import { getTranslations } from 'next-intl/server';

// POST - Login user
export async function POST(request: NextRequest) {
  const t = await getTranslations('errors');

  try {
    // Rate Limit: 5 attempts per 15 minutes
    const rateLimit = checkRateLimit(request, 5, 15 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: t('tooManyLoginAttempts') },
        { status: 429 }
      );
    }

    await connectDB();

    const body = await request.json();
    const { username, password } = body;

    // Validation
    if (!username || !password) {
      return NextResponse.json(
        { error: t('missingCredentials') },
        { status: 400 }
      );
    }

    // Find user by email or username
    const user = await User.findOne({
      $or: [
        { email: username.toLowerCase() },
        { username: username }
      ]
    });

    if (!user) {
      return NextResponse.json(
        { error: t('invalidCredentials') },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { error: t('accountDeactivated') },
        { status: 403 }
      );
    }

    // Check if email verification is required
    const settings = await Settings.findOne({}).sort({ version: -1 });
    const requireEmailVerification = settings?.memberSettings?.requireEmailVerification ?? true;

    if (requireEmailVerification && !user.isEmailVerified && user.role !== 'admin') {
      return NextResponse.json(
        { error: t('emailVerificationRequired') },
        { status: 403 }
      );
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: t('invalidCredentials') },
        { status: 401 }
      );
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Audit Log
    await logAction({
      action: 'LOGIN',
      details: `User ${user.username} logged in`,
      userId: user._id.toString(),
      username: user.username,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      resourceType: 'User',
      resourceId: user._id.toString()
    });

    // Get session timeout from settings
    // settings already fetched above
    const sessionTimeoutMinutes = settings?.systemSettings?.sessionTimeout || 480; // Default 8 hours
    const sessionTimeoutSeconds = sessionTimeoutMinutes * 60;

    // Generate JWT token with settings-based expiry
    const token = generateToken(user, sessionTimeoutSeconds);

    // Create response with user data
    const userResponse = user.toJSON();

    // Set HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      message: t('loginSuccess'),
      user: userResponse,
    });

    // Determine if we should use secure cookies
    // In production, we usually want secure cookies, unless we are explicitly running on HTTP (e.g. local network)
    const isProduction = process.env.NODE_ENV === 'production';
    const isHttp = process.env.APP_URL?.startsWith('http://');
    const useSecureCookies = isProduction && !isHttp && process.env.DISABLE_SECURE_COOKIES !== 'true';

    // Set secure cookie
    response.cookies.set({
      name: 'auth-token',
      value: token,
      httpOnly: true,
      secure: useSecureCookies,
      sameSite: 'lax', // Changed from strict to lax to be more forgiving
      maxAge: sessionTimeoutSeconds
    });

    // Set locale cookie if user has a preference
    if (user.preferences && user.preferences.language) {
      // IMPORTANT: We must set the cookie on the response object that is returned
      // AND we need to make sure the path is root '/'
      response.cookies.set('NEXT_LOCALE', user.preferences.language, {
        path: '/',
        maxAge: 365 * 24 * 60 * 60, // 1 year
        sameSite: 'lax',
        secure: useSecureCookies,
        httpOnly: false // Allow client-side access if needed
      });
    }

    return response;

  } catch (error: any) {
    return NextResponse.json(
      { error: t('loginError') },
      { status: 500 }
    );
  }
}