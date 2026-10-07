import { PrismaClient, Job, Prisma } from '@prisma/client';

export type JobWithCompany = Prisma.JobGetPayload<{ include: { company: true } }>;

export interface IJobRepository {
  findById(id: string, tenantId: string): Promise<JobWithCompany | null>;
  create(data: Prisma.JobCreateInput): Promise<Job>;
  update(id: string, tenantId: string, data: Prisma.JobUpdateInput): Promise<Job>;
  softDelete(id: string, tenantId: string): Promise<Job>;
  findAll(tenantId: string, skip?: number, take?: number): Promise<JobWithCompany[]>;
  countAll(tenantId: string): Promise<number>;
  findByCompany(companyId: string, tenantId: string): Promise<JobWithCompany[]>;
}

export class JobRepository implements IJobRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string, tenantId: string): Promise<JobWithCompany | null> {
    return this.prisma.job.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { company: true },
    }) as Promise<JobWithCompany | null>;
  }

  async create(data: Prisma.JobCreateInput): Promise<Job> {
    return this.prisma.job.create({
      data,
    });
  }

  async update(id: string, tenantId: string, data: Prisma.JobUpdateInput): Promise<Job> {
    return this.prisma.job.update({
      where: { id, tenantId },
      data,
    });
  }

  async softDelete(id: string, tenantId: string): Promise<Job> {
    return this.prisma.job.update({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    });
  }

  async countAll(tenantId: string): Promise<number> {
    return this.prisma.job.count({
      where: { tenantId, deletedAt: null },
    });
  }

  async findAll(tenantId: string, skip?: number, take?: number): Promise<JobWithCompany[]> {
    return this.prisma.job.findMany({
      where: { tenantId, deletedAt: null },
      include: { company: true },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }) as Promise<JobWithCompany[]>;
  }

  async findByCompany(companyId: string, tenantId: string): Promise<JobWithCompany[]> {
    return this.prisma.job.findMany({
      where: { companyId, tenantId, deletedAt: null },
      include: { company: true },
    }) as Promise<JobWithCompany[]>;
  }
}
