import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Minutes from '@/models/Minutes';
import { sendOverdueReminder } from '@/lib/email-service';
import { isEmailIdentifier, lookupUsersByIdentifiers, normalizeIdentifier } from '@/lib/user-identifiers';

/**
 * GET /api/cron/overdue-reminders
 * Sends reminder emails for overdue action items
 * Should be called by a cron job (e.g., daily at 9:00 AM)
 */
export async function GET(request: NextRequest) {
  try {
    // Security: Check for cron secret (mandatory)
    const cronSecret = request.headers.get('x-cron-secret');
    if (!process.env.CRON_SECRET || cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    await connectDB();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find finalized minutes with action items (batch to prevent memory exhaustion)
    const minutes = await Minutes.find({
      isFinalized: true,
      'topics.infoItems.dueDate': { $lt: today },
    })
      .populate('meetingSeries_id')
      .limit(1000)
      .lean();

    // Collect overdue items by responsible person
    const overdueByUser: Record<string, any[]> = {};

    for (const minute of minutes) {
      for (const topic of minute.topics || []) {
        for (const item of topic.infoItems || []) {
          const actionItem = item as any;
          if (
            actionItem.itemType === 'actionItem' &&
            actionItem.status !== 'completed' && actionItem.status !== 'cancelled' &&
            actionItem.dueDate &&
            new Date(actionItem.dueDate) < today
          ) {
            // Add to each responsible person
            for (const responsible of actionItem.responsibles || []) {
              if (!overdueByUser[responsible]) {
                overdueByUser[responsible] = [];
              }
              overdueByUser[responsible].push({
                subject: actionItem.subject,
                dueDate: actionItem.dueDate,
                priority: actionItem.priority,
                meetingSeries: minute.meetingSeries_id,
                minuteDate: minute.date,
              });
            }
          }
        }
      }
    }

    // Send reminders
    const results = {
      sent: 0,
      failed: 0,
      skippedNoEmail: 0,
      users: Object.keys(overdueByUser).length,
      totalItems: 0,
    };

    const userLookup = await lookupUsersByIdentifiers(Object.keys(overdueByUser), '_id email username');

    for (const [identifier, items] of Object.entries(overdueByUser)) {
      results.totalItems += items.length;
      const user = userLookup.get(normalizeIdentifier(identifier)) as any;
      const targetEmail = (user?.email || (isEmailIdentifier(identifier) ? identifier : '')).trim().toLowerCase();
      if (!targetEmail) {
        results.skippedNoEmail++;
        continue;
      }

      try {
        await sendOverdueReminder(targetEmail, items, 'de');
        results.sent++;
      } catch (error) {
        console.error(`Failed to send reminder to ${targetEmail}:`, error);
        results.failed++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Overdue reminders processed',
      results,
    });
  } catch (error) {
    console.error('Error processing overdue reminders:', error);
    return NextResponse.json(
      { error: 'Failed to process reminders' },
      { status: 500 }
    );
  }
}
