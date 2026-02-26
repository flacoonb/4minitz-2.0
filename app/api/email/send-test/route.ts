import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import connectToDatabase from '@/lib/mongodb';
import { getTransporter, getFromEmail, getOrgName } from '@/lib/email-service';

/**
 * POST /api/email/send-test
 * Send a simple test email to verify SMTP configuration
 */
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (authResult.user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Only administrators can send test emails' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const toEmail = body.to || body.toEmail;

    if (!toEmail) {
      return NextResponse.json(
        { success: false, error: 'toEmail is required' },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(toEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Use the shared transporter (reads from DB, falls back to env)
    const transporter = await getTransporter();
    const fromEmail = await getFromEmail();
    const orgName = await getOrgName();

    const currentDate = new Date().toLocaleString('de-DE', {
      dateStyle: 'full',
      timeStyle: 'short'
    });

    const info = await transporter.sendMail({
      from: fromEmail,
      to: toEmail,
      subject: `Test-Email von ${orgName}`,
      text: `Hallo,\n\nDies ist eine Test-Email von ${orgName}.\n\nWenn Sie diese Email erhalten haben, funktioniert die Email-Konfiguration korrekt.\n\nZeitstempel: ${currentDate}\n\n---\n${orgName}`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; }
              .info-box { background: white; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 0.875rem; border-top: 1px solid #e5e7eb; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0;">${orgName}</h1>
            </div>
            <div class="content">
              <h2 style="color: #10b981; text-align: center;">Test-Email erfolgreich!</h2>
              <p>Dies ist eine Test-Email von ${orgName}.</p>
              <div class="info-box">
                <p style="margin: 0;">Wenn Sie diese Email erhalten haben, funktioniert die Email-Konfiguration korrekt.</p>
              </div>
              <div class="info-box" style="border-left-color: #3b82f6;">
                <p style="margin: 0; font-size: 0.875rem;"><strong>Zeitstempel:</strong> ${currentDate}</p>
              </div>
            </div>
            <div class="footer">
              <p style="margin: 0;">${orgName}</p>
            </div>
          </body>
        </html>
      `,
    });

    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      messageId: info.messageId,
      to: toEmail,
      timestamp: new Date().toISOString(),
    });

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: `Failed to send test email: ${errMsg}`,
      },
      { status: 500 }
    );
  }
}
