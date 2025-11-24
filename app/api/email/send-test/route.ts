import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { verifyToken } from '@/lib/auth';

/**
 * POST /api/email/send-test
 * Send a simple test email to verify SMTP configuration
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authentication - only admins can test
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

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(toEmail)) {
      return NextResponse.json(
        { success: false, error: 'Invalid email address' },
        { status: 400 }
      );
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '25'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined,
    });

    const fromEmail = process.env.FROM_EMAIL || 'noreply@protokoll-app.local';
    const currentDate = new Date().toLocaleString('de-DE', {
      dateStyle: 'full',
      timeStyle: 'short'
    });

    // Send test email
    const info = await transporter.sendMail({
      from: fromEmail,
      to: toEmail,
      subject: '✓ Test-Email von Protokoll-APP',
      text: `Hallo,

Dies ist eine Test-Email von der Protokoll-APP.

Wenn Sie diese Email erhalten haben, funktioniert die Email-Konfiguration korrekt.

Zeitstempel: ${currentDate}

---
© Copyright by Bph
Protokoll-APP`,
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .header {
                background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                color: white;
                padding: 30px;
                text-align: center;
                border-radius: 10px 10px 0 0;
              }
              .content {
                background: #f9fafb;
                padding: 30px;
                border: 1px solid #e5e7eb;
                border-top: none;
              }
              .success-icon {
                font-size: 48px;
                color: #10b981;
                margin-bottom: 20px;
              }
              .info-box {
                background: white;
                border-left: 4px solid #10b981;
                padding: 15px;
                margin: 20px 0;
                border-radius: 4px;
              }
              .footer {
                text-align: center;
                padding: 20px;
                color: #6b7280;
                font-size: 0.875rem;
                border-top: 1px solid #e5e7eb;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0;">Protokoll-APP</h1>
            </div>
            <div class="content">
              <div class="success-icon" style="text-align: center;">✓</div>
              <h2 style="color: #10b981; text-align: center; margin-bottom: 20px;">
                Test-Email erfolgreich!
              </h2>
              
              <p><strong>Hallo,</strong></p>
              <p>Dies ist eine Test-Email von der Protokoll-APP.</p>
              
              <div class="info-box">
                <p style="margin: 0;">
                  ✓ Wenn Sie diese Email erhalten haben, funktioniert die Email-Konfiguration korrekt.
                </p>
              </div>

              <div class="info-box" style="border-left-color: #3b82f6;">
                <p style="margin: 0; font-size: 0.875rem;">
                  <strong>Zeitstempel:</strong> ${currentDate}
                </p>
              </div>

              <p style="font-size: 0.875rem; color: #6b7280; margin-top: 30px;">
                Diese Email wurde automatisch vom System generiert.
              </p>
            </div>
            <div class="footer">
              <p style="margin: 0;">© Copyright by Bph</p>
              <p style="margin: 5px 0 0 0;">Protokoll-APP</p>
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

  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
