import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Minutes from '@/models/Minutes';
import Task from '@/models/Task';
import { verifyToken } from '@/lib/auth';

export async function GET(_request: NextRequest) {
  return new NextResponse(`
    <html>
      <head>
        <title>Backfill Minutes ID</title>
        <style>
          body { font-family: sans-serif; padding: 2rem; max-width: 600px; margin: 0 auto; }
          button { padding: 10px 20px; font-size: 16px; cursor: pointer; background: #0070f3; color: white; border: none; border-radius: 5px; }
          button:disabled { background: #ccc; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>Backfill Minutes ID in Tasks</h1>
        <p>This tool will scan all minutes and update the linked Tasks with the correct minutesId.</p>
        <button id="btn" onclick="runMigration()">Start Backfill</button>
        <div id="output" style="margin-top: 20px;"></div>
        <script>
          async function runMigration() {
            const btn = document.getElementById('btn');
            const out = document.getElementById('output');
            btn.disabled = true;
            btn.innerText = 'Processing...';
            out.textContent = 'Running backfill...';

            try {
              const res = await fetch('/api/setup/backfill-minutes-id', { method: 'POST' });
              const data = await res.json();
              const pre = document.createElement('pre');
              pre.textContent = JSON.stringify(data, null, 2);
              out.textContent = '';
              out.appendChild(pre);
            } catch (e) {
              out.innerText = 'Error: ' + e.message;
            } finally {
              btn.disabled = false;
              btn.innerText = 'Start Backfill';
            }
          }
        </script>
      </body>
    </html>
  `, {
    headers: {
      'content-type': 'text/html',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (authResult.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin only' }, { status: 403 });
    }

    // 1. Fetch all minutes with action items, sorted by date (oldest first)
    const minutes = await Minutes.find({
      'topics.infoItems.itemType': 'actionItem',
    }).sort({ date: 1 });


    let updatedCount = 0;
    let errors = 0;

    // 2. Iterate and update tasks
    for (const minuteDoc of minutes) {
      const minute = minuteDoc as any;
      if (!minute.topics) continue;

      for (const topic of minute.topics) {
        if (!topic.infoItems) continue;

        for (const item of topic.infoItems) {
          if (item.itemType === 'actionItem' && item.externalTaskId) {
            try {
              // Update the task with the current minute ID
              // Since we iterate oldest to newest, the last update will be the latest minute
              await Task.findByIdAndUpdate(item.externalTaskId, {
                minutesId: minute._id.toString()
              });
              updatedCount++;
            } catch (err) {
              console.error(`Error updating task ${item.externalTaskId}:`, err);
              errors++;
            }
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Backfill completed',
      stats: {
        minutesProcessed: minutes.length,
        tasksUpdated: updatedCount,
        errors
      }
    });

  } catch (error: any) {
    console.error('Error during backfill:', error);
    return NextResponse.json(
      { error: 'Backfill failed' },
      { status: 500 }
    );
  }
}
