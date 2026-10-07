import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redisConnection } from '@/lib/queues/queue-manager';

export async function GET() {
  try {
    // 1. Check database latency
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;

    // 2. Check Redis latency
    const redisStart = Date.now();
    await redisConnection.ping();
    const redisLatency = Date.now() - redisStart;

    return NextResponse.json({
      status: 'READY',
      checks: {
        database: {
          status: 'UP',
          latencyMs: dbLatency,
        },
        redis: {
          status: 'UP',
          latencyMs: redisLatency,
        },
      },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        status: 'NOT_READY',
        error: errorMessage,
      },
      { status: 503 }
    );
  }
}
