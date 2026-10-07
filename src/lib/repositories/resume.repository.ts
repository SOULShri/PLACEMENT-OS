import { PrismaClient, Resume, Prisma } from '@prisma/client';

export interface IResumeRepository {
  findById(id: string, tenantId: string): Promise<Resume | null>;
  findActiveByStudent(studentId: string, tenantId: string): Promise<Resume | null>;
  findByStudentHistory(studentId: string, tenantId: string): Promise<Resume[]>;
  create(data: Prisma.ResumeCreateInput): Promise<Resume>;
  activateVersion(id: string, studentId: string, tenantId: string): Promise<void>;
  deactivateAll(studentId: string, tenantId: string): Promise<void>;
  softDelete(id: string, tenantId: string): Promise<Resume>;
}

export class ResumeRepository implements IResumeRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string, tenantId: string): Promise<Resume | null> {
    return this.prisma.resume.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
  }

  async findActiveByStudent(studentId: string, tenantId: string): Promise<Resume | null> {
    return this.prisma.resume.findFirst({
      where: { studentId, tenantId, isActive: true, deletedAt: null },
    });
  }

  async findByStudentHistory(studentId: string, tenantId: string): Promise<Resume[]> {
    return this.prisma.resume.findMany({
      where: { studentId, tenantId, deletedAt: null },
      orderBy: { version: 'desc' },
    });
  }

  async create(data: Prisma.ResumeCreateInput): Promise<Resume> {
    return this.prisma.resume.create({
      data,
    });
  }

  async activateVersion(id: string, studentId: string, tenantId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.resume.updateMany({
        where: { studentId, tenantId, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.resume.update({
        where: { id, studentId, tenantId },
        data: { isActive: true },
      }),
    ]);
  }

  async deactivateAll(studentId: string, tenantId: string): Promise<void> {
    await this.prisma.resume.updateMany({
      where: { studentId, tenantId, isActive: true },
      data: { isActive: false },
    });
  }

  async softDelete(id: string, tenantId: string): Promise<Resume> {
    return this.prisma.resume.update({
      where: { id, tenantId },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
