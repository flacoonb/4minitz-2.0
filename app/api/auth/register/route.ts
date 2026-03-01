import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Settings from '@/models/Settings';
import { checkRateLimit } from '@/lib/rate-limit';
import { registerSchema, validateBody } from '@/lib/validations';
import { sendWelcomeEmail, sendVerificationEmail, getTransporter, getFromEmail } from '@/lib/email-service';
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
    const validation = validateBody(registerSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }
    const { email, username, password, firstName, lastName } = validation.data;
    const role = 'user';

    // Check if self-registration is allowed
    const settings = await Settings.findOne({}).sort({ updatedAt: -1 });
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

    // Check if email verification is required
    const requireEmailVerification = settings?.memberSettings?.requireEmailVerification ?? true;
    const requireAdminApproval = settings?.memberSettings?.requireAdminApproval ?? true;

    // Generate verification token before save to avoid half-initialized user in DB
    let verificationToken: string | null = null;
    const userFields: Record<string, unknown> = {
      email,
      username,
      password, // Will be hashed by pre-save middleware
      firstName,
      lastName,
      role,
      isActive: !requireAdminApproval, // Inactive until admin approves (if enabled)
      pendingApproval: requireAdminApproval, // Explicit flag for pending approval state
      isEmailVerified: false
    };

    if (requireEmailVerification) {
      verificationToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
      userFields.emailVerificationToken = tokenHash;
      userFields.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    }

    // Create and save user (single save with all fields)
    const newUser = new User(userFields);
    await newUser.save();

    if (requireEmailVerification && verificationToken) {
      // Send verification email
      let emailSent = false;
      try {
        await sendVerificationEmail({
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName
        }, verificationToken);
        emailSent = true;
      } catch {
        // Continue registration even if email fails
      }
      (newUser as any)._emailSent = emailSent;
    } else {
      // If verification not required, send welcome email instead
      sendWelcomeEmail({
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName
      }).catch(() => {});
    }

    // Notify admins about new registration if approval is required
    if (requireAdminApproval) {
      notifyAdminsAboutNewUser(newUser).catch(() => {});
    }

    // Determine response message
    let message: string;
    if (requireEmailVerification && requireAdminApproval) {
      message = t('registrationSuccessVerifyAndApproval');
    } else if (requireEmailVerification) {
      message = t('registrationSuccessVerify');
    } else if (requireAdminApproval) {
      message = t('registrationSuccessApproval');
    } else {
      message = t('registrationSuccess');
    }

    // Return user without password
    const userResponse = newUser.toJSON();

    return NextResponse.json({
      success: true,
      message,
      data: userResponse,
      requiresVerification: requireEmailVerification,
      requiresApproval: requireAdminApproval,
      emailSent: (newUser as any)._emailSent !== false,
    }, { status: 201 });

  } catch (error: any) {
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { error: t('validationError') },
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

/** Escape HTML special characters to prevent XSS in email templates */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Notify all admin users about a new registration that requires approval
 */
async function notifyAdminsAboutNewUser(newUser: { firstName: string; lastName: string; email: string; username: string }) {
  try {
    const admins = await User.find({ role: 'admin', isActive: true }).select('email firstName');

    if (admins.length === 0) return;

    const settings = await Settings.findOne({}).sort({ updatedAt: -1 });
    const baseUrl = settings?.systemSettings?.baseUrl || process.env.APP_URL || 'http://localhost:3000';

    const safeName = `${escapeHtml(newUser.firstName)} ${escapeHtml(newUser.lastName)}`;
    const safeEmail = escapeHtml(newUser.email);
    const safeUsername = escapeHtml(newUser.username);
    const subject = `Neue Registrierung: ${newUser.firstName} ${newUser.lastName}`;
    const html = `
      <h2>Neue Benutzerregistrierung</h2>
      <p>Ein neuer Benutzer hat sich registriert und wartet auf Freischaltung:</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Name:</td><td>${safeName}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">E-Mail:</td><td>${safeEmail}</td></tr>
        <tr><td style="padding: 4px 12px 4px 0; font-weight: bold;">Benutzername:</td><td>${safeUsername}</td></tr>
      </table>
      <p>
        <a href="${baseUrl}/admin/users" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 6px;">
          Benutzerverwaltung öffnen
        </a>
      </p>
    `;

    const transporter = await getTransporter();
    const from = await getFromEmail();
    for (const admin of admins) {
      await transporter.sendMail({ from, to: admin.email, subject, html }).catch(() => {});
    }
  } catch {
    // Non-critical: registration succeeded, notification failed
  }
}