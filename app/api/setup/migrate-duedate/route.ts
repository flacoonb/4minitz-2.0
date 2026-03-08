import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Minutes from '@/models/Minutes';
import { verifyToken } from '@/lib/auth';

/**
 * POST /api/setup/migrate-duedate
 * Renames `duedate` field to `dueDate` in all existing minutes documents.
 * Admin-only, run once after deploying the schema change.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    await connectDB();

    // MongoDB $rename doesn't work with nested arrays, so we load and transform
    const minutes = await Minutes.find({ "topics.infoItems.duedate": { $exists: true } });

    let updatedCount = 0;
    for (const minute of minutes) {
      let modified = false;
      for (const topic of minute.topics) {
        if (!topic.infoItems) continue;
        for (const item of topic.infoItems) {
          const raw = (item as any);
          if (raw.duedate !== undefined && raw.dueDate === undefined) {
            raw.dueDate = raw.duedate;
            raw.duedate = undefined;
            modified = true;
          }
        }
      }
      if (modified) {
        await minute.save();
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: `Migration complete. ${updatedCount} minutes updated.`,
      total: minutes.length,
      updated: updatedCount,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed' },
      { status: 500 }
    );
  }
}
