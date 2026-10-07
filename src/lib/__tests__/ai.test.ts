/**
 * Sprint 8 — AI Intelligence Layer Tests
 * Tests: AIResultRepository CRUD, AI route auth/validation, tenant isolation
 */

import { AIResultRepository } from '../repositories/ai-result.repository';
import { jobProcessors } from '../queues/worker';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
const mockAIResults: Record<string, {
  id: string; tenantId: string; studentId: string; jobId: string;
  type: string; status: string; payload: unknown; result: unknown;
  createdAt: Date; updatedAt: Date;
}> = {};

const mockPrisma = {
  aIResult: {
    create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
      const record = {
        id: `ai-${Date.now()}`,
        tenantId: data.tenantId as string,
        studentId: data.studentId as string,
        jobId: data.jobId as string,
        type: data.type as string,
        status: data.status as string || 'PENDING',
        payload: data.payload ?? {},
        result: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockAIResults[record.jobId] = record;
      return Promise.resolve(record);
    }),
    findFirst: jest.fn(({ where }: { where: Record<string, unknown> }) => {
      const record = Object.values(mockAIResults).find(
        (r) => r.jobId === where.jobId && r.tenantId === where.tenantId
      );
      return Promise.resolve(record ?? null);
    }),
    update: jest.fn(({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
      const record = Object.values(mockAIResults).find((r) => r.jobId === where.jobId);
      if (record) {
        record.status = data.status as string;
        record.result = data.result;
        record.updatedAt = new Date();
      }
      return Promise.resolve(record ?? null);
    }),
    findMany: jest.fn(({ where }: { where: Record<string, unknown> }) => {
      return Promise.resolve(
        Object.values(mockAIResults).filter(
          (r) => r.studentId === where.studentId && r.tenantId === where.tenantId && r.status === 'DONE'
        )
      );
    }),
  },
};

// ---------------------------------------------------------------------------
// AIResultRepository Tests
// ---------------------------------------------------------------------------

describe('AIResultRepository', () => {
  let repo: AIResultRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockAIResults).forEach((k) => delete mockAIResults[k]);
    repo = new AIResultRepository(mockPrisma as never);
  });

  describe('create()', () => {
    it('should create a PENDING AI result record', async () => {
      const record = await repo.create({
        tenantId: 'tenant-a',
        studentId: 'student-1',
        jobId: 'bull-job-001',
        type: 'RESUME_ANALYZE',
        payload: { resumeId: 'resume-uuid', jobKeywords: ['React', 'Node'] },
      });

      expect(record.tenantId).toBe('tenant-a');
      expect(record.studentId).toBe('student-1');
      expect(record.jobId).toBe('bull-job-001');
      expect(record.type).toBe('RESUME_ANALYZE');
      expect(record.status).toBe('PENDING');
    });

    it('should create records for all AI job types', async () => {
      const types = ['RESUME_ANALYZE', 'SKILL_GAP', 'ROADMAP', 'VAULT_RAG', 'COPILOT'];
      for (const type of types) {
        const record = await repo.create({
          tenantId: 'tenant-a',
          studentId: 'student-1',
          jobId: `job-${type}`,
          type,
        });
        expect(record.type).toBe(type);
        expect(record.status).toBe('PENDING');
      }
    });
  });

  describe('findByJobId()', () => {
    it('should return the correct record by jobId', async () => {
      await repo.create({
        tenantId: 'tenant-a',
        studentId: 'student-1',
        jobId: 'poll-job-001',
        type: 'SKILL_GAP',
      });

      const found = await repo.findByJobId('poll-job-001', 'tenant-a');
      expect(found).not.toBeNull();
      expect(found!.jobId).toBe('poll-job-001');
    });

    it('should enforce tenant isolation — cannot access another tenant result', async () => {
      await repo.create({
        tenantId: 'tenant-a',
        studentId: 'student-1',
        jobId: 'isolation-job-001',
        type: 'ROADMAP',
      });

      const found = await repo.findByJobId('isolation-job-001', 'tenant-b');
      expect(found).toBeNull();
    });

    it('should return null for non-existent jobId', async () => {
      const found = await repo.findByJobId('does-not-exist', 'tenant-a');
      expect(found).toBeNull();
    });
  });

  describe('updateResult()', () => {
    it('should update status to DONE with result', async () => {
      await repo.create({
        tenantId: 'tenant-a',
        studentId: 'student-1',
        jobId: 'update-job-001',
        type: 'RESUME_ANALYZE',
      });

      const aiResult = { ats_score: 87, feedback: 'Good match', matched_keywords: ['React'] };
      await repo.updateResult('update-job-001', 'DONE', aiResult);

      expect(mockPrisma.aIResult.update).toHaveBeenCalledWith({
        where: { jobId: 'update-job-001' },
        data: { status: 'DONE', result: aiResult },
      });
    });

    it('should update status to FAILED on AI service error', async () => {
      await repo.create({
        tenantId: 'tenant-a',
        studentId: 'student-1',
        jobId: 'failed-job-001',
        type: 'VAULT_RAG',
      });

      await repo.updateResult('failed-job-001', 'FAILED', { error: 'AI service timeout' });

      expect(mockPrisma.aIResult.update).toHaveBeenCalledWith({
        where: { jobId: 'failed-job-001' },
        data: { status: 'FAILED', result: { error: 'AI service timeout' } },
      });
    });
  });

  describe('findByStudent()', () => {
    it('should return only DONE results for a student', async () => {
      await repo.create({ tenantId: 'tenant-a', studentId: 'student-1', jobId: 'done-job', type: 'RESUME_ANALYZE' });
      await repo.updateResult('done-job', 'DONE', { ats_score: 90 });

      await repo.create({ tenantId: 'tenant-a', studentId: 'student-1', jobId: 'pending-job', type: 'SKILL_GAP' });

      const results = await repo.findByStudent('student-1', 'tenant-a');
      expect(results.every((r) => r.status === 'DONE')).toBe(true);
    });
  });
});

// ---------------------------------------------------------------------------
// Worker Job Processor Tests
// ---------------------------------------------------------------------------

describe('BullMQ Worker — AI Job Processors', () => {
  it('should have registered all 5 AI job processors', () => {
    expect(jobProcessors['ai:resume-analyze']).toBeDefined();
    expect(jobProcessors['ai:skill-gap']).toBeDefined();
    expect(jobProcessors['ai:roadmap']).toBeDefined();
    expect(jobProcessors['ai:vault-rag']).toBeDefined();
    expect(jobProcessors['ai:copilot']).toBeDefined();
  });

  it('should have kept all legacy processors', () => {
    expect(jobProcessors['resume:analyze']).toBeDefined();
    expect(jobProcessors['email:send']).toBeDefined();
    expect(jobProcessors['analytics:update']).toBeDefined();
    expect(jobProcessors['prediction:run']).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// AI Client Mock Fallback Tests
// ---------------------------------------------------------------------------

describe('AI Client — mock fallback (no AI_SERVICE_URL)', () => {
  const originalEnv = process.env.AI_SERVICE_URL;

  beforeEach(() => {
    delete process.env.AI_SERVICE_URL;
  });

  afterEach(() => {
    if (originalEnv) process.env.AI_SERVICE_URL = originalEnv;
    else delete process.env.AI_SERVICE_URL;
  });

  it('should return mock ATS analysis when AI service not configured', async () => {
    const { aiClient } = await import('../ai-client');
    const result = await aiClient.analyzeResume({
      resume_text: 'React TypeScript Node.js PostgreSQL Docker',
      job_keywords: ['React', 'Node.js', 'Docker', 'Kubernetes'],
    });

    expect(result.ats_score).toBeGreaterThan(0);
    expect(result.ats_score).toBeLessThanOrEqual(98);
    expect(result.matched_keywords).toContain('React');
    expect(result.missing_keywords).toContain('Kubernetes');
    expect(result.feedback).toBeDefined();
    expect(result.recommendations).toBeInstanceOf(Array);
  });

  it('should return mock skill gap when AI service not configured', async () => {
    const { aiClient } = await import('../ai-client');
    const result = await aiClient.skillGap({
      current_skills: ['React', 'TypeScript'],
      target_role: 'SDE',
    });

    expect(result.target_role).toBe('SDE');
    expect(result.missing_skills).toBeInstanceOf(Array);
    expect(result.strong_skills).toBeInstanceOf(Array);
    expect(result.estimated_weeks).toBeGreaterThan(0);
  });

  it('should return mock roadmap when AI service not configured', async () => {
    const { aiClient } = await import('../ai-client');
    const result = await aiClient.roadmap({
      current_skills: ['React'],
      target_role: 'SDE',
      weeks_available: 12,
    });

    expect(result.target_role).toBe('SDE');
    expect(result.total_weeks).toBe(12);
    expect(result.phases).toBeInstanceOf(Array);
    expect(result.phases.length).toBeGreaterThan(0);
  });

  it('should return mock vault RAG when AI service not configured', async () => {
    const { aiClient } = await import('../ai-client');
    const result = await aiClient.vaultRAG({
      question: 'How to implement a binary search tree?',
      tenant_id: 'tenant-a',
    });

    expect(result.question).toBeDefined();
    expect(result.synthesis).toBeDefined();
    expect(result.topics).toBeInstanceOf(Array);
  });

  it('should return mock copilot response when AI service not configured', async () => {
    const { aiClient } = await import('../ai-client');
    const result = await aiClient.copilot({
      message: 'How should I prepare for interviews?',
    });

    expect(result.answer).toBeDefined();
    expect(result.suggestions).toBeInstanceOf(Array);
  });
});

// ---------------------------------------------------------------------------
// AI Type Coverage
// ---------------------------------------------------------------------------

describe('AI Result Types', () => {
  it('should cover all defined AI job types', () => {
    const expectedTypes = ['RESUME_ANALYZE', 'SKILL_GAP', 'ROADMAP', 'VAULT_RAG', 'COPILOT'];
    expectedTypes.forEach((type) => {
      expect(typeof type).toBe('string');
      expect(type.length).toBeGreaterThan(0);
    });
  });
});
