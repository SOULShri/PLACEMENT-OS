import { Queue, Job } from 'bullmq';
import IORedis from 'ioredis';
import { logger } from '@/lib/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

let host = 'localhost';
let port = 6379;
let password: string | undefined = undefined;

try {
  const parsed = new URL(redisUrl);
  host = parsed.hostname || 'localhost';
  port = parsed.port ? parseInt(parsed.port, 10) : 6379;
  if (parsed.password) {
    password = decodeURIComponent(parsed.password);
  }
} catch {
  // Use fallback values if URL parsing fails
}

// Plain configuration options for BullMQ to avoid ioredis cross-package type conflicts
export const connectionOptions = {
  host,
  port,
  password,
  maxRetriesPerRequest: null,
};

// Instantiated shared client for direct cache lookups
export const redisConnection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});

redisConnection.on('connect', () => {
  logger.info('Connected to Redis for caching');
});

redisConnection.on('error', (error) => {
  logger.error('Redis connection error', error);
});

// Enqueue jobs using configuration options
export const taskQueue = new Queue('placement-tasks', {
  connection: connectionOptions,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000, // Starts at 2s, then 4s, then 8s
    },
    removeOnComplete: true, // Clean up completed jobs
    removeOnFail: false,    // Keep failed jobs to inspect/DLQ
  },
});

export const dlqQueue = new Queue('placement-tasks-dlq', {
  connection: connectionOptions,
});

export async function addBackgroundJob(
  name: string,
  data: Record<string, unknown>,
  jobId?: string
): Promise<Job> {
  logger.info(`Enqueuing background job: ${name}`, { jobId, data });
  return taskQueue.add(name, data, { jobId });
}
