/**
 * POST /api/v1/ai/vault-rag
 *   RAG query over the ChromaDB interview vault.
 *   Body: { question, companyId? }
 *
 * GET /api/v1/ai/vault-rag?jobId=xxx
 *   Polls AIResult for status + result.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticateRequest, handleApiError } from '@/lib/auth-api-helpers';
import { aiResultRepository } from '@/lib/container';
import { addBackgroundJob } from '@/lib/queues/queue-manager';

const RequestSchema = z.object({
  question: z.string().min(5).max(500),
  companyId: z.string().uuid().optional(),
});

const REQUEST_ID = 'ai:vault-rag';

export async function POST(req: NextRequest) {
  try {
    const payload = authenticateRequest(req);
    const body = await req.json().catch(() => null);
    const parsed = RequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { tenantId, userId } = payload;
    const { question, companyId } = parsed.data;

    const bullJob = await addBackgroundJob('ai:vault-rag', {
      question,
      companyId,
      tenantId,
      studentId: userId,
    });

    await aiResultRepository.create({
      tenantId,
      studentId: userId,
      jobId: bullJob.id!,
      type: 'VAULT_RAG',
      payload: { question, companyId },
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
