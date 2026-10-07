/**
 * POST /api/v1/ai/roadmap
 *   Body: { targetRole, weeksAvailable? }
 *
 * GET /api/v1/ai/roadmap?jobId=xxx
 *   Polls AIResult for status + result.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, handleApiError } from '@/lib/auth-api-helpers';
import { aiResultRepository, studentRepository } from '@/lib/container';
import { addBackgroundJob } from '@/lib/queues/queue-manager';

const RequestSchema = z.object({
  targetRole: z.string().min(2).max(100),
  weeksAvailable: z.number().int().min(4).max(52).optional().default(12),
});

const REQUEST_ID = 'ai:roadmap';

export async function POST(req: NextRequest) {
  try {
    const payload = authenticateRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { tenantId, userId } = payload;
    const { targetRole, weeksAvailable } = parsed.data;

    // Fetch student's current skills
    const student = await studentRepository.findById(userId, tenantId);
    const currentSkills = student?.skills ?? [];

    const bullJob = await addBackgroundJob('ai:roadmap', {
      currentSkills,
      targetRole,
      weeksAvailable,
      studentId: userId,
      tenantId,
    });

    await aiResultRepository.create({
      tenantId,
      studentId: userId,
      jobId: bullJob.id!,
      type: 'ROADMAP',
      payload: { targetRole, weeksAvailable, currentSkills },
    });

    return NextResponse.json({ jobId: bullJob.id, status: 'PENDING' }, { status: 202 });
  } catch (error) {
    return handleApiError(error, REQUEST_ID, REQUEST_ID);
  }
}

export async function GET(req: NextRequest) {
  try {
    const payload = authenticateRequest(req);
    const jobId = req.nextUrl.searchParams.get('jobId');
    if (!jobId) return NextResponse.json({ error: 'jobId query parameter required' }, { status: 400 });

    const record = await aiResultRepository.findByJobId(jobId, payload.tenantId);
    if (!record) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

    return NextResponse.json({ jobId: record.jobId, status: record.status, result: record.result });
  } catch (error) {
    return handleApiError(error, REQUEST_ID, REQUEST_ID);
  }
}
