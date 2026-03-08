import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import connectDB from '@/lib/mongodb';
import User from '@/models/User';
import { verifyToken } from '@/lib/auth';

function getRequestBaseUrl(request: NextRequest): string {
  const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  const host = request.headers.get('host')?.trim();
  if (host) {
    const proto = request.nextUrl.protocol.replace(/:$/, '') || 'https';
    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

function createCalendarToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

function buildIcalUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/api/calendar/ical/${token}`;
}

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const user = await User.findById(authResult.user._id).select('calendarFeedToken');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.calendarFeedToken) {
      user.calendarFeedToken = createCalendarToken();
      user.calendarFeedTokenCreatedAt = new Date();
      await user.save();
    }

    const baseUrl = getRequestBaseUrl(request);
    return NextResponse.json({
      success: true,
      data: {
        subscribeUrl: buildIcalUrl(baseUrl, user.calendarFeedToken),
        hasToken: true,
      },
    });
  } catch (error) {
    console.error('Error reading calendar subscription settings:', error);
    return NextResponse.json({ error: 'Failed to load calendar subscription' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const user = await User.findById(authResult.user._id).select('calendarFeedToken calendarFeedTokenCreatedAt');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user.calendarFeedToken = createCalendarToken();
    user.calendarFeedTokenCreatedAt = new Date();
    await user.save();

    const baseUrl = getRequestBaseUrl(request);
    return NextResponse.json({
      success: true,
      data: {
        subscribeUrl: buildIcalUrl(baseUrl, user.calendarFeedToken),
        hasToken: true,
      },
    });
  } catch (error) {
    console.error('Error regenerating calendar subscription token:', error);
    return NextResponse.json({ error: 'Failed to regenerate calendar subscription token' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();

    const authResult = await verifyToken(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
    }

    const user = await User.findById(authResult.user._id).select('calendarFeedToken calendarFeedTokenCreatedAt');
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user.calendarFeedToken = undefined;
    user.calendarFeedTokenCreatedAt = undefined;
    await user.save();

    return NextResponse.json({ success: true, data: { hasToken: false } });
  } catch (error) {
    console.error('Error revoking calendar subscription token:', error);
    return NextResponse.json({ error: 'Failed to revoke calendar subscription token' }, { status: 500 });
  }
}
