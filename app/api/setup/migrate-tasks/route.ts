import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Minutes from '@/models/Minutes';
import Task from '@/models/Task';
import { verifyToken } from '@/lib/auth';

export async function GET(_request: NextRequest) {
  return new NextResponse(`
    <html>
      <head>
        <title>Task Migration</title>
        <style>
          body { font-family: sans-serif; padding: 2rem; max-width: 600px; margin: 0 auto; }
          button { padding: 10px 20px; font-size: 16px; cursor: pointer; background: #0070f3; color: white; border: none; border-radius: 5px; }
          button:disabled { background: #ccc; }
          pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
        </style>
      </head>
      <body>
        <h1>Migrate Tasks to Central Registry</h1>
        <p>This tool will scan all existing minutes, identify task chains, and create unique Task documents in the central registry.</p>
        <button id="btn" onclick="runMigration()">Start Migration</button>
        <div id="output" style="margin-top: 20px;"></div>
        <script>
          async function runMigration() {
            const btn = document.getElementById('btn');
            const out = document.getElementById('output');
            btn.disabled = true;
            btn.innerText = 'Migrating...';
            out.textContent = 'Running migration...';

            try {
              const res = await fetch('/api/setup/migrate-tasks', { method: 'POST' });
              const data = await res.json();
              const pre = document.createElement('pre');
              pre.textContent = JSON.stringify(data, null, 2);
              out.textContent = '';
              out.appendChild(pre);
            } catch (e) {
              out.innerText = 'Error: ' + e.message;
            } finally {
              btn.disabled = false;
              btn.innerText = 'Start Migration';
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

    // 1. Fetch all minutes with action items
    const minutes = await Minutes.find({
      'topics.infoItems.itemType': 'actionItem',
    }).sort({ date: 1 });


    // 2. Extract all action items
    const allItems: any[] = [];
    minutes.forEach((minute: any) => {
      minute.topics?.forEach((topic: any) => {
        topic.infoItems?.forEach((item: any) => {
          if (item.itemType === 'actionItem') {
            allItems.push({
              item,
              minuteId: minute._id,
              topicId: topic._id,
              date: minute.date,
              meetingSeriesId: minute.meetingSeries_id,
              isFinalized: minute.isFinalized,
              finalizedAt: minute.finalizedAt
            });
          }
        });
      });
    });

    // 3. Group into chains
    const chains = new Map<string, any[]>();
    
    // Helper to find item by ID
    const findItemById = (id: string) => allItems.find(e => e.item._id.toString() === id);

    allItems.forEach(entry => {
      const item = entry.item;
      const itemId = item._id.toString();
      const parentId = item.parentItemId || item.originalTaskId;

      // Find root
      let rootId = itemId;
      if (parentId) {
        // Recursive search up the chain
        let currentParentId = parentId;
        const visited = new Set<string>();
        visited.add(itemId);

        while (currentParentId) {
            if (visited.has(currentParentId)) break; // Cycle protection
            visited.add(currentParentId);
            
            const parentEntry = findItemById(currentParentId);
            if (parentEntry) {
                rootId = currentParentId; // Candidate root
                // Check if this parent has a parent
                currentParentId = parentEntry.item.parentItemId || parentEntry.item.originalTaskId;
            } else {
                // Parent not found in loaded items (maybe deleted?), stop here.
                rootId = currentParentId; 
                break;
            }
        }
      }

      if (!chains.has(rootId)) {
        chains.set(rootId, []);
      }
      chains.get(rootId)!.push(entry);
    });

    // 4. Process chains
    let createdCount = 0;
    let updatedCount = 0;

    for (const [_, chain] of chains) {
      // Determine the "latest" state
      // Sort chain by date/finalized
      chain.sort((a, b) => {
         // Logic to find latest: finalized > draft, later date > earlier date
         if (a.isFinalized && !b.isFinalized) return 1;
         if (!a.isFinalized && b.isFinalized) return -1;
         return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      const latestEntry = chain[chain.length - 1];
      const latestItem = latestEntry.item;

      // Check if any item in the chain already has an externalTaskId
      const existingExternalId = chain.find(e => e.item.externalTaskId)?.item.externalTaskId;

      let taskId = existingExternalId;

      if (!taskId) {
        // Create new Task
        const newTask = await Task.create({
          subject: latestItem.subject,
          details: latestItem.details,
          status: latestItem.status || 'open',
          priority: latestItem.priority || 'medium',
          dueDate: latestItem.dueDate,
          responsibles: latestItem.responsibles || [],
          meetingSeriesId: latestEntry.meetingSeriesId,
          createdBy: 'migration', 
        });
        taskId = newTask._id;
        createdCount++;
      }

      // 5. Update all items in the chain with the taskId
      for (const entry of chain) {
        if (entry.item.externalTaskId?.toString() === taskId.toString()) continue;

        await Minutes.updateOne(
          { _id: entry.minuteId },
          { $set: { "topics.$[t].infoItems.$[i].externalTaskId": taskId } },
          {
            arrayFilters: [
              { "t._id": entry.topicId },
              { "i._id": entry.item._id }
            ]
          }
        );
        updatedCount++;
      }
    }

    return NextResponse.json({ 
        success: true, 
        chainsFound: chains.size,
        tasksCreated: createdCount,
        itemsUpdated: updatedCount 
    });

  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
