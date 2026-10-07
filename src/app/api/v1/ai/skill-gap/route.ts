/**
 * POST /api/v1/ai/skill-gap
 *   Body: { targetRole, currentSkills?, branch? }
 *
 * GET /api/v1/ai/skill-gap?jobId=xxx
 *   Polls AIResult for status + result.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, handleApiError } from '@/lib/auth-api-helpers';
import { aiResultRepository, studentRepository } from '@/lib/container';
import { addBackgroundJob } from '@/lib/queues/queue-manager';

const RequestSchema = z.object({
  targetRole: z.string().min(2).max(100),
  currentSkills: z.array(z.string()).optional(),
  branch: z.string().optional(),
});

const REQUEST_ID = 'ai:skill-gap';

export async function POST(req: NextRequest) {
  try {
    const payload = authenticateRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { tenantId, userId } = payload;
    const { targetRole, currentSkills, branch } = parsed.data;

    // Auto-fetch student skills if not provided
    let skills = currentSkills;
    if (!skills || skills.length === 0) {
      const student = await studentRepository.findById(userId, tenantId);
      skills = student?.skills ?? [];
    }

    const bullJob = await addBackgroundJob('ai:skill-gap', {
      currentSkills: skills,
      targetRole,
      branch,
      studentId: userId,
      tenantId,
    });

    await aiResultRepository.create({
      tenantId,
      studentId: userId,
      jobId: bullJob.id!,
      type: 'SKILL_GAP',
      payload: { targetRole, currentSkills: skills },
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
