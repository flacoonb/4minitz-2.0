import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';

/**
 * GET /api/health
 * Health check endpoint for monitoring
 */
export async function GET() {
  try {
    // Check database connection
    await connectDB();

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'operational',
        database: 'connected',
      },
      version: '1.0.0',
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          api: 'operational',
          database: 'disconnected',
        },
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
