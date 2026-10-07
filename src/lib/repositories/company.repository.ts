import { PrismaClient, Company, Prisma } from '@prisma/client';

export interface ICompanyRepository {
  findById(id: string, tenantId: string): Promise<Company | null>;
  findByName(name: string, tenantId: string): Promise<Company | null>;
  create(data: Prisma.CompanyCreateInput): Promise<Company>;
  update(id: string, tenantId: string, data: Prisma.CompanyUpdateInput): Promise<Company>;
  softDelete(id: string, tenantId: string): Promise<Company>;
  findAll(tenantId: string, skip?: number, take?: number): Promise<Company[]>;
  countAll(tenantId: string): Promise<number>;
}

export class CompanyRepository implements ICompanyRepository {
  constructor(private prisma: PrismaClient) {}

  async findById(id: string, tenantId: string): Promise<Company | null> {
    return this.prisma.company.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
  }

  async findByName(name: string, tenantId: string): Promise<Company | null> {
    return this.prisma.company.findFirst({
      where: { name, tenantId, deletedAt: null },
    });
  }

  async create(data: Prisma.CompanyCreateInput): Promise<Company> {
    return this.prisma.company.create({
      data,
    });
  }

  async update(id: string, tenantId: string, data: Prisma.CompanyUpdateInput): Promise<Company> {
    return this.prisma.company.update({
      where: { id, tenantId },
      data,
    });
  }

  async softDelete(id: string, tenantId: string): Promise<Company> {
    return this.prisma.company.update({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    });
  }

  async countAll(tenantId: string): Promise<number> {
    return this.prisma.company.count({
      where: { tenantId, deletedAt: null },
    });
  }

  async findAll(tenantId: string, skip?: number, take?: number): Promise<Company[]> {
    return this.prisma.company.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { name: 'asc' },
      skip,
      take,
    });
  }
}
