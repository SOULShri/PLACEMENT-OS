import { PrismaClient, Company, Job, InterviewVault, Prisma } from '@prisma/client';

export interface CompanyAnalyticsStats {
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  trustScore: number;
  visitCount: number;
  jobsCount: number;
  packages: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };
  selectionStats: {
    totalApplications: number;
    totalSelections: number;
    ratio: number;
  };
  cgpaDistribution: {
    under8: number;
    between8and85: number;
    between85and9: number;
    above9: number;
  };
  branchDistribution: Record<string, number>;
  jobTypeSplit: {
    fte: number;
    internship: number;
  };
}

export interface HiringTrend {
  year: number;
  hires: number;
  avgPackage: number;
}

export interface CompanyPackageLeader {
  id: string;
  name: string;
  avgPackage: number;
  maxPackage: number;
}

export interface SkillTrend {
  skill: string;
  frequency: number;
  trend: 'Increasing' | 'Stable' | 'Declining';
}

export interface InterviewTopicStats {
  topic: string;
  count: number;
  category: 'DSA' | 'OS' | 'DBMS' | 'HR' | 'System Design' | 'Other';
}

export interface HeatmapRow {
  companyId: string;
  companyName: string;
  CS: number;
  IT: number;
  EXTC: number;
  MECH: number;
  Civil: number;
  Electronics: number;
}

export interface GlobalSearchResults {
  companies: Company[];
  jobs: Job[];
  students: { id: string; name: string; email: string; branch: string; cgpa: number }[];
  questions: InterviewVault[];
  resumes: { id: string; filename: string; version: number; skills: string[] }[];
}

export class AnalyticsService {
  constructor(private prisma: PrismaClient) {}

  async getCompanyStats(companyId: string, tenantId: string): Promise<CompanyAnalyticsStats> {
    // 1. Increment visit count and fetch company details
    const company = await this.prisma.company.update({
      where: { id: companyId, tenantId },
      data: { visitCount: { increment: 1 } },
    });

    if (!company) {
      throw new Error(`Company not found: ${companyId}`);
    }

    // 2. Fetch jobs
    const jobs = await this.prisma.job.findMany({
      where: { companyId, tenantId, deletedAt: null },
    });

    const jobsCount = jobs.length;
    let minPackage = 0, maxPackage = 0, avgPackage = 0, medianPackage = 0;

    if (jobsCount > 0) {
      const packages = jobs.map((j) => j.packageLpa).sort((a, b) => a - b);
      minPackage = packages[0];
      maxPackage = packages[packages.length - 1];
      avgPackage = packages.reduce((acc, p) => acc + p, 0) / jobsCount;

      const mid = Math.floor(packages.length / 2);
      medianPackage = packages.length % 2 !== 0 ? packages[mid] : (packages[mid - 1] + packages[mid]) / 2;
    }

    // 3. Fetch applications for selections and distributions
    const applications = await this.prisma.application.findMany({
      where: {
        job: { companyId },
        tenantId,
        deletedAt: null,
      },
      include: {
        student: true,
        job: true,
      },
    });

    const totalApplications = applications.length;
    const selectedApps = applications.filter((app) => app.status === 'SELECTED');
    const totalSelections = selectedApps.length;
    const ratio = totalApplications > 0 ? totalSelections / totalApplications : 0;

    // 4. CGPA distribution of selected students
    let under8 = 0, between8and85 = 0, between85and9 = 0, above9 = 0;
    selectedApps.forEach((app) => {
      const cgpa = app.student.cgpa;
      if (cgpa < 8.0) under8++;
      else if (cgpa < 8.5) between8and85++;
      else if (cgpa < 9.0) between85and9++;
      else above9++;
    });

    // 5. Branch distribution of selected students
    const branchDistribution: Record<string, number> = {
      CS: 0, IT: 0, EXTC: 0, MECH: 0, Civil: 0, Electronics: 0,
    };
    selectedApps.forEach((app) => {
      const b = app.student.branch.toUpperCase();
      if (b in branchDistribution) {
        branchDistribution[b]++;
      } else {
        // Fallback for other branch inputs
        branchDistribution[b] = 1;
      }
    });

    // 6. Job Type Split (FTE vs Internship) of selected applications
    let fte = 0, internship = 0;
    selectedApps.forEach((app) => {
      if (app.job.type === 'INTERNSHIP') {
        internship++;
      } else {
        fte++;
      }
    });

    return {
      id: company.id,
      name: company.name,
      industry: company.industry,
      description: company.description,
      trustScore: company.trustScore,
      visitCount: company.visitCount,
      jobsCount,
      packages: {
        min: Number(minPackage.toFixed(2)),
        max: Number(maxPackage.toFixed(2)),
        avg: Number(avgPackage.toFixed(2)),
        median: Number(medianPackage.toFixed(2)),
      },
      selectionStats: {
        totalApplications,
        totalSelections,
        ratio: Number(ratio.toFixed(4)),
      },
      cgpaDistribution: {
        under8,
        between8and85,
        between85and9,
        above9,
      },
      branchDistribution,
      jobTypeSplit: {
        fte,
        internship,
      },
    };
  }

  async getCompanyTrends(tenantId: string): Promise<HiringTrend[]> {
    const selections = await this.prisma.application.findMany({
      where: { tenantId, status: 'SELECTED', deletedAt: null },
      include: { job: true },
    });

    const yearlyData: Record<number, { count: number; totalPackage: number }> = {};

    selections.forEach((sel) => {
      if (sel.status !== 'SELECTED') return;
      const year = new Date(sel.createdAt).getFullYear();
      if (!yearlyData[year]) {
        yearlyData[year] = { count: 0, totalPackage: 0 };
      }
      yearlyData[year].count++;
      yearlyData[year].totalPackage += sel.job.packageLpa;
    });

    // Fill defaults (2022 to 2025) if missing
    for (let y = 2022; y <= 2026; y++) {
      if (!yearlyData[y]) {
        yearlyData[y] = { count: 0, totalPackage: 0 };
      }
    }

    return Object.entries(yearlyData)
      .map(([yearStr, data]) => ({
        year: Number(yearStr),
        hires: data.count,
        avgPackage: data.count > 0 ? Number((data.totalPackage / data.count).toFixed(2)) : 0,
      }))
      .sort((a, b) => a.year - b.year);
  }

  async getCompanyPackages(tenantId: string): Promise<CompanyPackageLeader[]> {
    const companies = await this.prisma.company.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        jobs: {
          where: { deletedAt: null },
        },
      },
    });

    const leaders = companies.map((c) => {
      const packages = c.jobs.map((j) => j.packageLpa);
      const maxPackage = packages.length > 0 ? Math.max(...packages) : 0;
      const avgPackage = packages.length > 0 ? packages.reduce((acc, p) => acc + p, 0) / packages.length : 0;

      return {
        id: c.id,
        name: c.name,
        avgPackage: Number(avgPackage.toFixed(2)),
        maxPackage: Number(maxPackage.toFixed(2)),
      };
    });

    return leaders.sort((a, b) => b.maxPackage - a.maxPackage);
  }

  async getSkillDemandTrends(tenantId: string): Promise<SkillTrend[]> {
    const jobs = await this.prisma.job.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    const targetSkills = ['React', 'Node', 'Java', 'Python', 'SQL', 'Docker', 'AWS'];
    const midPoint = Math.floor(jobs.length / 2);
    const olderJobs = jobs.slice(0, midPoint);
    const newerJobs = jobs.slice(midPoint);

    return targetSkills.map((skill) => {
      const lowerSkill = skill.toLowerCase();
      
      const countInJobs = (jobList: Job[]) => 
        jobList.filter((j) => j.requiredSkills.some((s) => s.toLowerCase() === lowerSkill)).length;

      const oldFrequency = countInJobs(olderJobs);
      const newFrequency = countInJobs(newerJobs);
      const totalFrequency = oldFrequency + newFrequency;

      let trend: 'Increasing' | 'Stable' | 'Declining' = 'Stable';
      if (newFrequency > oldFrequency) {
        trend = 'Increasing';
      } else if (newFrequency < oldFrequency) {
        trend = 'Declining';
      }

      return {
        skill,
        frequency: totalFrequency,
        trend,
      };
    });
  }

  async getInterviewAnalytics(companyId: string | null, tenantId: string): Promise<InterviewTopicStats[]> {
    const filter: Prisma.InterviewVaultWhereInput = { tenantId, deletedAt: null };
    if (companyId) {
      filter.companyId = companyId;
    }

    const vaultItems = await this.prisma.interviewVault.findMany({
      where: filter,
    });

    const topicCounts: Record<string, number> = {};
    vaultItems.forEach((item) => {
      const topic = item.topic.trim();
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    });

    const dsaKeywords = ['tree', 'graph', 'dp', 'dynamic programming', 'recursion', 'sorting', 'array', 'string', 'binary search', 'linked list'];
    const osKeywords = ['os', 'threads', 'process', 'virtual memory', 'semaphore', 'deadlock', 'scheduling'];
    const dbmsKeywords = ['dbms', 'sql', 'indexing', 'transaction', 'acid', 'nosql', 'query'];
    const systemKeywords = ['system design', 'load balancer', 'scaling', 'caching', 'sharding', 'microservices'];
    const hrKeywords = ['hr', 'behavioral', 'introduce', 'conflict', 'career', 'motivation'];

    const getCategory = (topic: string): 'DSA' | 'OS' | 'DBMS' | 'HR' | 'System Design' | 'Other' => {
      const t = topic.toLowerCase();
      if (dsaKeywords.some((k) => t.includes(k))) return 'DSA';
      if (osKeywords.some((k) => t.includes(k))) return 'OS';
      if (dbmsKeywords.some((k) => t.includes(k))) return 'DBMS';
      if (systemKeywords.some((k) => t.includes(k))) return 'System Design';
      if (hrKeywords.some((k) => t.includes(k))) return 'HR';
      return 'Other';
    };

    return Object.entries(topicCounts)
      .map(([topic, count]) => ({
        topic,
        count,
        category: getCategory(topic),
      }))
      .sort((a, b) => b.count - a.count);
  }

  async getPlacementHeatmap(tenantId: string): Promise<HeatmapRow[]> {
    const companies = await this.prisma.company.findMany({
      where: { tenantId, deletedAt: null },
    });

    const selections = await this.prisma.application.findMany({
      where: { tenantId, status: 'SELECTED', deletedAt: null },
      include: {
        student: true,
        job: true,
      },
    });

    return companies.map((c) => {
      const compSelections = selections.filter((sel) => sel.job.companyId === c.id && sel.status === 'SELECTED');
      
      const countForBranch = (branch: string) =>
        compSelections.filter((sel) => sel.student.branch.toUpperCase() === branch).length;

      return {
        companyId: c.id,
        companyName: c.name,
        CS: countForBranch('CS'),
        IT: countForBranch('IT'),
        EXTC: countForBranch('EXTC'),
        MECH: countForBranch('MECH'),
        Civil: countForBranch('CIVIL'),
        Electronics: countForBranch('ELECTRONICS'),
      };
    });
  }

  async getGlobalSearch(query: string, tenantId: string): Promise<GlobalSearchResults> {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) {
      return { companies: [], jobs: [], students: [], questions: [], resumes: [] };
    }

    // 1. Search companies
    const companies = await this.prisma.company.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { name: { contains: cleanQuery, mode: 'insensitive' } },
          { industry: { contains: cleanQuery, mode: 'insensitive' } },
        ],
      },
      take: 5,
    });

    // 2. Search jobs
    const jobs = await this.prisma.job.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { title: { contains: cleanQuery, mode: 'insensitive' } },
          { requiredSkills: { has: cleanQuery } },
        ],
      },
      include: { company: true },
      take: 5,
    });

    // 3. Search students
    const studentsRaw = await this.prisma.student.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { name: { contains: cleanQuery, mode: 'insensitive' } },
          { email: { contains: cleanQuery, mode: 'insensitive' } },
          { branch: { contains: cleanQuery, mode: 'insensitive' } },
        ],
      },
      take: 5,
    });

    const students = studentsRaw.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      branch: s.branch,
      cgpa: s.cgpa,
    }));

    // 4. Search interview questions
    const questions = await this.prisma.interviewVault.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { question: { contains: cleanQuery, mode: 'insensitive' } },
          { topic: { contains: cleanQuery, mode: 'insensitive' } },
          { roleName: { contains: cleanQuery, mode: 'insensitive' } },
        ],
      },
      include: { company: true },
      take: 5,
    });

    // 5. Search resume versions metadata
    const resumesRaw = await this.prisma.resume.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { filename: { contains: cleanQuery, mode: 'insensitive' } },
          { skills: { has: cleanQuery } },
        ],
      },
      take: 5,
    });

    const resumes = resumesRaw.map((r) => ({
      id: r.id,
      filename: r.filename,
      version: r.version,
      skills: r.skills,
    }));

    return {
      companies,
      jobs,
      students,
      questions,
      resumes,
    };
  }
}
