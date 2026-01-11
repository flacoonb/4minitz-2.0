import {
  generateEmailHTML,
  getAppUrl,
  getFromEmail,
  getTransporter,
} from './email-service';

export * from './email-service';

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
  const resetUrl = `${appUrl}/auth/reset-password?token=${token}`;

  const fullName = [user.firstName, user.lastName]
    .filter(Boolean)
    .join(' ')
    .trim();

  const htmlContent = `
    <p><strong>${t.greeting(fullName)},</strong></p>
    <p>${t.intro}</p>
    
    <center>
      <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(to right, #9333ea, #db2777); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 24px; text-align: center; box-shadow: 0 4px 6px -1px rgba(147, 51, 234, 0.3); font-family: sans-serif;">${t.resetButton}</a>
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
    html: await generateEmailHTML(htmlContent),
  };

  const transport = await getTransporter();
  await transport.sendMail(mailOptions);
}
