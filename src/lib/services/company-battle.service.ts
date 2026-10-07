import { PrismaClient } from '@prisma/client';
import { ICompanyRepository } from '../repositories/company.repository';

export interface CompanyBattleStats {
  id: string;
  name: string;
  industry: string | null;
  trustScore: number;
  jobsCount: number;
  packages: {
    min: number;
    max: number;
    avg: number;
  };
  cgpaCutoff: {
    min: number;
    max: number;
    avg: number;
  };
  selectionStats: {
    totalApplications: number;
    totalSelections: number;
    ratio: number;
  };
  topTopics: { topic: string; count: number }[];
  sentiment: {
    avgOaDifficulty: number;
    avgInterviewDifficulty: number;
    overallSentiment: string;
  };
}

export interface CompanyBattleResult {
  companyA: CompanyBattleStats;
  companyB: CompanyBattleStats;
}

export class CompanyBattleService {
  constructor(
    private prisma: PrismaClient,
    private companyRepository: ICompanyRepository
  ) {}

  async compareCompanies(
    companyIdA: string,
    companyIdB: string,
    tenantId: string
  ): Promise<CompanyBattleResult> {
    const [statsA, statsB] = await Promise.all([
      this.getCompanyStats(companyIdA, tenantId),
      this.getCompanyStats(companyIdB, tenantId),
    ]);

    return {
      companyA: statsA,
      companyB: statsB,
    };
  }

  private async getCompanyStats(companyId: string, tenantId: string): Promise<CompanyBattleStats> {
    const company = await this.companyRepository.findById(companyId, tenantId);
    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    // 1. Fetch package and CGPA cutoffs from Job table
    const jobs = await this.prisma.job.findMany({
      where: { companyId, tenantId, deletedAt: null },
    });

    const jobsCount = jobs.length;
    let minPackage = 0, maxPackage = 0, avgPackage = 0;
    let minCgpa = 0, maxCgpa = 0, avgCgpa = 0;

    if (jobsCount > 0) {
      const packages = jobs.map((j) => j.packageLpa);
      const cgpas = jobs.map((j) => j.minCgpa);

      minPackage = Math.min(...packages);
      maxPackage = Math.max(...packages);
      avgPackage = packages.reduce((acc, p) => acc + p, 0) / jobsCount;

      minCgpa = Math.min(...cgpas);
      maxCgpa = Math.max(...cgpas);
      avgCgpa = cgpas.reduce((acc, c) => acc + c, 0) / jobsCount;
    }

    // 2. Fetch selection stats from Application table
    const applications = await this.prisma.application.findMany({
      where: {
        job: { companyId },
        tenantId,
        deletedAt: null,
      },
    });

    const totalApplications = applications.length;
    const totalSelections = applications.filter((app) => app.status === 'SELECTED').length;
    const ratio = totalApplications > 0 ? totalSelections / totalApplications : 0;

    // 3. Fetch top topics from InterviewVault (Knowledge Graph)
    const vaultItems = await this.prisma.interviewVault.findMany({
      where: { companyId, tenantId, deletedAt: null },
      select: { topic: true },
    });

    const topicCounts: Record<string, number> = {};
    vaultItems.forEach((item) => {
      topicCounts[item.topic] = (topicCounts[item.topic] || 0) + 1;
    });

    const topTopics = Object.entries(topicCounts)
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3); // top 3 topics

    // 4. Fetch anonymous sentiment stats
    const sentiments = await this.prisma.studentSentiment.findMany({
      where: { companyId, tenantId, deletedAt: null },
    });

    const sentimentCount = sentiments.length;
    let avgOaDifficulty = 0;
    let avgInterviewDifficulty = 0;
    let overallSentiment = 'neutral';

    if (sentimentCount > 0) {
      avgOaDifficulty = sentiments.reduce((acc, s) => acc + s.oaDifficulty, 0) / sentimentCount;
      avgInterviewDifficulty = sentiments.reduce((acc, s) => acc + s.interviewDifficulty, 0) / sentimentCount;

      const positiveCount = sentiments.filter((s) => s.overallSentiment === 'positive').length;
      const negativeCount = sentiments.filter((s) => s.overallSentiment === 'negative').length;

      if (positiveCount > negativeCount) {
        overallSentiment = 'positive';
      } else if (negativeCount > positiveCount) {
        overallSentiment = 'negative';
      }
    }

    return {
      id: company.id,
      name: company.name,
      industry: company.industry,
      trustScore: company.trustScore,
      jobsCount,
      packages: {
        min: Number(minPackage.toFixed(2)),
        max: Number(maxPackage.toFixed(2)),
        avg: Number(avgPackage.toFixed(2)),
      },
      cgpaCutoff: {
        min: Number(minCgpa.toFixed(2)),
        max: Number(maxCgpa.toFixed(2)),
        avg: Number(avgCgpa.toFixed(2)),
      },
      selectionStats: {
        totalApplications,
        totalSelections,
        ratio: Number(ratio.toFixed(4)),
      },
      topTopics,
      sentiment: {
        avgOaDifficulty: Number(avgOaDifficulty.toFixed(2)),
        avgInterviewDifficulty: Number(avgInterviewDifficulty.toFixed(2)),
        overallSentiment,
      },
    };
  }
}
