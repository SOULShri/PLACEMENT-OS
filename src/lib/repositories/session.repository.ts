import { PrismaClient, Session, Prisma } from '@prisma/client';

export interface ISessionRepository {
  createSession(data: {
    tenantId: string;
    userId: string;
    userAgent: string;
    ipAddress: string;
    refreshToken: string;
    expiresAt: Date;
  }): Promise<Session>;
  findByRefreshToken(refreshToken: string): Promise<Session | null>;
  invalidateAllForUser(userId: string): Promise<Prisma.BatchPayload>;
  deleteSession(id: string): Promise<Session>;
}

export class SessionRepository implements ISessionRepository {
  constructor(private prisma: PrismaClient) {}

  async createSession(data: {
    tenantId: string;
    userId: string;
    userAgent: string;
    ipAddress: string;
    refreshToken: string;
    expiresAt: Date;
  }): Promise<Session> {
    return this.prisma.session.create({
      data: {
        ...data,
        deletedAt: null,
      },
    });
  }

  async findByRefreshToken(refreshToken: string): Promise<Session | null> {
    return this.prisma.session.findFirst({
      where: { refreshToken, deletedAt: null },
    });
  }

  async invalidateAllForUser(userId: string): Promise<Prisma.BatchPayload> {
    return this.prisma.session.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  async deleteSession(id: string): Promise<Session> {
    return this.prisma.session.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
