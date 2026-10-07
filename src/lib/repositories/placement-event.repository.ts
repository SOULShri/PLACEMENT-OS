import { PrismaClient, PlacementEvent, Prisma } from '@prisma/client';

export interface IPlacementEventRepository {
  findById(id: string, tenantId: string): Promise<PlacementEvent | null>;
  create(data: Prisma.PlacementEventUncheckedCreateInput): Promise<PlacementEvent>;
  findAll(tenantId: string): Promise<PlacementEvent[]>;
  delete(id: string, tenantId: string): Promise<PlacementEvent>;
}

export class PlacementEventRepository implements IPlacementEventRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string, tenantId: string): Promise<PlacementEvent | null> {
    return this.prisma.placementEvent.findFirst({
      where: { id, tenantId },
    });
  }

  async create(data: Prisma.PlacementEventUncheckedCreateInput): Promise<PlacementEvent> {
    return this.prisma.placementEvent.create({
      data,
    });
  }

  async findAll(tenantId: string): Promise<PlacementEvent[]> {
    return this.prisma.placementEvent.findMany({
      where: { tenantId },
      orderBy: { date: 'asc' },
      include: {
        company: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  async delete(id: string, tenantId: string): Promise<PlacementEvent> {
    return this.prisma.placementEvent.delete({
      where: { id, tenantId },
    });
  }
}
