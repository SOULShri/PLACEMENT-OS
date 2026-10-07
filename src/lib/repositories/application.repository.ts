import { PrismaClient, Application, Prisma, ApplicationStatus } from '@prisma/client';

export interface IApplicationRepository {
  findById(id: string, tenantId: string): Promise<Application | null>;
  create(data: Prisma.ApplicationCreateInput): Promise<Application>;
  updateStatus(id: string, tenantId: string, status: ApplicationStatus, timelineHistory: Prisma.InputJsonValue): Promise<Application>;
  softDelete(id: string, tenantId: string): Promise<Application>;
  findByStudent(studentId: string, tenantId: string, skip?: number, take?: number): Promise<Application[]>;
  countByStudent(studentId: string, tenantId: string): Promise<number>;
  findByJob(jobId: string, tenantId: string, skip?: number, take?: number): Promise<Application[]>;
  countByJob(jobId: string, tenantId: string): Promise<number>;
}

export class ApplicationRepository implements IApplicationRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string, tenantId: string): Promise<Application | null> {
    return this.prisma.application.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { student: true, job: { include: { company: true } } },
    });
  }

  async create(data: Prisma.ApplicationCreateInput): Promise<Application> {
    return this.prisma.application.create({
      data,
    });
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: ApplicationStatus,
    timelineHistory: Prisma.InputJsonValue
  ): Promise<Application> {
    return this.prisma.application.update({
      where: { id, tenantId },
      data: {
        status,
        timelineHistory,
      },
    });
  }

  async softDelete(id: string, tenantId: string): Promise<Application> {
    return this.prisma.application.update({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    });
  }

  async countByStudent(studentId: string, tenantId: string): Promise<number> {
    return this.prisma.application.count({
      where: { studentId, tenantId, deletedAt: null },
    });
  }

  async findByStudent(studentId: string, tenantId: string, skip?: number, take?: number): Promise<Application[]> {
    return this.prisma.application.findMany({
      where: { studentId, tenantId, deletedAt: null },
      include: { job: { include: { company: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async countByJob(jobId: string, tenantId: string): Promise<number> {
    return this.prisma.application.count({
      where: { jobId, tenantId, deletedAt: null },
    });
  }

  async findByJob(jobId: string, tenantId: string, skip?: number, take?: number): Promise<Application[]> {
    return this.prisma.application.findMany({
      where: { jobId, tenantId, deletedAt: null },
      include: { student: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }
}
