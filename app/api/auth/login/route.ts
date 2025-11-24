import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Settings from '@/models/Settings';
import jwt from 'jsonwebtoken';
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
    const sessionTimeoutMs = sessionTimeoutSeconds * 1000;

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: sessionTimeoutSeconds }
    );

    // Create response with user data
    const userResponse = user.toJSON();

    // Set HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      message: t('loginSuccess'),
      user: userResponse,
      token
    });

    // Set secure cookie
    response.cookies.set({
      name: 'auth-token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production' && process.env.DISABLE_SECURE_COOKIES !== 'true',
      sameSite: 'strict',
      maxAge: sessionTimeoutMs
    });

    return response;

  } catch (error: any) {
    console.error('Error logging in user:', error);
    return NextResponse.json(
      { error: t('loginError') },
      { status: 500 }
    );
  }
}