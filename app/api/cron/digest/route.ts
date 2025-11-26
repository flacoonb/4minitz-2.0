import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import PendingNotification from '@/models/PendingNotification';
import User from '@/models/User';
import { getTransporter, generateEmailHTML, getFromEmail, getAppUrl } from '@/lib/email-service';

export async function GET(request: NextRequest) {
  try {
    // Security check (optional secret)
    const cronSecret = request.headers.get('x-cron-secret');
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await connectDB();

    // Get all pending notifications
    const notifications = await PendingNotification.find({}).sort({ createdAt: 1 });
    
    if (notifications.length === 0) {
      return NextResponse.json({ message: 'No pending notifications' });
    }

    // Group by user
    const userNotifications: Record<string, typeof notifications> = {};
    for (const notif of notifications) {
      const uid = notif.userId.toString();
      if (!userNotifications[uid]) userNotifications[uid] = [];
      userNotifications[uid].push(notif);
    }

    const results = { sent: 0, skipped: 0, failed: 0 };
    const appUrl = await getAppUrl();
    const fromEmail = await getFromEmail();
    const transporter = await getTransporter();

    for (const [userId, items] of Object.entries(userNotifications)) {
      const user = await User.findById(userId);
      if (!user || !user.notificationSettings?.enableDigestEmails) {
        // User deleted or disabled digest -> delete notifications
        await PendingNotification.deleteMany({ userId });
        continue;
      }

      const frequency = user.notificationSettings.digestFrequency || 'daily';
      const today = new Date();
      
      // If weekly, only send on Monday (day 1)
      if (frequency === 'weekly' && today.getDay() !== 1) {
        results.skipped++;
        continue;
      }
      
      // If monthly, only send on 1st
      if (frequency === 'monthly' && today.getDate() !== 1) {
        results.skipped++;
        continue;
      }

      // Generate Email Content
      const locale = user.preferences?.language === 'en' ? 'en' : 'de';
      const t = locale === 'de' ? {
        subject: 'Ihre tägliche Zusammenfassung',
        greeting: `Hallo ${user.firstName},`,
        intro: `Hier ist Ihre Zusammenfassung der letzten Ereignisse bei 4Minitz:`,
        newMinutes: 'Neue Protokolle',
        newActions: 'Neue Aufgaben',
        viewDashboard: 'Zum Dashboard'
      } : {
        subject: 'Your Daily Digest',
        greeting: `Hello ${user.firstName},`,
        intro: `Here is your summary of recent events at 4Minitz:`,
        newMinutes: 'New Minutes',
        newActions: 'New Action Items',
        viewDashboard: 'Go to Dashboard'
      };

      const newMinutes = items.filter(i => i.type === 'newMinute');
      const newActions = items.filter(i => i.type === 'actionItemAssigned');

      let htmlBody = `
        <p><strong>${t.greeting}</strong></p>
        <p>${t.intro}</p>
      `;

      if (newMinutes.length > 0) {
        htmlBody += `<h3>${t.newMinutes}</h3><ul>`;
        newMinutes.forEach(m => {
           htmlBody += `<li><a href="${appUrl}/minutes/${m.data.minuteId}">${m.data.seriesName}</a> (${new Date(m.data.date).toLocaleDateString(locale)})</li>`;
        });
        htmlBody += `</ul>`;
      }

      if (newActions.length > 0) {
        htmlBody += `<h3>${t.newActions}</h3><ul>`;
        newActions.forEach(a => {
           htmlBody += `<li><strong>${a.data.subject}</strong> (${a.data.seriesName}) - ${new Date(a.data.dueDate).toLocaleDateString(locale)}</li>`;
        });
        htmlBody += `</ul>`;
      }

      htmlBody += `<center><a href="${appUrl}/dashboard" class="button">${t.viewDashboard}</a></center>`;

      try {
        await transporter.sendMail({
          from: fromEmail,
          to: user.email,
          subject: t.subject,
          html: generateEmailHTML(htmlBody)
        });
        
        // Delete processed notifications
        await PendingNotification.deleteMany({ userId, _id: { $in: items.map(i => i._id) } });
        results.sent++;
      } catch (e) {
        console.error(`Failed to send digest to ${user.email}`, e);
        results.failed++;
      }
    }

    return NextResponse.json({ success: true, results });

  } catch (error) {
    console.error('Digest error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
