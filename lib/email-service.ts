import nodemailer from 'nodemailer';
import { IMinutes } from '@/models/Minutes';
import { IMeetingSeries } from '@/models/MeetingSeries';
import Settings from '@/models/Settings';
import User from '@/models/User';
import PendingNotification from '@/models/PendingNotification';
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

export async function getAppUrl() {
  try {
    const settings = await Settings.findOne({}).sort({ version: -1 });
    if (settings && settings.systemSettings && settings.systemSettings.baseUrl) {
      return settings.systemSettings.baseUrl;
    }
  } catch (_e) { }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export async function getOrgName() {
  try {
    const settings = await Settings.findOne({}).sort({ version: -1 });
    if (settings && settings.systemSettings && settings.systemSettings.organizationName) {
      return settings.systemSettings.organizationName;
    }
  } catch (_e) { }
  return '4Minitz 2.0';
}

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;

export async function getTransporter() {
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

export async function getFromEmail() {
  try {
    const settings = await Settings.findOne({}).sort({ version: -1 });
    if (settings && settings.smtpSettings && settings.smtpSettings.from) {
      return settings.smtpSettings.from;
    }
  } catch (_e) { }
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
      footer: 'Diese E-Mail wurde automatisch von 4Minitz 2.0 versendet.',
    },
    actionItemAssigned: {
      subject: (series: string) => `Neuer Aktionspunkt zugewiesen: ${series}`,
      greeting: 'Hallo',
      intro: 'Ihnen wurde ein neuer Aktionspunkt zugewiesen:',
      actionItem: 'Aktionspunkt:',
      priority: 'Priorität:',
      dueDate: 'Fällig:',
      viewButton: 'Aktionspunkt anzeigen',
      footer: 'Diese E-Mail wurde automatisch von 4Minitz 2.0 versendet.',
    },
    actionItemOverdue: {
      subject: (count: number) => `${count} überfällige Aktionspunkte`,
      greeting: 'Hallo',
      intro: (count: number) => `Sie haben ${count} überfällige Aktionspunkte:`,
      viewButton: 'Dashboard anzeigen',
      footer: 'Diese E-Mail wurde automatisch von 4Minitz 2.0 versendet.',
    },
    pendingTasksReminder: {
      subject: (count: number) => `Erinnerung: ${count} offene Aufgaben`,
      greeting: (name?: string) => name ? `Hallo ${name}` : 'Hallo',
      intro: (count: number) => `Sie haben ${count} offene Aufgaben, die noch erledigt werden müssen:`,
      viewButton: 'Dashboard anzeigen',
      footer: 'Diese E-Mail wurde automatisch von 4Minitz 2.0 versendet.',
    },
    welcome: {
      subject: 'Willkommen bei 4Minitz 2.0!',
      greeting: 'Hallo',
      intro: 'Willkommen bei 4Minitz 2.0! Ihr Konto wurde erfolgreich erstellt.',
      loginButton: 'Bei 4Minitz 2.0 anmelden',
      footer: 'Diese E-Mail wurde automatisch von 4Minitz 2.0 versendet.',
    },
    verifyEmail: {
      subject: 'Bestätigen Sie Ihre E-Mail-Adresse',
      greeting: 'Hallo',
      intro: 'Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren.',
      verifyButton: 'E-Mail bestätigen',
      expiryNote: 'Dieser Link ist 24 Stunden gültig.',
      footer: 'Diese E-Mail wurde automatisch von 4Minitz 2.0 versendet.',
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
      footer: 'This email was sent automatically by 4Minitz 2.0.',
    },
    actionItemAssigned: {
      subject: (series: string) => `New Action Item Assigned: ${series}`,
      greeting: 'Hello',
      intro: 'You have been assigned a new action item:',
      actionItem: 'Action Item:',
      priority: 'Priority:',
      dueDate: 'Due:',
      viewButton: 'View Action Item',
      footer: 'This email was sent automatically by 4Minitz 2.0.',
    },
    actionItemOverdue: {
      subject: (count: number) => `${count} Overdue Action Items`,
      greeting: 'Hello',
      intro: (count: number) => `You have ${count} overdue action items:`,
      viewButton: 'View Dashboard',
      footer: 'This email was sent automatically by 4Minitz 2.0.',
    },
    pendingTasksReminder: {
      subject: (count: number) => `Reminder: ${count} Open Tasks`,
      greeting: (name?: string) => name ? `Hello ${name}` : 'Hello',
      intro: (count: number) => `You have ${count} open tasks pending:`,
      viewButton: 'View Dashboard',
      footer: 'This email was sent automatically by 4Minitz 2.0.',
    },
    welcome: {
      subject: 'Welcome to 4Minitz 2.0!',
      greeting: 'Hello',
      intro: 'Welcome to 4Minitz 2.0! Your account has been successfully created.',
      loginButton: 'Login to 4Minitz 2.0',
      footer: 'This email was sent automatically by 4Minitz 2.0.',
    },
    verifyEmail: {
      subject: 'Verify Your Email Address',
      greeting: 'Hello',
      intro: 'Please verify your email address to activate your account.',
      verifyButton: 'Verify Email',
      expiryNote: 'This link is valid for 24 hours.',
      footer: 'This email was sent automatically by 4Minitz 2.0.',
    },
  },
};

// Helper function to generate email HTML
export async function generateEmailHTML(content: string): Promise<string> {
  const orgName = await getOrgName();
  return `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>${orgName}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f3f4f6;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, #8b5cf6 0%, #db2777 100%); padding: 30px 0; color: #ffffff;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: bold; text-shadow: 0 1px 2px rgba(0,0,0,0.1); font-family: 'Segoe UI', sans-serif;">${orgName}</h1>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 40px 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                    ${content}
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td align="center" style="background-color: #f9fafb; padding: 20px; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb;">
                    &copy; ${new Date().getFullYear()} ${orgName}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
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

  const allRecipients = [
    ...(minute.meetingSeries.visibleFor || []),
    ...(minute.participants || []),
  ].filter((email, index, self) => self.indexOf(email) === index); // Remove duplicates

  if (allRecipients.length === 0) {
    console.log('No recipients for minutes notification');
    return;
  }

  // Check for digest settings
  const users = await User.find({ email: { $in: allRecipients } });
  const userMap = new Map(users.map(u => [u.email, u]));
  
  const directRecipients: string[] = [];
  const digestPromises: Promise<any>[] = [];

  for (const email of allRecipients) {
    const user = userMap.get(email);
    // Check if user has digest enabled (and is not null)
    const digestEnabled = user?.notificationSettings?.enableDigestEmails;

    if (digestEnabled && user) {
       digestPromises.push(PendingNotification.create({
         userId: user._id,
         type: 'newMinute',
         data: {
           minuteId: minute._id,
           seriesName: minute.meetingSeries.name,
           project: minute.meetingSeries.project,
           date: minute.date,
           topicCount: minute.topics?.length || 0
         }
       }));
    } else {
       directRecipients.push(email);
    }
  }

  if (digestPromises.length > 0) {
    await Promise.all(digestPromises);
    console.log(`Queued ${digestPromises.length} digest notifications`);
  }

  if (directRecipients.length === 0) {
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
    
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; border-radius: 4px;">
      <tr>
        <td style="padding: 16px;">
          <p style="margin: 0 0 8px 0;"><strong>${t.topicsCount(minute.topics?.length || 0)}</strong></p>
          <p style="margin: 0;"><strong>${t.actionItemsCount(actionItemsCount)}</strong></p>
        </td>
      </tr>
    </table>

    ${minute.participants && minute.participants.length > 0 ? `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #3b82f6; border-radius: 4px;">
        <tr>
          <td style="padding: 16px;">
            <p style="margin: 0 0 8px 0;"><strong>${t.participantsList}</strong></p>
            <ul style="padding-left: 20px; margin: 0;">
              ${minute.participants.map((p: string) => `<li style="margin-bottom: 4px;">${p}</li>`).join('')}
            </ul>
          </td>
        </tr>
      </table>
    ` : ''}

    <center>
      <a href="${minuteUrl}" style="display: inline-block; background: linear-gradient(to right, #9333ea, #db2777); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 24px; text-align: center; box-shadow: 0 4px 6px -1px rgba(147, 51, 234, 0.3); font-family: sans-serif;">${t.viewButton}</a>
    </center>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: directRecipients.join(', '),
    subject: t.subject(seriesName),
    text: `${t.intro(seriesName, date)}\n\n${t.topicsCount(minute.topics?.length || 0)}\n${t.actionItemsCount(actionItemsCount)}\n\n${t.viewButton}: ${minuteUrl}`,
    html: await generateEmailHTML(htmlContent),
  };

  try {
    const transport = await getTransporter();
    await transport.sendMail(mailOptions);
    console.log(`Minutes notification sent to ${directRecipients.length} recipients`);
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

  // Check for digest settings
  const users = await User.find({ email: { $in: actionItem.responsibles } });
  const userMap = new Map(users.map(u => [u.email, u]));
  
  const directRecipients: string[] = [];
  const digestPromises: Promise<any>[] = [];

  for (const email of actionItem.responsibles) {
    const user = userMap.get(email);
    const digestEnabled = user?.notificationSettings?.enableDigestEmails;

    if (digestEnabled && user) {
       digestPromises.push(PendingNotification.create({
         userId: user._id,
         type: 'actionItemAssigned',
         data: {
           minuteId: minute._id,
           seriesName: minute.meetingSeries.name,
           project: minute.meetingSeries.project,
           subject: actionItem.subject,
           priority: actionItem.priority,
           dueDate: actionItem.dueDate
         }
       }));
    } else {
       directRecipients.push(email);
    }
  }

  if (digestPromises.length > 0) {
    await Promise.all(digestPromises);
  }

  if (directRecipients.length === 0) {
    return;
  }

  const seriesName = `${minute.meetingSeries.project} - ${minute.meetingSeries.name}`;
  const appUrl = await getAppUrl();
  const minuteUrl = `${appUrl}/minutes/${minute._id}`;
  const priorityColors = {
    high: '#ef4444',
    medium: '#f59e0b',
    low: '#10b981'
  };
  const priorityBg = {
    high: '#fef2f2',
    medium: '#fffbeb',
    low: '#f0fdf4'
  };
  const pColor = priorityColors[actionItem.priority as keyof typeof priorityColors] || priorityColors.medium;
  const pBg = priorityBg[actionItem.priority as keyof typeof priorityBg] || priorityBg.medium;

  const htmlContent = `
    <p><strong>${t.greeting},</strong></p>
    <p>${t.intro}</p>
    
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px; background-color: ${pBg}; border: 1px solid #e2e8f0; border-left: 4px solid ${pColor}; border-radius: 4px;">
      <tr>
        <td style="padding: 16px;">
          <p style="margin: 0 0 8px 0;"><strong>${t.actionItem}</strong> ${actionItem.subject}</p>
          ${actionItem.priority ? `<p style="margin: 0 0 8px 0;"><strong>${t.priority}</strong> ${actionItem.priority}</p>` : ''}
          ${actionItem.dueDate ? `<p style="margin: 0;"><strong>${t.dueDate}</strong> ${new Date(actionItem.dueDate).toLocaleDateString(locale)}</p>` : ''}
        </td>
      </tr>
    </table>

    <center>
      <a href="${minuteUrl}" style="display: inline-block; background: linear-gradient(to right, #9333ea, #db2777); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 24px; text-align: center; box-shadow: 0 4px 6px -1px rgba(147, 51, 234, 0.3); font-family: sans-serif;">${t.viewButton}</a>
    </center>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: directRecipients.join(', '),
    subject: t.subject(seriesName),
    text: `${t.intro}\n\n${t.actionItem} ${actionItem.subject}\n${t.priority} ${actionItem.priority || 'medium'}\n\n${t.viewButton}: ${minuteUrl}`,
    html: await generateEmailHTML(htmlContent),
  };

  try {
    const transport = await getTransporter();
    await transport.sendMail(mailOptions);
    console.log(`Action item notification sent to ${directRecipients.length} recipients`);
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
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px; background-color: #fef2f2; border: 1px solid #e2e8f0; border-left: 4px solid #ef4444; border-radius: 4px;">
        <tr>
          <td style="padding: 16px;">
            <p style="margin: 0 0 8px 0;"><strong>${item.subject}</strong></p>
            <p style="margin: 0 0 8px 0;">Fällig: ${new Date(item.dueDate).toLocaleDateString(locale)}</p>
            ${item.meetingSeries ? `<p style="margin: 0;">Sitzung: ${item.meetingSeries.name}</p>` : ''}
          </td>
        </tr>
      </table>
    `).join('')}

    <center>
      <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(to right, #9333ea, #db2777); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 24px; text-align: center; box-shadow: 0 4px 6px -1px rgba(147, 51, 234, 0.3); font-family: sans-serif;">${t.viewButton}</a>
    </center>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: userEmail,
    subject: t.subject(overdueItems.length),
    text: `${t.intro(overdueItems.length)}\n\n${overdueItems.map(item => `- ${item.subject} (${new Date(item.dueDate).toLocaleDateString(locale)})`).join('\n')}\n\n${t.viewButton}: ${dashboardUrl}`,
    html: await generateEmailHTML(htmlContent),
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
      <a href="${loginUrl}" style="display: inline-block; background: linear-gradient(to right, #9333ea, #db2777); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 24px; text-align: center; box-shadow: 0 4px 6px -1px rgba(147, 51, 234, 0.3); font-family: sans-serif;">${t.loginButton}</a>
    </center>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: user.email,
    subject: t.subject,
    text: `${t.intro}\n\n${t.loginButton}: ${loginUrl}`,
    html: await generateEmailHTML(htmlContent),
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
      <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(to right, #9333ea, #db2777); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 24px; text-align: center; box-shadow: 0 4px 6px -1px rgba(147, 51, 234, 0.3); font-family: sans-serif;">${t.verifyButton}</a>
    </center>
    
    <p style="text-align: center; color: #6b7280; font-size: 14px; margin-top: 20px;">
      ${t.expiryNote}
    </p>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: user.email,
    subject: t.subject,
    text: `${t.intro}\n\n${t.verifyButton}: ${verifyUrl}\n\n${t.expiryNote}`,
    html: await generateEmailHTML(htmlContent),
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

// Send pending tasks reminder (manual trigger)
export async function sendPendingTasksReminder(
  user: { email: string; firstName?: string; lastName?: string },
  tasks: any[],
  locale: 'de' | 'en' = 'de'
): Promise<void> {
  const t = translations[locale].pendingTasksReminder;

  if (tasks.length === 0) {
    return;
  }

  const appUrl = await getAppUrl();
  const dashboardUrl = `${appUrl}/dashboard`;
  const name = user.firstName || '';

  const htmlContent = `
    <p><strong>${t.greeting(name)},</strong></p>
    <p>${t.intro(tasks.length)}</p>
    
    ${tasks.map(item => {
      const pColor = item.priority === 'high' ? '#ef4444' : item.priority === 'low' ? '#10b981' : '#f59e0b';
      const pBg = item.priority === 'high' ? '#fef2f2' : item.priority === 'low' ? '#f0fdf4' : '#fffbeb';
      return `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px; background-color: ${pBg}; border: 1px solid #e2e8f0; border-left: 4px solid ${pColor}; border-radius: 4px;">
        <tr>
          <td style="padding: 16px;">
            <p style="margin: 0 0 8px 0; font-weight: bold; font-size: 16px;">${item.subject}</p>
            ${item.dueDate ? `<p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563;">Fällig: ${new Date(item.dueDate).toLocaleDateString(locale)}</p>` : ''}
            ${item.meetingSeries ? `<p style="margin: 0; font-size: 14px; color: #4b5563;">Sitzung: ${item.meetingSeries.name}</p>` : ''}
          </td>
        </tr>
      </table>
      `;
    }).join('')}

    <center>
      <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(to right, #9333ea, #db2777); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 24px; text-align: center; box-shadow: 0 4px 6px -1px rgba(147, 51, 234, 0.3); font-family: sans-serif;">${t.viewButton}</a>
    </center>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: user.email,
    subject: t.subject(tasks.length),
    text: `${t.intro(tasks.length)}\n\n${tasks.map(item => `- ${item.subject} (${item.dueDate ? new Date(item.dueDate).toLocaleDateString(locale) : 'No Date'})`).join('\n')}\n\n${t.viewButton}: ${dashboardUrl}`,
    html: await generateEmailHTML(htmlContent),
  };

  try {
    const transport = await getTransporter();
    await transport.sendMail(mailOptions);
    console.log(`Pending tasks reminder sent to ${user.email}`);
  } catch (error) {
    console.error('Failed to send pending tasks reminder:', error);
    throw error;
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
