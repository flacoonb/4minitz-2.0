import nodemailer from 'nodemailer';
import { IMinutes } from '@/models/Minutes';
import { IMeetingSeries } from '@/models/MeetingSeries';
import Settings from '@/models/Settings';
import { decrypt } from '@/lib/crypto';

// Email Configuration
const EMAIL_CONFIG = {
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
};

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@4minitz.local';
// APP_URL is now dynamic via getAppUrl()

async function getAppUrl() {
  try {
    const settings = await Settings.findOne({}).sort({ version: -1 });
    if (settings && settings.systemSettings && settings.systemSettings.baseUrl) {
      return settings.systemSettings.baseUrl;
    }
  } catch (e) { }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;

async function getTransporter() {
  // Try to get settings from DB first
  try {
    const settings = await Settings.findOne({}).sort({ version: -1 });

    // Check if email notifications are enabled globally
    if (settings && settings.notificationSettings && settings.notificationSettings.enableEmailNotifications === false) {
      console.log('Email notifications are disabled in settings');
      // Return a dummy transporter that does nothing but log
      return {
        sendMail: async (mailOptions: any) => {
          console.log('Email sending skipped (disabled in settings). Would have sent to:', mailOptions.to);
          return { messageId: 'skipped-disabled' };
        },
        verify: async () => true
      } as any;
    }



    // ... (inside getTransporter function)

    if (settings && settings.smtpSettings && settings.smtpSettings.host) {
      const { host, port, secure, auth } = settings.smtpSettings;

      // Decrypt password if present
      const decryptedPass = auth.pass ? decrypt(auth.pass) : '';

      console.log('Creating transporter with DB settings:', { host, port, secure, hasAuth: !!auth.user });
      transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: auth.user && decryptedPass ? { user: auth.user, pass: decryptedPass } : undefined
      });
      return transporter;
    }
  } catch (e) {
    console.warn('Failed to fetch settings from DB, falling back to env vars', e);
  }

  // Fallback to env vars
  console.log('Creating transporter with env vars:', EMAIL_CONFIG);
  transporter = nodemailer.createTransport(EMAIL_CONFIG);
  return transporter;
}

async function getFromEmail() {
  try {
    const settings = await Settings.findOne({}).sort({ version: -1 });
    if (settings && settings.smtpSettings && settings.smtpSettings.from) {
      return settings.smtpSettings.from;
    }
  } catch (e) { }
  return FROM_EMAIL;
}

export interface EmailTemplate {
  subject: string;
  text: string;
  html: string;
}

// Email Templates
const translations = {
  de: {
    newMinute: {
      subject: (series: string) => `Neues Protokoll: ${series}`,
      greeting: 'Hallo',
      intro: (series: string, date: string) =>
        `Ein neues Protokoll wurde für die Sitzung "${series}" am ${date} erstellt.`,
      participantsList: 'Teilnehmer:',
      topicsCount: (count: number) => `Anzahl Themen: ${count}`,
      actionItemsCount: (count: number) => `Anzahl Aktionspunkte: ${count}`,
      viewButton: 'Protokoll anzeigen',
      footer: 'Diese E-Mail wurde automatisch von 4Minitz versendet.',
    },
    actionItemAssigned: {
      subject: (series: string) => `Neuer Aktionspunkt zugewiesen: ${series}`,
      greeting: 'Hallo',
      intro: 'Ihnen wurde ein neuer Aktionspunkt zugewiesen:',
      actionItem: 'Aktionspunkt:',
      priority: 'Priorität:',
      dueDate: 'Fällig:',
      viewButton: 'Aktionspunkt anzeigen',
      footer: 'Diese E-Mail wurde automatisch von 4Minitz versendet.',
    },
    actionItemOverdue: {
      subject: (count: number) => `${count} überfällige Aktionspunkte`,
      greeting: 'Hallo',
      intro: (count: number) => `Sie haben ${count} überfällige Aktionspunkte:`,
      viewButton: 'Dashboard anzeigen',
      footer: 'Diese E-Mail wurde automatisch von 4Minitz versendet.',
    },
    welcome: {
      subject: 'Willkommen bei 4Minitz!',
      greeting: 'Hallo',
      intro: 'Willkommen bei 4Minitz! Ihr Konto wurde erfolgreich erstellt.',
      loginButton: 'Bei 4Minitz anmelden',
      footer: 'Diese E-Mail wurde automatisch von 4Minitz versendet.',
    },
    verifyEmail: {
      subject: 'Bestätigen Sie Ihre E-Mail-Adresse',
      greeting: 'Hallo',
      intro: 'Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren.',
      verifyButton: 'E-Mail bestätigen',
      expiryNote: 'Dieser Link ist 24 Stunden gültig.',
      footer: 'Diese E-Mail wurde automatisch von 4Minitz versendet.',
    },
  },
  en: {
    newMinute: {
      subject: (series: string) => `New Minutes: ${series}`,
      greeting: 'Hello',
      intro: (series: string, date: string) =>
        `New minutes have been created for the session "${series}" on ${date}.`,
      participantsList: 'Participants:',
      topicsCount: (count: number) => `Number of topics: ${count}`,
      actionItemsCount: (count: number) => `Number of action items: ${count}`,
      viewButton: 'View Minutes',
      footer: 'This email was sent automatically by 4Minitz.',
    },
    actionItemAssigned: {
      subject: (series: string) => `New Action Item Assigned: ${series}`,
      greeting: 'Hello',
      intro: 'You have been assigned a new action item:',
      actionItem: 'Action Item:',
      priority: 'Priority:',
      dueDate: 'Due:',
      viewButton: 'View Action Item',
      footer: 'This email was sent automatically by 4Minitz.',
    },
    actionItemOverdue: {
      subject: (count: number) => `${count} Overdue Action Items`,
      greeting: 'Hello',
      intro: (count: number) => `You have ${count} overdue action items:`,
      viewButton: 'View Dashboard',
      footer: 'This email was sent automatically by 4Minitz.',
    },
    welcome: {
      subject: 'Welcome to 4Minitz!',
      greeting: 'Hello',
      intro: 'Welcome to 4Minitz! Your account has been successfully created.',
      loginButton: 'Login to 4Minitz',
      footer: 'This email was sent automatically by 4Minitz.',
    },
    verifyEmail: {
      subject: 'Verify Your Email Address',
      greeting: 'Hello',
      intro: 'Please verify your email address to activate your account.',
      verifyButton: 'Verify Email',
      expiryNote: 'This link is valid for 24 hours.',
      footer: 'This email was sent automatically by 4Minitz.',
    },
  },
};

// Helper function to generate email HTML
function generateEmailHTML(content: string): string {
  return `
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
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
          }
          .content {
            background: #f9fafb;
            padding: 30px;
            border: 1px solid #e5e7eb;
          }
          .button {
            display: inline-block;
            background: #3b82f6;
            color: white !important;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
            font-weight: 600;
          }
          .footer {
            text-align: center;
            padding: 20px;
            color: #6b7280;
            font-size: 0.875rem;
            border-top: 1px solid #e5e7eb;
          }
          .info-box {
            background: white;
            border-left: 4px solid #3b82f6;
            padding: 15px;
            margin: 15px 0;
            border-radius: 4px;
          }
          .priority-high {
            border-left-color: #ef4444;
          }
          .priority-medium {
            border-left-color: #f59e0b;
          }
          .priority-low {
            border-left-color: #10b981;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 style="margin: 0;">4Minitz</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          ${translations.de.newMinute.footer}
        </div>
      </body>
    </html>
  `;
}

// Send new minutes notification
export async function sendNewMinutesNotification(
  minute: IMinutes & { meetingSeries?: IMeetingSeries },
  locale: 'de' | 'en' = 'de'
): Promise<void> {
  const t = translations[locale].newMinute;

  if (!minute.meetingSeries) {
    throw new Error('Meeting series information required');
  }

  const recipients = [
    ...(minute.meetingSeries.visibleFor || []),
    ...(minute.participants || []),
  ].filter((email, index, self) => self.indexOf(email) === index); // Remove duplicates

  if (recipients.length === 0) {
    console.log('No recipients for minutes notification');
    return;
  }

  const seriesName = `${minute.meetingSeries.project} - ${minute.meetingSeries.name}`;
  const date = new Date(minute.date).toLocaleDateString(locale);
  const appUrl = await getAppUrl();
  const minuteUrl = `${appUrl}/minutes/${minute._id}`;

  const actionItemsCount = minute.topics?.reduce((count: number, topic: any) => {
    return count + (topic.infoItems?.filter((item: any) => item.isActionItem).length || 0);
  }, 0) || 0;

  const htmlContent = `
    <p><strong>${t.greeting},</strong></p>
    <p>${t.intro(seriesName, date)}</p>
    
    <div class="info-box">
      <p><strong>${t.topicsCount(minute.topics?.length || 0)}</strong></p>
      <p><strong>${t.actionItemsCount(actionItemsCount)}</strong></p>
    </div>

    ${minute.participants && minute.participants.length > 0 ? `
      <div class="info-box">
        <p><strong>${t.participantsList}</strong></p>
        <ul>
          ${minute.participants.map((p: string) => `<li>${p}</li>`).join('')}
        </ul>
      </div>
    ` : ''}

    <center>
      <a href="${minuteUrl}" class="button">${t.viewButton}</a>
    </center>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: recipients.join(', '),
    subject: t.subject(seriesName),
    text: `${t.intro(seriesName, date)}\n\n${t.topicsCount(minute.topics?.length || 0)}\n${t.actionItemsCount(actionItemsCount)}\n\n${t.viewButton}: ${minuteUrl}`,
    html: generateEmailHTML(htmlContent),
  };

  try {
    const transport = await getTransporter();
    await transport.sendMail(mailOptions);
    console.log(`Minutes notification sent to ${recipients.length} recipients`);
  } catch (error) {
    console.error('Failed to send minutes notification:', error);
    throw error;
  }
}

// Send action item assignment notification
export async function sendActionItemAssignedNotification(
  minute: IMinutes & { meetingSeries?: IMeetingSeries },
  actionItem: any,
  locale: 'de' | 'en' = 'de'
): Promise<void> {
  const t = translations[locale].actionItemAssigned;

  if (!minute.meetingSeries || !actionItem.responsibles || actionItem.responsibles.length === 0) {
    return;
  }

  const seriesName = `${minute.meetingSeries.project} - ${minute.meetingSeries.name}`;
  const appUrl = await getAppUrl();
  const minuteUrl = `${appUrl}/minutes/${minute._id}`;
  const priorityClass = `priority-${actionItem.priority || 'medium'}`;

  const htmlContent = `
    <p><strong>${t.greeting},</strong></p>
    <p>${t.intro}</p>
    
    <div class="info-box ${priorityClass}">
      <p><strong>${t.actionItem}</strong> ${actionItem.subject}</p>
      ${actionItem.priority ? `<p><strong>${t.priority}</strong> ${actionItem.priority}</p>` : ''}
      ${actionItem.dueDate ? `<p><strong>${t.dueDate}</strong> ${new Date(actionItem.dueDate).toLocaleDateString(locale)}</p>` : ''}
    </div>

    <center>
      <a href="${minuteUrl}" class="button">${t.viewButton}</a>
    </center>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: actionItem.responsibles.join(', '),
    subject: t.subject(seriesName),
    text: `${t.intro}\n\n${t.actionItem} ${actionItem.subject}\n${t.priority} ${actionItem.priority || 'medium'}\n\n${t.viewButton}: ${minuteUrl}`,
    html: generateEmailHTML(htmlContent),
  };

  try {
    const transport = await getTransporter();
    await transport.sendMail(mailOptions);
    console.log(`Action item notification sent to ${actionItem.responsibles.length} recipients`);
  } catch (error) {
    console.error('Failed to send action item notification:', error);
    throw error;
  }
}

// Send overdue action items reminder
export async function sendOverdueReminder(
  userEmail: string,
  overdueItems: any[],
  locale: 'de' | 'en' = 'de'
): Promise<void> {
  const t = translations[locale].actionItemOverdue;

  if (overdueItems.length === 0) {
    return;
  }

  const appUrl = await getAppUrl();
  const dashboardUrl = `${appUrl}/dashboard`;

  const htmlContent = `
    <p><strong>${t.greeting},</strong></p>
    <p>${t.intro(overdueItems.length)}</p>
    
    ${overdueItems.map(item => `
      <div class="info-box priority-high">
        <p><strong>${item.subject}</strong></p>
        <p>Fällig: ${new Date(item.dueDate).toLocaleDateString(locale)}</p>
        ${item.meetingSeries ? `<p>Sitzung: ${item.meetingSeries.name}</p>` : ''}
      </div>
    `).join('')}

    <center>
      <a href="${dashboardUrl}" class="button">${t.viewButton}</a>
    </center>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: userEmail,
    subject: t.subject(overdueItems.length),
    text: `${t.intro(overdueItems.length)}\n\n${overdueItems.map(item => `- ${item.subject} (${new Date(item.dueDate).toLocaleDateString(locale)})`).join('\n')}\n\n${t.viewButton}: ${dashboardUrl}`,
    html: generateEmailHTML(htmlContent),
  };

  try {
    const transport = await getTransporter();
    await transport.sendMail(mailOptions);
    console.log(`Overdue reminder sent to ${userEmail}`);
  } catch (error) {
    console.error('Failed to send overdue reminder:', error);
    throw error;
  }
}

// Send welcome email to new user
export async function sendWelcomeEmail(
  user: { email: string; firstName: string; lastName: string },
  locale: 'de' | 'en' = 'de'
): Promise<void> {
  const t = translations[locale].welcome;
  const appUrl = await getAppUrl();
  const loginUrl = `${appUrl}/auth/login`;

  const htmlContent = `
    <p><strong>${t.greeting} ${user.firstName} ${user.lastName},</strong></p>
    <p>${t.intro}</p>
    
    <center>
      <a href="${loginUrl}" class="button">${t.loginButton}</a>
    </center>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: user.email,
    subject: t.subject,
    text: `${t.intro}\n\n${t.loginButton}: ${loginUrl}`,
    html: generateEmailHTML(htmlContent),
  };

  try {
    const transport = await getTransporter();
    await transport.sendMail(mailOptions);
    console.log(`Welcome email sent to ${user.email}`);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't throw error here to prevent registration failure
  }
}

// Send email verification
export async function sendVerificationEmail(
  user: { email: string; firstName: string; lastName: string },
  token: string,
  locale: 'de' | 'en' = 'de'
): Promise<void> {
  const t = translations[locale].verifyEmail;
  const appUrl = await getAppUrl();
  const verifyUrl = `${appUrl}/auth/verify-email?token=${token}`;

  const htmlContent = `
    <p><strong>${t.greeting} ${user.firstName} ${user.lastName},</strong></p>
    <p>${t.intro}</p>
    
    <center>
      <a href="${verifyUrl}" class="button">${t.verifyButton}</a>
    </center>
    
    <p style="text-align: center; color: #6b7280; font-size: 0.875rem; margin-top: 20px;">
      ${t.expiryNote}
    </p>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: user.email,
    subject: t.subject,
    text: `${t.intro}\n\n${t.verifyButton}: ${verifyUrl}\n\n${t.expiryNote}`,
    html: generateEmailHTML(htmlContent),
  };

  try {
    const transport = await getTransporter();
    await transport.sendMail(mailOptions);
    console.log(`Verification email sent to ${user.email}`);
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw error; // Throw error so registration can handle it
  }
}

// Test email configuration
export async function testEmailConfiguration(): Promise<boolean> {
  try {
    console.log('Testing email configuration...');
    const transport = await getTransporter();
    console.log('Transporter created, verifying connection...');
    await transport.verify();
    console.log('Email configuration is valid');
    return true;
  } catch (error: any) {
    console.error('Email configuration test failed:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error code:', error.code);
    console.error('Full error:', error);
    return false;
  }
}
