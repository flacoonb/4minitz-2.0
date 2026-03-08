import { NextRequest, NextResponse } from 'next/server';
import { testEmailConfiguration, sendNewMinutesNotification } from '@/lib/email-service';
import connectDB from '@/lib/mongodb';
import Minutes from '@/models/Minutes';
import { verifyToken } from '@/lib/auth';

// Test email configuration
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const testResult = await testEmailConfiguration();

    return NextResponse.json({
      success: testResult.success,
      message: testResult.success ? 'Email configuration is valid' : `Email configuration test failed: ${testResult.error}`,
      error: testResult.error || null,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Email configuration check failed'
      },
      { status: 500 }
    );
  }
}

// Send test email
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    const { minuteId, locale = 'de' } = await request.json();

    if (!minuteId) {
      return NextResponse.json(
        { success: false, error: 'minuteId is required' },
        { status: 400 }
      );
    }

    await connectDB();
    const minute = await Minutes.findById(minuteId).populate('meetingSeries_id');

    if (!minute) {
      return NextResponse.json(
        { success: false, error: 'Minute not found' },
        { status: 404 }
      );
    }

    await sendNewMinutesNotification(minute, locale);

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send test email'
      },
      { status: 500 }
    );
  }
}
