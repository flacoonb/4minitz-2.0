import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getPushPublicKey } from '@/lib/push-service';

export async function GET(request: NextRequest) {
  const authResult = await verifyToken(request);
  if (!authResult.success) {
    return NextResponse.json({ error: authResult.error || 'Unauthorized' }, { status: 401 });
  }

  const publicKey = getPushPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { error: 'Push-Benachrichtigungen sind serverseitig nicht konfiguriert' },
      { status: 503 }
    );
  }

  return NextResponse.json({ success: true, publicKey });
}
