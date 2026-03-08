import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import { verifyToken } from '@/lib/auth';
import PushSubscription from '@/models/PushSubscription';

interface SubscriptionBody {
  endpoint: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

function validateSubscription(input: any): SubscriptionBody | null {
  if (!input || typeof input !== 'object') return null;
  if (typeof input.endpoint !== 'string' || input.endpoint.length < 10 || input.endpoint.length > 2000) {
    return null;
  }
  if (!/^https:\/\//i.test(input.endpoint)) return null;
  if (!input.keys || typeof input.keys !== 'object') return null;
  if (typeof input.keys.p256dh !== 'string' || input.keys.p256dh.length < 20) return null;
  if (typeof input.keys.auth !== 'string' || input.keys.auth.length < 8) return null;

  return {
    endpoint: input.endpoint.trim(),
    keys: {
      p256dh: input.keys.p256dh.trim(),
      auth: input.keys.auth.trim(),
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const subscription = validateSubscription(body?.subscription);
    if (!subscription) {
      return NextResponse.json({ error: 'Ungültige Push-Subscription' }, { status: 400 });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint: subscription.endpoint },
      {
        $set: {
          userId: authResult.user._id,
          endpoint: subscription.endpoint,
          keys: subscription.keys,
          userAgent: request.headers.get('user-agent') || '',
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error storing push subscription:', error);
    return NextResponse.json({ error: 'Fehler beim Speichern der Push-Subscription' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    let endpoint: string | null = null;
    try {
      const body = await request.json();
      if (body?.endpoint && typeof body.endpoint === 'string') {
        endpoint = body.endpoint.trim();
      }
    } catch {
      endpoint = null;
    }

    const userId = authResult.user._id;
    const result = endpoint
      ? await PushSubscription.deleteOne({ userId, endpoint })
      : await PushSubscription.deleteMany({ userId });

    return NextResponse.json({
      success: true,
      removed: 'deletedCount' in result ? result.deletedCount : 0,
    });
  } catch (error) {
    console.error('Error deleting push subscription:', error);
    return NextResponse.json({ error: 'Fehler beim Entfernen der Push-Subscription' }, { status: 500 });
  }
}
