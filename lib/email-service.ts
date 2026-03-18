import nodemailer from 'nodemailer';
import { IMinutes, ITopic, IInfoItem } from '@/models/Minutes';
import { IMeetingSeries } from '@/models/MeetingSeries';
import Settings from '@/models/Settings';
import PendingNotification from '@/models/PendingNotification';
import { decrypt } from '@/lib/crypto';
import { sendPushToUserIds } from '@/lib/push-service';
import { sanitizeBrandColors, hexToRgba } from '@/lib/brand-colors';
import {
  isEmailIdentifier,
  lookupUsersByIdentifiers,
  normalizeIdentifier,
} from '@/lib/user-identifiers';

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

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@nxtminutes.local';
// APP_URL is now dynamic via getAppUrl()

function normalizeUrlCandidate(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function isLocalhostLike(value: string): boolean {
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  } catch {
    return false;
  }
}

function getFirstValidUrl(candidates: string[]): string | null {
  for (const raw of candidates) {
    const candidate = normalizeUrlCandidate(raw);
    if (!candidate) continue;
    if (!isHttpUrl(candidate)) continue;
    return candidate;
  }
  return null;
}

function getFirstPublicUrl(candidates: string[]): string | null {
  for (const raw of candidates) {
    const candidate = normalizeUrlCandidate(raw);
    if (!candidate) continue;
    if (!isHttpUrl(candidate)) continue;
    if (isLocalhostLike(candidate)) continue;
    return candidate;
  }
  return null;
}

async function getConfiguredAppUrl(): Promise<string> {
  try {
    const settings = await Settings.findOne({
      'systemSettings.baseUrl': { $exists: true, $nin: ['', null] },
    }).sort({ updatedAt: -1 }).lean();
    return String((settings as any)?.systemSettings?.baseUrl || '');
  } catch {
    return '';
  }
}

export async function resolvePublicAppUrl(...fallbackCandidates: string[]): Promise<string> {
  const configuredBaseUrl = await getConfiguredAppUrl();
  const envAppUrl = String(process.env.APP_URL || '');
  const envPublicAppUrl = String(process.env.NEXT_PUBLIC_APP_URL || '');
  const candidates = [configuredBaseUrl, envAppUrl, envPublicAppUrl, ...fallbackCandidates];

  const preferred = getFirstPublicUrl(candidates);
  if (preferred) return preferred;

  const fallback = getFirstValidUrl(candidates);
  return fallback || 'http://localhost:3000';
}

export async function getAppUrl() {
  return resolvePublicAppUrl();
}

export async function getOrgName() {
  try {
    const settings = await Settings.findOne({
      'systemSettings.organizationName': { $exists: true, $nin: ['', null] },
    }).sort({ updatedAt: -1 }).lean();
    if (settings && settings.systemSettings && settings.systemSettings.organizationName) {
      return settings.systemSettings.organizationName;
    }
  } catch (_e) { }
  return 'NXTMinutes';
}

export async function getTransporter() {
  // Try to get settings from DB first
  try {
    const notificationSettingsDoc = await Settings.findOne({
      notificationSettings: { $exists: true },
    }).sort({ updatedAt: -1 }).lean();

    // Check if email notifications are enabled globally
    if ((notificationSettingsDoc as any)?.notificationSettings?.enableEmailNotifications === false) {
      return {
        sendMail: async () => {
          return { messageId: 'skipped-disabled' } as nodemailer.SentMessageInfo;
        },
        verify: async () => true
      } as any;
    }

    const smtpSettingsDoc = await Settings.findOne({
      'smtpSettings.host': { $exists: true, $nin: ['', null] },
    }).sort({ updatedAt: -1 }).lean();

    if ((smtpSettingsDoc as any)?.smtpSettings?.host) {
      const { host, port: rawPort, secure, auth } = (smtpSettingsDoc as any).smtpSettings;
      const port = rawPort || 587;

      // Decrypt password if present
      let decryptedPass = '';
      try {
        decryptedPass = auth?.pass ? decrypt(auth.pass) : '';
      } catch {
        // Decryption failed — password may be stored unencrypted or corrupted
        decryptedPass = auth?.pass || '';
      }

      // Port 465 = direct TLS (secure: true)
      // Port 587/25 = STARTTLS (secure: false, TLS upgraded automatically)
      const useSecure = port === 465 ? true : (secure && port !== 587 && port !== 25);

      return nodemailer.createTransport({
        host,
        port,
        secure: useSecure,
        auth: auth?.user && decryptedPass ? { user: auth.user, pass: decryptedPass } : undefined,
      });
    }
  } catch {
    // Fall back to env vars if DB settings unavailable
  }

  // Fallback to env vars
  return nodemailer.createTransport(EMAIL_CONFIG);
}

export async function getFromEmail() {
  try {
    const settings = await Settings.findOne({
      'smtpSettings.from': { $exists: true, $nin: ['', null] },
    }).sort({ updatedAt: -1 }).lean();
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
      footer: 'Diese E-Mail wurde automatisch von NXTMinutes versendet.',
    },
    actionItemAssigned: {
      subject: (series: string) => `Neuer Aktionspunkt zugewiesen: ${series}`,
      greeting: 'Hallo',
      intro: 'Ihnen wurde ein neuer Aktionspunkt zugewiesen:',
      actionItem: 'Aktionspunkt:',
      priority: 'Priorität:',
      dueDate: 'Fällig:',
      viewButton: 'Aktionspunkt anzeigen',
      footer: 'Diese E-Mail wurde automatisch von NXTMinutes versendet.',
    },
    actionItemOverdue: {
      subject: (count: number) => `${count} überfällige Aktionspunkte`,
      greeting: 'Hallo',
      intro: (count: number) => `Sie haben ${count} überfällige Aktionspunkte:`,
      viewButton: 'Dashboard anzeigen',
      footer: 'Diese E-Mail wurde automatisch von NXTMinutes versendet.',
    },
    pendingTasksReminder: {
      subject: (count: number) => `Erinnerung: ${count} offene Aufgaben`,
      greeting: (name?: string) => name ? `Hallo ${name}` : 'Hallo',
      intro: (count: number) => `Sie haben ${count} offene Aufgaben, die noch erledigt werden müssen:`,
      viewButton: 'Dashboard anzeigen',
      footer: 'Diese E-Mail wurde automatisch von NXTMinutes versendet.',
    },
    welcome: {
      subject: 'Willkommen bei NXTMinutes!',
      greeting: 'Hallo',
      intro: 'Willkommen bei NXTMinutes! Ihr Konto wurde erfolgreich erstellt.',
      loginButton: 'Bei NXTMinutes anmelden',
      footer: 'Diese E-Mail wurde automatisch von NXTMinutes versendet.',
    },
    verifyEmail: {
      subject: 'Bestätigen Sie Ihre E-Mail-Adresse',
      greeting: 'Hallo',
      intro: 'Bitte bestätigen Sie Ihre E-Mail-Adresse, um Ihr Konto zu aktivieren.',
      verifyButton: 'E-Mail bestätigen',
      expiryNote: 'Dieser Link ist 24 Stunden gültig.',
      footer: 'Diese E-Mail wurde automatisch von NXTMinutes versendet.',
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
      footer: 'This email was sent automatically by NXTMinutes.',
    },
    actionItemAssigned: {
      subject: (series: string) => `New Action Item Assigned: ${series}`,
      greeting: 'Hello',
      intro: 'You have been assigned a new action item:',
      actionItem: 'Action Item:',
      priority: 'Priority:',
      dueDate: 'Due:',
      viewButton: 'View Action Item',
      footer: 'This email was sent automatically by NXTMinutes.',
    },
    actionItemOverdue: {
      subject: (count: number) => `${count} Overdue Action Items`,
      greeting: 'Hello',
      intro: (count: number) => `You have ${count} overdue action items:`,
      viewButton: 'View Dashboard',
      footer: 'This email was sent automatically by NXTMinutes.',
    },
    pendingTasksReminder: {
      subject: (count: number) => `Reminder: ${count} Open Tasks`,
      greeting: (name?: string) => name ? `Hello ${name}` : 'Hello',
      intro: (count: number) => `You have ${count} open tasks pending:`,
      viewButton: 'View Dashboard',
      footer: 'This email was sent automatically by NXTMinutes.',
    },
    welcome: {
      subject: 'Welcome to NXTMinutes!',
      greeting: 'Hello',
      intro: 'Welcome to NXTMinutes! Your account has been successfully created.',
      loginButton: 'Login to NXTMinutes',
      footer: 'This email was sent automatically by NXTMinutes.',
    },
    verifyEmail: {
      subject: 'Verify Your Email Address',
      greeting: 'Hello',
      intro: 'Please verify your email address to activate your account.',
      verifyButton: 'Verify Email',
      expiryNote: 'This link is valid for 24 hours.',
      footer: 'This email was sent automatically by NXTMinutes.',
    },
  },
};

type EmailBrandTheme = {
  primary: string;
  primaryDark: string;
  pageBackground: string;
  cardBackground: string;
  cardBorder: string;
  footerBackground: string;
  textColor: string;
  mutedTextColor: string;
  infoBackground: string;
};

async function getEmailBrandTheme(): Promise<EmailBrandTheme> {
  try {
    const settings = await Settings.findOne({
      'systemSettings.brandColors': { $exists: true },
    }).sort({ updatedAt: -1 }).lean();
    const settingsObj = settings as any;
    const colors = sanitizeBrandColors(settingsObj?.systemSettings?.brandColors);
    return {
      primary: colors.primary,
      primaryDark: colors.primaryDark,
      pageBackground: colors.pageTo,
      cardBackground: colors.card,
      cardBorder: colors.cardBorder,
      footerBackground: colors.pageFrom,
      textColor: colors.text,
      mutedTextColor: colors.textMuted,
      infoBackground: hexToRgba(colors.surface, 0.88),
    };
  } catch {
    return {
      primary: '#6366F1',
      primaryDark: '#4F46E5',
      pageBackground: '#F1F5F9',
      cardBackground: '#FFFFFF',
      cardBorder: '#E2E8F0',
      footerBackground: '#F8FAFC',
      textColor: '#0F172A',
      mutedTextColor: '#64748B',
      infoBackground: '#F8FAFC',
    };
  }
}

function getEmailPrimaryButtonStyle(theme: EmailBrandTheme): string {
  return `display: inline-block; background: linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%); color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 12px; font-weight: 600; margin-top: 24px; text-align: center; box-shadow: 0 10px 20px -8px ${hexToRgba(theme.primary, 0.45)}; font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif;`;
}

// Helper function to generate email HTML
export async function generateEmailHTML(content: string, theme?: EmailBrandTheme): Promise<string> {
  const orgName = await getOrgName();
  const emailTheme = theme || await getEmailBrandTheme();
  return `
    <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
    <html xmlns="http://www.w3.org/1999/xhtml">
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>${orgName}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: ${emailTheme.pageBackground}; font-family: Inter, 'Segoe UI', Roboto, Arial, sans-serif; color: ${emailTheme.textColor};">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: ${emailTheme.pageBackground};">
          <tr>
            <td align="center" style="padding: 32px 12px;">
              <table border="0" cellpadding="0" cellspacing="0" width="620" style="background-color: ${emailTheme.cardBackground}; border-radius: 16px; overflow: hidden; border: 1px solid ${emailTheme.cardBorder}; box-shadow: 0 20px 40px -24px rgba(15, 23, 42, 0.35);">
                <!-- Header -->
                <tr>
                  <td align="center" style="background: linear-gradient(135deg, ${emailTheme.primary} 0%, ${emailTheme.primaryDark} 100%); padding: 28px 24px; color: #ffffff;">
                    <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.01em; font-family: Inter, 'Segoe UI', Roboto, Arial, sans-serif;">${orgName}</h1>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 32px 28px; color: ${emailTheme.textColor}; font-size: 15px; line-height: 1.65;">
                    ${content}
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td align="center" style="background-color: ${emailTheme.footerBackground}; padding: 18px; color: ${emailTheme.mutedTextColor}; font-size: 12px; border-top: 1px solid ${emailTheme.cardBorder};">
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

  const recipientIdentifiers = [
    ...(minute.meetingSeries.visibleFor || []),
    ...(minute.participants || []),
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index);

  if (recipientIdentifiers.length === 0) {
    return;
  }

  const userMap = await lookupUsersByIdentifiers(recipientIdentifiers);
  
  const directRecipients: string[] = [];
  const digestPromises: Promise<any>[] = [];
  const pushUserIds = new Set<string>();
  const handledEmails = new Set<string>();

  for (const identifier of recipientIdentifiers) {
    const user = userMap.get(normalizeIdentifier(identifier)) as any;
    if (user?._id && user?.preferences?.notifications?.inApp !== false) {
      pushUserIds.add(String(user._id));
    }

    const targetEmail = (user?.email || (isEmailIdentifier(identifier) ? identifier : '')).trim().toLowerCase();
    if (!targetEmail || handledEmails.has(targetEmail)) continue;
    handledEmails.add(targetEmail);

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
    } else if (targetEmail) {
       directRecipients.push(targetEmail);
    }
  }

  if (digestPromises.length > 0) {
    await Promise.all(digestPromises);

  }

  const seriesName = minute.meetingSeries.name ? `${minute.meetingSeries.project} – ${minute.meetingSeries.name}` : minute.meetingSeries.project;
  const date = new Date(minute.date).toLocaleDateString(locale);
  const appUrl = await getAppUrl();
  const emailTheme = await getEmailBrandTheme();
  const primaryButtonStyle = getEmailPrimaryButtonStyle(emailTheme);
  const minuteUrl = `${appUrl}/minutes/${minute._id}`;
  const minutePath = `/minutes/${minute._id}`;

  const actionItemsCount = minute.topics?.reduce((count: number, topic: ITopic) => {
    return count + (topic.infoItems?.filter((item: IInfoItem) => item.itemType === 'actionItem' && item.status !== 'completed' && item.status !== 'cancelled').length || 0);
  }, 0) || 0;

  if (pushUserIds.size > 0) {
    await sendPushToUserIds(Array.from(pushUserIds), {
      title: locale === 'de' ? 'Neues Protokoll' : 'New Minutes',
      body: locale === 'de'
        ? `${seriesName} (${date})`
        : `${seriesName} (${date})`,
      url: minutePath,
      tag: `minute-${minute._id}`,
      lang: locale,
    });
  }

  if (directRecipients.length === 0) {
    return;
  }

  const htmlContent = `
    <p><strong>${t.greeting},</strong></p>
    <p>${t.intro(seriesName, date)}</p>
    
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px; background-color: ${emailTheme.infoBackground}; border: 1px solid ${emailTheme.cardBorder}; border-left: 4px solid ${emailTheme.primary}; border-radius: 4px;">
      <tr>
        <td style="padding: 16px;">
          <p style="margin: 0 0 8px 0;"><strong>${t.topicsCount(minute.topics?.length || 0)}</strong></p>
          <p style="margin: 0;"><strong>${t.actionItemsCount(actionItemsCount)}</strong></p>
        </td>
      </tr>
    </table>

    ${minute.participants && minute.participants.length > 0 ? `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px; background-color: ${emailTheme.infoBackground}; border: 1px solid ${emailTheme.cardBorder}; border-left: 4px solid ${emailTheme.primary}; border-radius: 4px;">
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
      <a href="${minuteUrl}" style="${primaryButtonStyle}">${t.viewButton}</a>
    </center>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: directRecipients.join(', '),
    subject: t.subject(seriesName),
    text: `${t.intro(seriesName, date)}\n\n${t.topicsCount(minute.topics?.length || 0)}\n${t.actionItemsCount(actionItemsCount)}\n\n${t.viewButton}: ${minuteUrl}`,
    html: await generateEmailHTML(htmlContent, emailTheme),
  };

  try {
    const transport = await getTransporter();
    await transport.sendMail(mailOptions);
  } catch (error) {
    console.error('Failed to send minutes notification:', error);
    throw error;
  }
}

// Send action item assignment notification
export async function sendActionItemAssignedNotification(
  minute: IMinutes & { meetingSeries?: IMeetingSeries },
  actionItem: IInfoItem,
  locale: 'de' | 'en' = 'de'
): Promise<void> {
  const t = translations[locale].actionItemAssigned;

  if (!minute.meetingSeries || !actionItem.responsibles || actionItem.responsibles.length === 0) {
    return;
  }

  const responsibleIdentifiers = (actionItem.responsibles || [])
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .filter((value, index, self) => self.indexOf(value) === index);

  const userMap = await lookupUsersByIdentifiers(responsibleIdentifiers);
  
  const directRecipients: string[] = [];
  const digestPromises: Promise<any>[] = [];
  const pushUserIds = new Set<string>();
  const handledEmails = new Set<string>();

  for (const identifier of responsibleIdentifiers) {
    const user = userMap.get(normalizeIdentifier(identifier)) as any;
    if (user?._id && user?.preferences?.notifications?.inApp !== false) {
      pushUserIds.add(String(user._id));
    }

    const targetEmail = (user?.email || (isEmailIdentifier(identifier) ? identifier : '')).trim().toLowerCase();
    if (!targetEmail || handledEmails.has(targetEmail)) continue;
    handledEmails.add(targetEmail);

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
    } else if (targetEmail) {
       directRecipients.push(targetEmail);
    }
  }

  if (digestPromises.length > 0) {
    await Promise.all(digestPromises);
  }

  const seriesName = minute.meetingSeries.name ? `${minute.meetingSeries.project} – ${minute.meetingSeries.name}` : minute.meetingSeries.project;
  const appUrl = await getAppUrl();
  const emailTheme = await getEmailBrandTheme();
  const primaryButtonStyle = getEmailPrimaryButtonStyle(emailTheme);
  const minuteUrl = `${appUrl}/minutes/${minute._id}`;
  const minutePath = `/minutes/${minute._id}`;
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

  if (pushUserIds.size > 0) {
    await sendPushToUserIds(Array.from(pushUserIds), {
      title: locale === 'de' ? 'Neuer Aktionspunkt' : 'New Action Item',
      body: actionItem.subject || seriesName,
      url: minutePath,
      tag: `action-item-${minute._id}`,
      lang: locale,
    });
  }

  if (directRecipients.length === 0) {
    return;
  }

  const htmlContent = `
    <p><strong>${t.greeting},</strong></p>
    <p>${t.intro}</p>
    
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px; background-color: ${pBg}; border: 1px solid ${emailTheme.cardBorder}; border-left: 4px solid ${pColor}; border-radius: 4px;">
      <tr>
        <td style="padding: 16px;">
          <p style="margin: 0 0 8px 0;"><strong>${t.actionItem}</strong> ${actionItem.subject}</p>
          ${actionItem.priority ? `<p style="margin: 0 0 8px 0;"><strong>${t.priority}</strong> ${actionItem.priority}</p>` : ''}
          ${actionItem.dueDate ? `<p style="margin: 0;"><strong>${t.dueDate}</strong> ${new Date(actionItem.dueDate).toLocaleDateString(locale)}</p>` : ''}
        </td>
      </tr>
    </table>

    <center>
      <a href="${minuteUrl}" style="${primaryButtonStyle}">${t.viewButton}</a>
    </center>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: directRecipients.join(', '),
    subject: t.subject(seriesName),
    text: `${t.intro}\n\n${t.actionItem} ${actionItem.subject}\n${t.priority} ${actionItem.priority || 'medium'}\n\n${t.viewButton}: ${minuteUrl}`,
    html: await generateEmailHTML(htmlContent, emailTheme),
  };

  try {
    const transport = await getTransporter();
    await transport.sendMail(mailOptions);
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
  const emailTheme = await getEmailBrandTheme();
  const primaryButtonStyle = getEmailPrimaryButtonStyle(emailTheme);
  const dashboardUrl = `${appUrl}/dashboard`;

  const htmlContent = `
    <p><strong>${t.greeting},</strong></p>
    <p>${t.intro(overdueItems.length)}</p>
    
    ${overdueItems.map(item => `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px; background-color: #fef2f2; border: 1px solid ${emailTheme.cardBorder}; border-left: 4px solid #ef4444; border-radius: 4px;">
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
      <a href="${dashboardUrl}" style="${primaryButtonStyle}">${t.viewButton}</a>
    </center>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: userEmail,
    subject: t.subject(overdueItems.length),
    text: `${t.intro(overdueItems.length)}\n\n${overdueItems.map(item => `- ${item.subject} (${new Date(item.dueDate).toLocaleDateString(locale)})`).join('\n')}\n\n${t.viewButton}: ${dashboardUrl}`,
    html: await generateEmailHTML(htmlContent, emailTheme),
  };

  try {
    const transport = await getTransporter();
    await transport.sendMail(mailOptions);
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
  const emailTheme = await getEmailBrandTheme();
  const primaryButtonStyle = getEmailPrimaryButtonStyle(emailTheme);
  const loginUrl = `${appUrl}/auth/login`;

  const htmlContent = `
    <p><strong>${t.greeting} ${user.firstName} ${user.lastName},</strong></p>
    <p>${t.intro}</p>
    
    <center>
      <a href="${loginUrl}" style="${primaryButtonStyle}">${t.loginButton}</a>
    </center>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: user.email,
    subject: t.subject,
    text: `${t.intro}\n\n${t.loginButton}: ${loginUrl}`,
    html: await generateEmailHTML(htmlContent, emailTheme),
  };

  try {
    const transport = await getTransporter();
    await transport.sendMail(mailOptions);
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't throw error here to prevent registration failure
  }
}

// Send email verification
export async function sendVerificationEmail(
  user: { email: string; firstName: string; lastName: string },
  token: string,
  locale: 'de' | 'en' = 'de',
  appUrlOverride?: string
): Promise<void> {
  const t = translations[locale].verifyEmail;
  const appUrl = (await resolvePublicAppUrl(String(appUrlOverride || ''))).replace(/\/+$/, '');
  const emailTheme = await getEmailBrandTheme();
  const primaryButtonStyle = getEmailPrimaryButtonStyle(emailTheme);
  const verifyUrl = `${appUrl}/auth/verify-email?token=${token}`;

  const htmlContent = `
    <p><strong>${t.greeting} ${user.firstName} ${user.lastName},</strong></p>
    <p>${t.intro}</p>
    
    <center>
      <a href="${verifyUrl}" style="${primaryButtonStyle}">${t.verifyButton}</a>
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
    html: await generateEmailHTML(htmlContent, emailTheme),
  };

  try {
    const transport = await getTransporter();
    await transport.sendMail(mailOptions);
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
  const emailTheme = await getEmailBrandTheme();
  const primaryButtonStyle = getEmailPrimaryButtonStyle(emailTheme);
  const dashboardUrl = `${appUrl}/dashboard`;
  const name = user.firstName || '';

  const htmlContent = `
    <p><strong>${t.greeting(name)},</strong></p>
    <p>${t.intro(tasks.length)}</p>
    
    ${tasks.map(item => {
      const pColor = item.priority === 'high' ? '#ef4444' : item.priority === 'low' ? '#10b981' : '#f59e0b';
      const pBg = item.priority === 'high' ? '#fef2f2' : item.priority === 'low' ? '#f0fdf4' : '#fffbeb';
      return `
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px; background-color: ${pBg}; border: 1px solid ${emailTheme.cardBorder}; border-left: 4px solid ${pColor}; border-radius: 4px;">
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
      <a href="${dashboardUrl}" style="${primaryButtonStyle}">${t.viewButton}</a>
    </center>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: user.email,
    subject: t.subject(tasks.length),
    text: `${t.intro(tasks.length)}\n\n${tasks.map(item => `- ${item.subject} (${item.dueDate ? new Date(item.dueDate).toLocaleDateString(locale) : 'No Date'})`).join('\n')}\n\n${t.viewButton}: ${dashboardUrl}`,
    html: await generateEmailHTML(htmlContent, emailTheme),
  };

  try {
    const transport = await getTransporter();
    await transport.sendMail(mailOptions);
  } catch (error) {
    console.error('Failed to send pending tasks reminder:', error);
    throw error;
  }
}

// Test email configuration
export async function testEmailConfiguration(): Promise<{ success: boolean; error?: string }> {
  try {
    const transport = await getTransporter();
    await transport.verify();
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// Password reset email
type Locale = 'de' | 'en';

const resetTranslations: Record<Locale, {
  subject: string;
  greeting: (name?: string) => string;
  intro: string;
  resetButton: string;
  expiryNote: string;
}> = {
  de: {
    subject: 'Passwort zurücksetzen',
    greeting: (name?: string) => (name ? `Hallo ${name}` : 'Hallo'),
    intro:
      'Sie haben eine Anfrage zum Zurücksetzen Ihres Passworts gestellt. Klicken Sie auf den Button, um ein neues Passwort zu setzen.',
    resetButton: 'Passwort zurücksetzen',
    expiryNote:
      'Dieser Link ist 1 Stunde gültig. Wenn Sie diese Anfrage nicht gestellt haben, können Sie diese E-Mail ignorieren.',
  },
  en: {
    subject: 'Reset your password',
    greeting: (name?: string) => (name ? `Hello ${name}` : 'Hello'),
    intro:
      'You requested a password reset. Click the button below to set a new password.',
    resetButton: 'Reset password',
    expiryNote:
      'This link is valid for 1 hour. If you did not request this, you can ignore this email.',
  },
};

export async function sendPasswordResetEmail(
  user: { email: string; firstName?: string; lastName?: string },
  token: string,
  locale: Locale = 'de'
): Promise<void> {
  const t = resetTranslations[locale];
  const appUrl = await getAppUrl();
  const emailTheme = await getEmailBrandTheme();
  const primaryButtonStyle = getEmailPrimaryButtonStyle(emailTheme);
  const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;

  const fullName = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  const htmlContent = `
    <p><strong>${t.greeting(fullName)},</strong></p>
    <p>${t.intro}</p>

    <center>
      <a href="${resetUrl}" style="${primaryButtonStyle}">${t.resetButton}</a>
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
    text: `${t.intro}\n\n${t.resetButton}: ${resetUrl}\n\n${t.expiryNote}`,
    html: await generateEmailHTML(htmlContent, emailTheme),
  };

  const transport = await getTransporter();
  await transport.sendMail(mailOptions);
}

type MeetingInviteLocale = 'de' | 'en';
type MeetingInviteUser = { email: string; firstName?: string; lastName?: string };
type MeetingInvitePayload = {
  eventTitle: string;
  seriesName: string;
  scheduledDate: Date;
  startTime: string;
  endTime?: string;
  location?: string;
  note?: string;
  acceptUrl: string;
  tentativeUrl: string;
  declineUrl: string;
};

type MeetingCancellationPayload = {
  eventTitle: string;
  seriesName: string;
  scheduledDate: Date;
  startTime: string;
  endTime?: string;
  location?: string;
  note?: string;
};

export async function sendMeetingInvitationEmail(
  user: MeetingInviteUser,
  payload: MeetingInvitePayload,
  locale: MeetingInviteLocale = 'de'
): Promise<void> {
  const dateLabel = new Date(payload.scheduledDate).toLocaleDateString(locale);
  const greeting = locale === 'de' ? `Hallo ${user.firstName || ''}`.trim() : `Hello ${user.firstName || ''}`.trim();
  const subject =
    locale === 'de'
      ? `Einladung: ${payload.eventTitle}`
      : `Invitation: ${payload.eventTitle}`;

  const detailsLabel = locale === 'de' ? 'Sitzungsdetails' : 'Meeting details';
  const locationLabel = locale === 'de' ? 'Ort' : 'Location';
  const noteLabel = locale === 'de' ? 'Hinweis' : 'Note';
  const timeText = payload.endTime ? `${payload.startTime} - ${payload.endTime}` : payload.startTime;
  const intro =
    locale === 'de'
      ? `Sie wurden zur Sitzung "${payload.eventTitle}" (${payload.seriesName}) eingeladen.`
      : `You have been invited to "${payload.eventTitle}" (${payload.seriesName}).`;

  const ctaAccept = locale === 'de' ? 'Zusage' : 'Accept';
  const ctaTentative = locale === 'de' ? 'Mit Vorbehalt' : 'Tentative';
  const ctaDecline = locale === 'de' ? 'Absage' : 'Decline';
  const footerHint =
    locale === 'de'
      ? 'Sie können Ihre Antwort später erneut über denselben Link ändern, solange der Link gültig ist.'
      : 'You can update your response later using the same link while it remains valid.';

  const emailTheme = await getEmailBrandTheme();

  const htmlContent = `
    <p><strong>${greeting},</strong></p>
    <p>${intro}</p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px; background-color: ${emailTheme.infoBackground}; border: 1px solid ${emailTheme.cardBorder}; border-left: 4px solid ${emailTheme.primary}; border-radius: 4px;">
      <tr>
        <td style="padding: 16px;">
          <p style="margin: 0 0 8px 0;"><strong>${detailsLabel}</strong></p>
          <p style="margin: 0 0 6px 0;">${dateLabel}, ${timeText}</p>
          ${payload.location ? `<p style="margin: 0 0 6px 0;"><strong>${locationLabel}:</strong> ${payload.location}</p>` : ''}
          ${payload.note ? `<p style="margin: 0;"><strong>${noteLabel}:</strong> ${payload.note}</p>` : ''}
        </td>
      </tr>
    </table>

    <center>
      <a href="${payload.acceptUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 20px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 6px;">${ctaAccept}</a>
      <a href="${payload.tentativeUrl}" style="display: inline-block; background: #f59e0b; color: white; padding: 12px 20px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 6px;">${ctaTentative}</a>
      <a href="${payload.declineUrl}" style="display: inline-block; background: #dc2626; color: white; padding: 12px 20px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 6px;">${ctaDecline}</a>
    </center>

    <p style="text-align: center; color: #6b7280; font-size: 13px; margin-top: 18px;">${footerHint}</p>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: user.email,
    subject,
    text:
      `${intro}\n\n` +
      `${dateLabel}, ${timeText}\n` +
      `${payload.location ? `${locationLabel}: ${payload.location}\n` : ''}` +
      `${payload.note ? `${noteLabel}: ${payload.note}\n` : ''}` +
      `\n${ctaAccept}: ${payload.acceptUrl}\n${ctaTentative}: ${payload.tentativeUrl}\n${ctaDecline}: ${payload.declineUrl}`,
    html: await generateEmailHTML(htmlContent, emailTheme),
  };

  const transport = await getTransporter();
  await transport.sendMail(mailOptions);
}

export async function sendMeetingCancellationEmail(
  user: MeetingInviteUser,
  payload: MeetingCancellationPayload,
  locale: MeetingInviteLocale = 'de'
): Promise<void> {
  const dateLabel = new Date(payload.scheduledDate).toLocaleDateString(locale);
  const greeting = locale === 'de' ? `Hallo ${user.firstName || ''}`.trim() : `Hello ${user.firstName || ''}`.trim();
  const subject =
    locale === 'de'
      ? `Absage: ${payload.eventTitle}`
      : `Cancelled: ${payload.eventTitle}`;

  const detailsLabel = locale === 'de' ? 'Sitzungsdetails' : 'Meeting details';
  const locationLabel = locale === 'de' ? 'Ort' : 'Location';
  const noteLabel = locale === 'de' ? 'Hinweis' : 'Note';
  const timeText = payload.endTime ? `${payload.startTime} - ${payload.endTime}` : payload.startTime;
  const intro =
    locale === 'de'
      ? `Die Sitzung "${payload.eventTitle}" (${payload.seriesName}) wurde abgesagt.`
      : `The meeting "${payload.eventTitle}" (${payload.seriesName}) has been cancelled.`;

  const emailTheme = await getEmailBrandTheme();

  const htmlContent = `
    <p><strong>${greeting},</strong></p>
    <p>${intro}</p>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px; background-color: #fff1f2; border: 1px solid #fecdd3; border-left: 4px solid #e11d48; border-radius: 4px;">
      <tr>
        <td style="padding: 16px;">
          <p style="margin: 0 0 8px 0;"><strong>${detailsLabel}</strong></p>
          <p style="margin: 0 0 6px 0;">${dateLabel}, ${timeText}</p>
          ${payload.location ? `<p style="margin: 0 0 6px 0;"><strong>${locationLabel}:</strong> ${payload.location}</p>` : ''}
          ${payload.note ? `<p style="margin: 0;"><strong>${noteLabel}:</strong> ${payload.note}</p>` : ''}
        </td>
      </tr>
    </table>
  `;

  const fromEmail = await getFromEmail();
  const mailOptions = {
    from: fromEmail,
    to: user.email,
    subject,
    text:
      `${intro}\n\n` +
      `${dateLabel}, ${timeText}\n` +
      `${payload.location ? `${locationLabel}: ${payload.location}\n` : ''}` +
      `${payload.note ? `${noteLabel}: ${payload.note}\n` : ''}`,
    html: await generateEmailHTML(htmlContent, emailTheme),
  };

  const transport = await getTransporter();
  await transport.sendMail(mailOptions);
}
