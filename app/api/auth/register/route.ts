import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Settings from '@/models/Settings';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendWelcomeEmail, sendVerificationEmail } from '@/lib/email-service';
import crypto from 'crypto';
import { getTranslations } from 'next-intl/server';

// POST - Register new user
export async function POST(request: NextRequest) {
  const t = await getTranslations('errors');

  try {
    // Rate Limit: 5 attempts per hour for registration
    const rateLimit = checkRateLimit(request, 5, 60 * 60 * 1000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: t('tooManyRegisterAttempts') },
        { status: 429 }
      );
    }

    await connectDB();

    const body = await request.json();
    const {
      email,
      username,
      password,
      firstName,
      lastName,
      role = 'user'
    } = body;

    // Validation
    if (!email || !username || !password || !firstName || !lastName) {
      return NextResponse.json(
        { error: t('required') },
        { status: 400 }
      );
    }

    // Check if self-registration is allowed
    const settings = await Settings.findOne({}).sort({ version: -1 });
    if (settings && settings.memberSettings && settings.memberSettings.allowSelfRegistration === false) {
      // Allow registration only if no users exist (first run / setup)
      const userCount = await User.countDocuments();
      if (userCount > 0) {
        return NextResponse.json(
          { error: t('registrationDisabled') },
          { status: 403 }
        );
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      const errorMsg = existingUser.email === email ? t('emailInUse') : t('usernameInUse');
      return NextResponse.json(
        { error: errorMsg },
        { status: 409 }
      );
    }

    // Create new user
    const newUser = new User({
      email,
      username,
      password, // Will be hashed by pre-save middleware
      firstName,
      lastName,
      role,
      isActive: true,
      isEmailVerified: false
    });

    await newUser.save();

    // Check if email verification is required
    // settings is already fetched above
    const requireEmailVerification = settings?.requireEmailVerification ?? true;

    if (requireEmailVerification) {
      // Generate verification token (valid for 24 hours)
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      newUser.emailVerificationToken = verificationToken;
      newUser.emailVerificationExpires = verificationExpires;
      await newUser.save();

      // Send verification email
      try {
        await sendVerificationEmail({
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName
        }, verificationToken);
        console.log('Verification email sent to:', newUser.email);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Continue registration even if email fails
      }
    } else {
      // If verification not required, send welcome email instead
      sendWelcomeEmail({
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName
      }).catch(err => console.error('Failed to send welcome email:', err));
    }

    // Return user without password
    const userResponse = newUser.toJSON();

    return NextResponse.json({
      success: true,
      message: requireEmailVerification
        ? t('registrationSuccessVerify')
        : t('registrationSuccess'),
      data: userResponse,
      requiresVerification: requireEmailVerification
    }, { status: 201 });

  } catch (error: any) {
    console.error('Error registering user:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message);
      return NextResponse.json(
        { error: `Validierungsfehler: ${validationErrors.join(', ')}` },
        { status: 400 }
      );
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const errorMsg = field === 'email' ? t('emailInUse') : t('usernameInUse');
      return NextResponse.json(
        { error: errorMsg },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: t('registrationError') },
      { status: 500 }
    );
  }
}