import { StudentRepository } from '../repositories/student.repository';
import { CompanyRepository } from '../repositories/company.repository';
import { CompanyBattleService } from '../services/company-battle.service';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../prisma';

// 1. Mock the Prisma client globally to run connection-free tests
jest.mock('../prisma', () => {
  return {
    prisma: {
      student: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      company: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
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
      studentSentiment: {
        findMany: jest.fn(),
      },
    },
  };
});

describe('System Integration & Tenant Isolation', () => {
  const mockStudent = {
    id: 'student-id-1',
    tenantId: 'vjti-campus-a',
    studentId: '12345',
    name: 'Jane Doe',
    email: 'jane@vjti.ac.in',
    passwordHash: 'hash',
    cgpa: 9.2,
    branch: 'CS',
    skills: ['React'],
    deletedAt: null,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Test tenant isolation checks
  describe('Tenant Isolation Verification', () => {
    it('should retrieve student record when requesting with matching tenant ID', async () => {
      const studentRepo = new StudentRepository(prisma as unknown as PrismaClient);
      (prisma.student.findFirst as jest.Mock).mockResolvedValue(mockStudent);

      const student = await studentRepo.findById('student-id-1', 'vjti-campus-a');
      expect(student).not.toBeNull();
      expect(student?.tenantId).toBe('vjti-campus-a');
      expect(prisma.student.findFirst).toHaveBeenCalledWith({
        where: { id: 'student-id-1', tenantId: 'vjti-campus-a', deletedAt: null },
      });
    });

    it('should refuse and return null when requesting record with non-matching tenant ID', async () => {
      const studentRepo = new StudentRepository(prisma as unknown as PrismaClient);
      (prisma.student.findFirst as jest.Mock).mockResolvedValue(null);

      const student = await studentRepo.findById('student-id-1', 'vjti-campus-b');
      expect(student).toBeNull();
      expect(prisma.student.findFirst).toHaveBeenCalledWith({
        where: { id: 'student-id-1', tenantId: 'vjti-campus-b', deletedAt: null },
      });
    });
  });

  // Test Company Battle aggregation math
  describe('Company Battle Calculation Logic', () => {
    const mockCompany = {
      id: 'company-id-a',
      tenantId: 'vjti-campus-a',
      name: 'Google',
      industry: 'Tech',
      trustScore: 4.8,
      deletedAt: null,
    };

    const mockJobs = [
      { id: 'job-1', packageLpa: 18.5, minCgpa: 8.5 },
      { id: 'job-2', packageLpa: 24.0, minCgpa: 9.0 },
    ];

    const mockApplications = [
      { id: 'app-1', status: 'SELECTED' },
      { id: 'app-2', status: 'REJECTED' },
      { id: 'app-3', status: 'APPLIED' },
    ];

    const mockVaultItems = [
      { id: 'q-1', topic: 'Trees' },
      { id: 'q-2', topic: 'DP' },
      { id: 'q-3', topic: 'Trees' },
    ];

    const mockSentiments = [
      { id: 's-1', oaDifficulty: 4, interviewDifficulty: 5, overallSentiment: 'positive' },
      { id: 's-2', oaDifficulty: 5, interviewDifficulty: 4, overallSentiment: 'positive' },
    ];

    it('should aggregate comparative statistics correctly', async () => {
      const companyRepo = new CompanyRepository(prisma as unknown as PrismaClient);
      const battleService = new CompanyBattleService(prisma as unknown as PrismaClient, companyRepo);

      (prisma.company.findFirst as jest.Mock).mockResolvedValue(mockCompany);
      (prisma.job.findMany as jest.Mock).mockResolvedValue(mockJobs);
      (prisma.application.findMany as jest.Mock).mockResolvedValue(mockApplications);
      (prisma.interviewVault.findMany as jest.Mock).mockResolvedValue(mockVaultItems);
      (prisma.studentSentiment.findMany as jest.Mock).mockResolvedValue(mockSentiments);

      const stats = await battleService.compareCompanies('company-id-a', 'company-id-b', 'vjti-campus-a');

      expect(stats.companyA).toBeDefined();
      const google = stats.companyA;

      expect(google.name).toBe('Google');
      // Salaries math: min = 18.5, max = 24.0, avg = 21.25
      expect(google.packages.min).toBe(18.5);
      expect(google.packages.max).toBe(24.0);
      expect(google.packages.avg).toBe(21.25);

      // CGPAs math: min = 8.5, max = 9.0, avg = 8.75
      expect(google.cgpaCutoff.min).toBe(8.5);
      expect(google.cgpaCutoff.max).toBe(9.0);
      expect(google.cgpaCutoff.avg).toBe(8.75);

      // Selection rates: 1 out of 3 selected = 0.3333 selection ratio
      expect(google.selectionStats.totalSelections).toBe(1);
      expect(google.selectionStats.ratio).toBe(0.3333);

      // Topic distributions count: Trees = 2, DP = 1
      expect(google.topTopics).toHaveLength(2);
      expect(google.topTopics[0]).toEqual({ topic: 'Trees', count: 2 });
      expect(google.topTopics[1]).toEqual({ topic: 'DP', count: 1 });

      // Sentiments difficulty averages: OA = 4.5, Interview = 4.5
      expect(google.sentiment.avgOaDifficulty).toBe(4.5);
      expect(google.sentiment.avgInterviewDifficulty).toBe(4.5);
      expect(google.sentiment.overallSentiment).toBe('positive');
    });
  });
});
