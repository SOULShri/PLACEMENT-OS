import { cacheManager } from '../cache';
import { redisConnection } from '../queues/queue-manager';

// Mock Redis connection
jest.mock('ioredis', () => {
  const store: Record<string, string> = {};
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockImplementation(async (key) => store[key] || null),
    setex: jest.fn().mockImplementation(async (key, ttl, val) => {
      store[key] = val;
    }),
    del: jest.fn().mockImplementation(async (...keys) => {
      keys.forEach((k) => delete store[k]);
      return keys.length;
    }),
    scan: jest.fn().mockResolvedValue(['0', []]),
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

describe('Cache Manager Operations', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await redisConnection.quit();
  });

  it('should get and set cache values correctly', async () => {
    const key = 'test:key';
    const val = { branch: 'CS', placed: 85 };

    await cacheManager.set(key, val);
    const cachedVal = await cacheManager.get(key);

    expect(redisConnection.setex).toHaveBeenCalled();
    expect(redisConnection.get).toHaveBeenCalledWith(key);
    expect(cachedVal).toEqual(val);
  });

  it('should delete keys from cache', async () => {
    const key = 'test:delete-key';
    await cacheManager.set(key, 'data');
    await cacheManager.delete(key);

    const val = await cacheManager.get(key);
    expect(redisConnection.del).toHaveBeenCalledWith(key);
    expect(val).toBeNull();
  });
});
