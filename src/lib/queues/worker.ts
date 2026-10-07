import { Worker, Job } from 'bullmq';
import { connectionOptions, dlqQueue } from './queue-manager';
import { logger } from '@/lib/logger';
import { aiClient } from '@/lib/ai-client';
import { AIResultRepository } from '@/lib/repositories/ai-result.repository';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';

const aiResultRepository = new AIResultRepository(prisma);

// ---------------------------------------------------------------------------
// AI Job Handlers — each handler:
//   1. Calls the FastAPI AI service via aiClient (HTTP, with mock fallback)
//   2. Stores the result in the AIResult table (status: DONE or FAILED)
//   3. The Next.js polling route reads from AIResult by jobId
// ---------------------------------------------------------------------------

async function handleAIJob<T>(
  bullJobId: string,
  aiCall: () => Promise<T>
): Promise<T> {
  try {
    const result = await aiCall();
    await aiResultRepository.updateResult(bullJobId, 'DONE', result as Prisma.InputJsonValue);
    return result;
  } catch (error) {
    await aiResultRepository.updateResult(bullJobId, 'FAILED', {
      error: error instanceof Error ? error.message : 'Unknown error',
    } as Prisma.InputJsonValue);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// 1. Pluggable Job Processor Registry
// ---------------------------------------------------------------------------
export const jobProcessors: Record<string, (data: Record<string, unknown>, jobId: string) => Promise<unknown>> = {
  // Legacy processors (keep for backwards compatibility)
  'resume:analyze': async (data) => {
    logger.info('[Worker] Legacy resume:analyze job — use ai:resume-analyze instead', data);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { success: true, atsScore: 85 };
  },

  'email:send': async (data) => {
    logger.info('[Worker] Dispatching secure placement email notification...', data);
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { success: true };
  },

  'analytics:update': async (data) => {
    logger.info('[Worker] Re-aggregating branch selection percentages...', data);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return { success: true };
  },

  'prediction:run': async (data) => {
    logger.info('[Worker] Running placement simulation calculations...', data);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true };
  },

  // ---------------------------------------------------------------------------
  // AI Intelligence Layer — Sprint 8
  // ---------------------------------------------------------------------------

  'ai:resume-analyze': async (data, jobId) => {
    logger.info('[Worker] Starting AI resume analysis', { jobId });
    return handleAIJob(jobId, () =>
      aiClient.analyzeResume({
        resume_text: data.resumeText as string,
        job_keywords: (data.jobKeywords as string[]) || [],
        student_id: data.studentId as string | undefined,
        tenant_id: data.tenantId as string | undefined,
      })
    );
  },

  'ai:skill-gap': async (data, jobId) => {
    logger.info('[Worker] Starting AI skill gap analysis', { jobId });
    return handleAIJob(jobId, () =>
      aiClient.skillGap({
        current_skills: (data.currentSkills as string[]) || [],
        target_role: data.targetRole as string,
        branch: data.branch as string | undefined,
      })
    );
  },

  'ai:roadmap': async (data, jobId) => {
    logger.info('[Worker] Starting AI roadmap generation', { jobId });
    return handleAIJob(jobId, () =>
      aiClient.roadmap({
        current_skills: (data.currentSkills as string[]) || [],
        target_role: data.targetRole as string,
        weeks_available: (data.weeksAvailable as number) || 12,
      })
    );
  },

  'ai:vault-rag': async (data, jobId) => {
    logger.info('[Worker] Starting AI vault RAG query', { jobId });
    return handleAIJob(jobId, () =>
      aiClient.vaultRAG({
        question: data.question as string,
        tenant_id: data.tenantId as string,
        company_id: data.companyId as string | undefined,
      })
    );
  },

  'ai:copilot': async (data, jobId) => {
    logger.info('[Worker] Starting AI copilot response', { jobId });
    return handleAIJob(jobId, () =>
      aiClient.copilot({
        message: data.message as string,
        context: data.context as Record<string, unknown> | undefined,
      })
    );
  },
};

// ---------------------------------------------------------------------------
// 2. Initialize Worker
// ---------------------------------------------------------------------------
let worker: Worker | null = null;

export function startQueueWorker() {
  if (worker) return worker;

  worker = new Worker(
    'placement-tasks',
    async (job: Job) => {
      logger.info(`[Worker] Starting job: ${job.name} (ID: ${job.id})`);
      const processor = jobProcessors[job.name];
      if (processor) {
        return await processor(job.data, job.id!);
      }
      throw new Error(`Processor not registered for job: ${job.name}`);
    },
    { connection: connectionOptions }
  );

  worker.on('completed', (job) => {
    logger.info(`[Worker] Job ${job.name} (ID: ${job.id}) completed successfully.`);
  });

  worker.on('failed', async (job, err) => {
    logger.error(`[Worker] Job ${job?.name} (ID: ${job?.id}) execution failed: ${err.message}`);

    // DLQ Routing: If the job has exhausted all configured retry attempts, copy it to the DLQ.
    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
      logger.warn(`[Worker] Job ${job.id} exhausted all retries. Moving to Dead Letter Queue.`);
      try {
        await dlqQueue.add(
          `${job.name}:dlq`,
          {
            originalJobId: job.id,
            failedAt: new Date().toISOString(),
            error: err.message,
            stack: err.stack,
            data: job.data,
          },
          {
            removeOnComplete: false,
          }
        );
      } catch (dlqErr) {
        logger.error('[Worker] Failed to route job to DLQ', dlqErr);
      }
    }
  });

  logger.info('BullMQ worker initialized and listening on placement-tasks queue.');
  return worker;
}
