import { PrismaClient, Prisma } from '@prisma/client';

export class AIResultRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: {
    tenantId: string;
    studentId: string;
    jobId: string;
    type: string;
    payload?: Prisma.InputJsonValue;
  }) {
    return this.prisma.aIResult.create({
      data: {
        tenantId: data.tenantId,
        studentId: data.studentId,
        jobId: data.jobId,
        type: data.type,
        status: 'PENDING',
        payload: data.payload ?? Prisma.JsonNull,
      },
    });
  }

  async findByJobId(jobId: string, tenantId: string) {
    return this.prisma.aIResult.findFirst({
      where: { jobId, tenantId },
    });
  }

  async updateResult(
    jobId: string,
    status: 'DONE' | 'FAILED',
    result: Prisma.InputJsonValue
  ) {
    return this.prisma.aIResult.update({
      where: { jobId },
      data: { status, result },
    });
  }

  async findByStudent(studentId: string, tenantId: string, type?: string) {
    return this.prisma.aIResult.findMany({
      where: {
        studentId,
        tenantId,
        ...(type ? { type } : {}),
        status: 'DONE',
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }
}
