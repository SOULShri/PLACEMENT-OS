import { addBackgroundJob, taskQueue, redisConnection } from '../queue-manager';
import { jobProcessors } from '../worker';

// Mock IORedis to prevent actual socket connection attempts in test runs
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue(true),
  }));
});

// Mock BullMQ Queues
jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation((name) => ({
      name,
      add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    })),
    Worker: jest.fn().mockImplementation((name, processor) => ({
      name,
      processor,
      on: jest.fn(),
    })),
  };
});

describe('BullMQ Queue Operations', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await redisConnection.quit();
  });

  it('should call queue.add with correct parameters', async () => {
    const jobName = 'resume:analyze';
    const jobData = { studentId: 'student-uuid', resumeText: 'skills list' };

    const job = await addBackgroundJob(jobName, jobData);
    expect(job).toBeDefined();
    expect(taskQueue.add).toHaveBeenCalledWith(jobName, jobData, { jobId: undefined });
  });

  it('should register correct processors inside jobProcessors', async () => {
    expect(jobProcessors['resume:analyze']).toBeDefined();
    expect(jobProcessors['email:send']).toBeDefined();
    expect(jobProcessors['analytics:update']).toBeDefined();
    expect(jobProcessors['prediction:run']).toBeDefined();

    const result = await jobProcessors['email:send']({ recipient: 'student@vjti.ac.in' });
    expect(result.success).toBe(true);
  });
});
