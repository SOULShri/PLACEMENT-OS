/**
 * POST /api/v1/ai/analyze-resume
 *   Enqueues an AI resume analysis job and returns the BullMQ job ID for polling.
 *   Body: { resumeId, jobKeywords }
 *
 * GET /api/v1/ai/analyze-resume?jobId=xxx
 *   Polls the AIResult table and returns status + result when DONE.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, handleApiError } from '@/lib/auth-api-helpers';
import { aiResultRepository } from '@/lib/container';
import { addBackgroundJob } from '@/lib/queues/queue-manager';
import { resumeRepository } from '@/lib/container';

const RequestSchema = z.object({
  resumeId: z.string().uuid('Invalid resume ID'),
  jobKeywords: z.array(z.string()).min(1, 'At least one keyword required').max(30),
});

const REQUEST_ID = 'ai:analyze-resume';

export async function POST(req: NextRequest) {
  try {
    const payload = authenticateRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { resumeId, jobKeywords } = parsed.data;
    const { tenantId, userId } = payload;

    // Fetch resume text (skills + projects as proxy for resume text)
    const resume = await resumeRepository.findById(resumeId, tenantId);
    if (!resume) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 });
    }

    // Build resume text representation from stored metadata
    const resumeText = [resume.education ?? '', ...resume.skills, ...resume.projects].join(' ');

    // Enqueue BullMQ job
    const bullJob = await addBackgroundJob('ai:resume-analyze', {
      resumeText,
      jobKeywords,
      resumeId,
      studentId: userId,
      tenantId,
    });

    // Create PENDING record for polling
    await aiResultRepository.create({
      tenantId,
      studentId: userId,
      jobId: bullJob.id!,
      type: 'RESUME_ANALYZE',
      payload: { resumeId, jobKeywords },
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

    return NextResponse.json({
      jobId: record.jobId,
      status: record.status,
      type: record.type,
      result: record.result,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  } catch (error) {
    return handleApiError(error, REQUEST_ID, REQUEST_ID);
  }
}
