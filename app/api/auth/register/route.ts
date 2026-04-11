import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import Settings from '@/models/Settings';
import { checkRateLimit, checkRateLimitByKey } from '@/lib/rate-limit';
import { registerSchema, validateBody } from '@/lib/validations';
import { stripTrailingSlashes } from '@/lib/strip-trailing-slashes';
import { sendWelcomeEmail, sendVerificationEmail, getTransporter, getFromEmail, getAppUrl } from '@/lib/email-service';
import crypto from 'crypto';
import { getTranslations } from 'next-intl/server';

async function generateInternalUsername(email: string): Promise<string> {
  const localPart = String(email.split('@')[0] || 'user');
  const base = localPart
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 18) || 'user';

  for (let attempt = 0; attempt < 30; attempt += 1) {
    const suffix = crypto.randomBytes(3).toString('hex');
    const candidate = `${base}-${suffix}`;
    const exists = await User.exists({
      $or: [{ username: candidate }, { usernameHistory: candidate }],
    });
    if (!exists) return candidate;
  }

  return `user-${Date.now().toString(36)}-${crypto.randomBytes(2).toString('hex')}`;
}

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

    const body = await request.json().catch(() => ({}));
    const validation = validateBody(registerSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }
    const { email, password, firstName, lastName } = validation.data;
    const role = 'user';
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = await generateInternalUsername(normalizedEmail);
    const accountRateLimit = checkRateLimitByKey(
      `register-account:${normalizedEmail}`,
      5,
      60 * 60 * 1000
    );
    if (!accountRateLimit.allowed) {
      return NextResponse.json(
        { error: t('tooManyRegisterAttempts') },
        { status: 429 }
      );
    }

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
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }, { usernameHistory: normalizedUsername }]
    });

    if (existingUser) {
      const errorMsg = existingUser.email === normalizedEmail ? t('emailInUse') : t('usernameInUse');
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
      email: normalizedEmail,
      username: normalizedUsername,
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
      try {
        await sendVerificationEmail(
          {
            email: newUser.email,
            firstName: newUser.firstName,
            lastName: newUser.lastName,
          },
          verificationToken
        );
      } catch {
        // Continue registration even if email fails
      }
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

    // Minimal response: UI only needs message + requiresApproval (no full user object).
    return NextResponse.json(
      {
        success: true,
        message,
        requiresApproval: requireAdminApproval,
      },
      { status: 201 }
    );

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

    const baseUrl = stripTrailingSlashes(await getAppUrl());

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
