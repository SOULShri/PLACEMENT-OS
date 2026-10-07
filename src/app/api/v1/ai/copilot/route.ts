/**
 * POST /api/v1/ai/copilot
 *   General placement Q&A.
 *   Body: { message, context? }
 *
 * GET /api/v1/ai/copilot?jobId=xxx
 *   Polls AIResult for status + result.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, handleApiError } from '@/lib/auth-api-helpers';
import { aiResultRepository, studentRepository } from '@/lib/container';
import { addBackgroundJob } from '@/lib/queues/queue-manager';

const RequestSchema = z.object({
  message: z.string().min(3).max(1000),
  context: z.record(z.string(), z.unknown()).optional(),
});

const REQUEST_ID = 'ai:copilot';

export async function POST(req: NextRequest) {
  try {
    const payload = authenticateRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { tenantId, userId } = payload;
    const { message, context } = parsed.data;

    // Enrich context with student profile for personalized responses
    let enrichedContext: Record<string, unknown> = context ?? {};
    try {
      const student = await studentRepository.findById(userId, tenantId);
      if (student) {
        enrichedContext = {
          ...enrichedContext,
          cgpa: student.cgpa,
          branch: student.branch,
          skills: student.skills,
        };
      }
    } catch {
      // Non-critical — proceed without enrichment
    }

    const bullJob = await addBackgroundJob('ai:copilot', {
      message,
      context: enrichedContext,
      studentId: userId,
      tenantId,
    });

    await aiResultRepository.create({
      tenantId,
      studentId: userId,
      jobId: bullJob.id!,
      type: 'COPILOT',
      payload: { message },
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
