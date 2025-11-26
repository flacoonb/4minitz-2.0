import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { testEmailConfiguration } from '@/lib/email-service';
import Settings from '@/models/Settings';
import { encrypt } from '@/lib/crypto';

/**
 * GET /api/admin/email-config
 * Get current email configuration (without sensitive data)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (authResult.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Only administrators can view email configuration' },
        { status: 403 }
      );
    }

    // Test configuration
    const isValid = await testEmailConfiguration();

    // Fetch settings from DB
    const settings = await Settings.findOne({}).sort({ version: -1 });
    const smtpSettings = settings?.smtpSettings;

    // Determine config source (DB or Env)
    const config = smtpSettings?.host ? {
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.secure,
      hasAuth: !!(smtpSettings.auth?.user && smtpSettings.auth?.pass),
      user: smtpSettings.auth?.user || null,
      fromEmail: smtpSettings.from,
      source: 'database'
    } : {
      host: process.env.SMTP_HOST || 'localhost',
      port: process.env.SMTP_PORT || '25',
      secure: process.env.SMTP_SECURE === 'true',
      hasAuth: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      user: process.env.SMTP_USER || null,
      fromEmail: process.env.FROM_EMAIL || 'noreply@4minitz.local',
      source: 'environment'
    };

    return NextResponse.json({
      success: true,
      config,
      isValid,
    });
  } catch (error) {
    console.error('Email config error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/email-config
 * Update email configuration (updates database)
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify admin authentication
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (authResult.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Only administrators can update email configuration' },
        { status: 403 }
      );
    }

    const { host, port, secure, user, password, fromEmail } = await request.json();

    // Validation
    if (!host || !port || !fromEmail) {
      return NextResponse.json(
        { success: false, error: 'Host, port, and fromEmail are required' },
        { status: 400 }
      );
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(fromEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid fromEmail address' },
        { status: 400 }
      );
    }

    // Update Settings in Database
    let settings = await Settings.findOne({}).sort({ version: -1 });
    if (!settings) {
      settings = new Settings({
        lastModifiedBy: authResult.user._id,
        roles: { /* defaults will be used */ }
      });
    }



    // ... (inside PUT handler)

    // Update SMTP settings
    settings.smtpSettings = {
      host,
      port: parseInt(port),
      secure,
      auth: {
        user: user || '',
        pass: password ? encrypt(password) : (settings.smtpSettings?.auth?.pass || '') // Encrypt new password or keep existing
      },
      from: fromEmail
    };

    settings.lastModifiedBy = authResult.user._id;
    await settings.save();

    // Test the new configuration
    const isValid = await testEmailConfiguration();

    return NextResponse.json({
      success: true,
      message: isValid
        ? 'Email configuration saved and verified successfully.'
        : 'Configuration saved but connection test failed. Please check your settings.',
      isValid
    });

  } catch (error) {
    console.error('Email config update error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
