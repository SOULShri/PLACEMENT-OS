import { AnalyticsService } from '../services/analytics.service';
import { PlacementEventRepository } from '../repositories/placement-event.repository';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../prisma';

// Mock the Prisma client globally to execute connectionless tests
jest.mock('../prisma', () => {
  return {
    prisma: {
      company: {
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      job: {
        findMany: jest.fn(),
      },
      application: {
        findMany: jest.fn(),
      },
      interviewVault: {
        findMany: jest.fn(),
      },
      student: {
        findMany: jest.fn(),
      },
      resume: {
        findMany: jest.fn(),
      },
      placementEvent: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
      },
    },
  };
});

describe('Company Intelligence & Analytics Services', () => {
  const tenantId = 'tenant-vjti-core';
  const companyId = 'comp-google-id';

  const mockCompany = {
    id: companyId,
    tenantId,
    name: 'Google India',
    industry: 'Technology',
    description: 'Enterprise Search Recruiter',
    trustScore: 4.9,
    visitCount: 120,
  };

  const mockJobs = [
    { id: 'job-1', companyId, packageLpa: 32.5, minCgpa: 8.5, type: 'FTE', requiredSkills: ['React', 'Node'] },
    { id: 'job-2', companyId, packageLpa: 14.5, minCgpa: 8.0, type: 'INTERNSHIP', requiredSkills: ['SQL', 'React'] },
    { id: 'job-3', companyId, packageLpa: 22.0, minCgpa: 8.2, type: 'FTE', requiredSkills: ['Node', 'SQL'] },
  ];

  const mockApplications = [
    { 
      id: 'app-1', 
      status: 'SELECTED', 
      tenantId, 
      createdAt: new Date('2025-02-15'),
      job: { companyId, packageLpa: 32.5, type: 'FTE' },
      student: { cgpa: 9.2, branch: 'CS' },
    },
    { 
      id: 'app-2', 
      status: 'SELECTED', 
      tenantId, 
      createdAt: new Date('2025-03-20'),
      job: { companyId, packageLpa: 14.5, type: 'INTERNSHIP' },
      student: { cgpa: 8.7, branch: 'IT' },
    },
    { 
      id: 'app-3', 
      status: 'REJECTED', 
      tenantId, 
      createdAt: new Date('2025-04-10'),
      job: { companyId, packageLpa: 22.0, type: 'FTE' },
      student: { cgpa: 7.9, branch: 'MECH' },
    },
  ];

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Analytics Calculations Engine', () => {
    it('should compute company stats with correct median and ratios', async () => {
      (prisma.company.update as jest.Mock).mockResolvedValue({
        ...mockCompany,
        visitCount: mockCompany.visitCount + 1,
      });
      (prisma.job.findMany as jest.Mock).mockResolvedValue(mockJobs);
      (prisma.application.findMany as jest.Mock).mockResolvedValue(mockApplications);

      const service = new AnalyticsService(prisma as unknown as PrismaClient);
      const res = await service.getCompanyStats(companyId, tenantId);

      expect(res.name).toBe('Google India');
      expect(res.visitCount).toBe(121);
      expect(res.jobsCount).toBe(3);
      expect(res.packages.min).toBe(14.5);
      expect(res.packages.max).toBe(32.5);
      expect(res.packages.avg).toBe(23.0); // (32.5 + 14.5 + 22.0) / 3 = 23.0
      expect(res.packages.median).toBe(22.0); // Sorted: [14.5, 22.0, 32.5]
      
      expect(res.selectionStats.totalApplications).toBe(3);
      expect(res.selectionStats.totalSelections).toBe(2);
      expect(res.selectionStats.ratio).toBe(0.6667); // 2 / 3

      expect(res.cgpaDistribution.above9).toBe(1); // 9.2
      expect(res.cgpaDistribution.between85and9).toBe(1); // 8.7
      expect(res.cgpaDistribution.under8).toBe(0); // SELECTED only (app-3 rejected)

      expect(res.branchDistribution.CS).toBe(1);
      expect(res.branchDistribution.IT).toBe(1);
      expect(res.branchDistribution.MECH).toBe(0); // Rejected
    });

    it('should compute yearly hiring and salary growth trends', async () => {
      (prisma.application.findMany as jest.Mock).mockResolvedValue(mockApplications);

      const service = new AnalyticsService(prisma as unknown as PrismaClient);
      const trends = await service.getCompanyTrends(tenantId);

      // Check groupings by year (all mock selections are from 2025)
      const trend2025 = trends.find((t) => t.year === 2025);
      expect(trend2025).toBeDefined();
      expect(trend2025?.hires).toBe(2);
      expect(trend2025?.avgPackage).toBe(23.5); // (32.5 + 14.5) / 2
    });

    it('should compute skill frequencies and demand indicators', async () => {
      (prisma.job.findMany as jest.Mock).mockResolvedValue(mockJobs);

      const service = new AnalyticsService(prisma as unknown as PrismaClient);
      const skillTrends = await service.getSkillDemandTrends(tenantId);

      const react = skillTrends.find((s) => s.skill === 'React');
      expect(react).toBeDefined();
      expect(react?.frequency).toBe(2); // job-1 and job-2
    });

    it('should compute selection densities in Placement Heatmap', async () => {
      (prisma.company.findMany as jest.Mock).mockResolvedValue([mockCompany]);
      (prisma.application.findMany as jest.Mock).mockResolvedValue(mockApplications);

      const service = new AnalyticsService(prisma as unknown as PrismaClient);
      const rows = await service.getPlacementHeatmap(tenantId);

      expect(rows.length).toBe(1);
      expect(rows[0].companyName).toBe('Google India');
      expect(rows[0].CS).toBe(1);
      expect(rows[0].IT).toBe(1);
      expect(rows[0].Civil).toBe(0);
    });
  });

  describe('Unified Global Search API', () => {
    it('should query multiple tables concurrently and filter by tenant', async () => {
      (prisma.company.findMany as jest.Mock).mockResolvedValue([mockCompany]);
      (prisma.job.findMany as jest.Mock).mockResolvedValue(mockJobs);
      (prisma.student.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.interviewVault.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.resume.findMany as jest.Mock).mockResolvedValue([]);

      const service = new AnalyticsService(prisma as unknown as PrismaClient);
      const results = await service.getGlobalSearch('Google', tenantId);

      expect(results.companies).toHaveLength(1);
      expect(results.companies[0].name).toBe('Google India');
      expect(prisma.company.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId,
          }),
        })
      );
    });
  });

  describe('PlacementEventRepository Drive Scheduling', () => {
    const mockEvent = {
      id: 'event-uuid-1',
      tenantId,
      title: 'Google OA Round',
      type: 'OA',
      date: new Date('2026-09-10'),
    };

    it('should execute isolated event list retrieval', async () => {
      (prisma.placementEvent.findMany as jest.Mock).mockResolvedValue([mockEvent]);
      const repo = new PlacementEventRepository(prisma as unknown as PrismaClient);

      const events = await repo.findAll(tenantId);
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('Google OA Round');
      expect(prisma.placementEvent.findMany).toHaveBeenCalledWith({
        where: { tenantId },
        orderBy: { date: 'asc' },
        include: { company: { select: { name: true } } },
      });
    });

    it('should record scheduling events under tenant scope', async () => {
      (prisma.placementEvent.create as jest.Mock).mockResolvedValue(mockEvent);
      const repo = new PlacementEventRepository(prisma as unknown as PrismaClient);

      const payload = {
        tenantId,
        title: 'Google OA Round',
        type: 'OA',
        date: new Date('2026-09-10'),
      };

      const event = await repo.create(payload);
      expect(event).toBeDefined();
      expect(prisma.placementEvent.create).toHaveBeenCalledWith({
        data: payload,
      });
    });
  });
});
