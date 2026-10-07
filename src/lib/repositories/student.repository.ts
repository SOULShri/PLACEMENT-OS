import { PrismaClient, Student, Prisma } from '@prisma/client';

export interface IStudentRepository {
  findById(id: string, tenantId: string): Promise<Student | null>;
  findByEmail(email: string): Promise<Student | null>;
  findByRollNumber(studentId: string, tenantId: string): Promise<Student | null>;
  create(data: Prisma.StudentCreateInput): Promise<Student>;
  update(id: string, tenantId: string, data: Prisma.StudentUpdateInput): Promise<Student>;
  softDelete(id: string, tenantId: string): Promise<Student>;
}

export class StudentRepository implements IStudentRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string, tenantId: string): Promise<Student | null> {
    return this.prisma.student.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
  }

  async findByEmail(email: string): Promise<Student | null> {
    return this.prisma.student.findFirst({
      where: { email, deletedAt: null },
    });
  }

  async findByRollNumber(studentId: string, tenantId: string): Promise<Student | null> {
    return this.prisma.student.findFirst({
      where: { studentId, tenantId, deletedAt: null },
    });
  }

  async create(data: Prisma.StudentCreateInput): Promise<Student> {
    return this.prisma.student.create({
      data,
    });
  }

  async update(id: string, tenantId: string, data: Prisma.StudentUpdateInput): Promise<Student> {
    return this.prisma.student.update({
      where: { id, tenantId },
      data,
    });
  }

  async softDelete(id: string, tenantId: string): Promise<Student> {
    return this.prisma.student.update({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    });
  }
}
