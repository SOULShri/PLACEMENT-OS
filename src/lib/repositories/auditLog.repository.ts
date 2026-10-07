import { PrismaClient, AuditLog, Prisma } from '@prisma/client';

export interface IAuditLogRepository {
  log(data: {
    tenantId: string;
    actorId: string;
    action: string;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog>;
}

export class AuditLogRepository implements IAuditLogRepository {
  constructor(private prisma: PrismaClient) {}

  async log(data: {
    tenantId: string;
    actorId: string;
    action: string;
    metadata?: Prisma.InputJsonValue;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data,
    });
  }
}
