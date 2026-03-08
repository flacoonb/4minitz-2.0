import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';

/**
 * GET /api/health
 * Health check endpoint for monitoring.
 * Returns minimal info - only HTTP status code matters (200 vs 503).
 */
export async function GET() {
  try {
    await connectDB();
    const response = NextResponse.json({ status: 'ok' });
    response.headers.set('Cache-Control', 'no-cache');
    return response;
  } catch {
    return NextResponse.json({ status: 'error' }, { status: 503 });
  }
}
