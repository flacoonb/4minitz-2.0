import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authResult = await verifyToken(request);
    if (!authResult.success) {
      return NextResponse.json({ success: false, error: authResult.error }, { status: 401 });
    }

    const user = authResult.user!;
    // For debugging: only reveal any provided `x-user-id` header to admins
    const xUser = user.role === 'admin' ? request.headers.get('x-user-id') || null : null;

    return NextResponse.json({
      success: true,
      user: { id: user._id, username: user.username, role: user.role },
      xUser
    });
  } catch (_err) {
    return NextResponse.json({ success: false, error: 'failed' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Use POST to inspect headers (debug only).' });
}
