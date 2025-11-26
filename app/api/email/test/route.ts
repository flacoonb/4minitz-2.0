import { NextRequest, NextResponse } from 'next/server';
import { testEmailConfiguration, sendNewMinutesNotification } from '@/lib/email-service';
import connectDB from '@/lib/mongodb';
import Minutes from '@/models/Minutes';

// Test email configuration
export async function GET(_request: NextRequest) {
  try {
    const isValid = await testEmailConfiguration();
    
    return NextResponse.json({
      success: isValid,
      message: isValid ? 'Email configuration is valid' : 'Email configuration test failed',
      config: {
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_SECURE === 'true',
        hasAuth: !!(process.env.SMTP_USER && process.env.SMTP_PASS),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Send test email
export async function POST(request: NextRequest) {
  try {
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
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
