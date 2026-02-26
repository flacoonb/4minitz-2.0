import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Minutes from '@/models/Minutes';
import Task from '@/models/Task';
import MeetingSeries from '@/models/MeetingSeries';
import { verifyToken } from '@/lib/auth';

export async function GET(_request: NextRequest) {
  return new NextResponse(`
    <html>
      <head>
        <title>System Reset</title>
        <style>
          body { font-family: sans-serif; padding: 2rem; max-width: 600px; margin: 0 auto; background-color: #fff0f0; }
          .container { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #d32f2f; margin-top: 0; }
          p { line-height: 1.5; }
          .warning { background: #ffebee; color: #c62828; padding: 1rem; border-radius: 4px; margin: 1rem 0; border: 1px solid #ef9a9a; }
          button { padding: 15px 30px; font-size: 18px; cursor: pointer; background: #d32f2f; color: white; border: none; border-radius: 5px; font-weight: bold; }
          button:hover { background: #b71c1c; }
          button:disabled { background: #ccc; cursor: not-allowed; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>⚠️ DANGER ZONE: System Reset</h1>
          <p>This tool allows you to wipe all protocol data to start fresh with the new Task Architecture.</p>
          
          <div class="warning">
            <strong>WARNING:</strong> This will permanently delete:
            <ul>
              <li>ALL Minutes / Protocols</li>
              <li>ALL Tasks / Action Items</li>
            </ul>
            Meeting Series (Projects) and Users will be KEPT.
          </div>

          <button id="btn" onclick="runReset()">DELETE ALL MINUTES & TASKS</button>
          <div id="output"></div>
        </div>

        <script>
          async function runReset() {
            if (!confirm('Are you absolutely sure? This cannot be undone.')) return;
            
            const btn = document.getElementById('btn');
            const out = document.getElementById('output');
            btn.disabled = true;
            btn.innerText = 'Deleting...';
            out.textContent = 'Processing...';

            try {
              const res = await fetch('/api/setup/reset-data', { method: 'POST' });
              const data = await res.json();
              const pre = document.createElement('pre');
              pre.textContent = JSON.stringify(data, null, 2);
              out.textContent = '';
              out.appendChild(pre);
              if (data.success) {
                btn.innerText = 'DONE - System Clean';
                btn.style.background = '#2e7d32';
              }
            } catch (e) {
              out.innerText = 'Error: ' + e.message;
              btn.disabled = false;
            }
          }
        </script>
      </body>
    </html>
  `, {
    headers: { 'content-type': 'text/html' },
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

    // 1. Delete all Minutes
    const minResult = await Minutes.deleteMany({});
    
    // 2. Delete all Tasks
    const taskResult = await Task.deleteMany({});

    // 3. Reset Meeting Series counters
    const seriesResult = await MeetingSeries.updateMany({}, {
      $set: {
        minutes: [],
        lastMinutesDate: null,
        lastMinutesFinalized: false,
        lastMinutesId: null
      }
    });

    return NextResponse.json({
      success: true,
      deletedMinutes: minResult.deletedCount,
      deletedTasks: taskResult.deletedCount,
      resetSeries: seriesResult.modifiedCount
    });

  } catch (error: any) {
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
