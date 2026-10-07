import { prisma } from './prisma';
import { StudentRepository } from './repositories/student.repository';
import { SessionRepository } from './repositories/session.repository';
import { AuditLogRepository } from './repositories/auditLog.repository';
import { CompanyRepository } from './repositories/company.repository';
import { JobRepository } from './repositories/job.repository';
import { ApplicationRepository } from './repositories/application.repository';
import { ResumeRepository } from './repositories/resume.repository';
import { PlacementEventRepository } from './repositories/placement-event.repository';
import { AIResultRepository } from './repositories/ai-result.repository';
import { CompanyBattleService } from './services/company-battle.service';
import { AnalyticsService } from './services/analytics.service';

// Instantiate concrete implementations
const studentRepository = new StudentRepository(prisma);
const sessionRepository = new SessionRepository(prisma);
const auditLogRepository = new AuditLogRepository(prisma);
const companyRepository = new CompanyRepository(prisma);
const jobRepository = new JobRepository(prisma);
const applicationRepository = new ApplicationRepository(prisma);
const resumeRepository = new ResumeRepository(prisma);
const placementEventRepository = new PlacementEventRepository(prisma);
const aiResultRepository = new AIResultRepository(prisma);

const companyBattleService = new CompanyBattleService(prisma, companyRepository);
const analyticsService = new AnalyticsService(prisma);

export const container = {
  prisma,
  studentRepository,
  sessionRepository,
  auditLogRepository,
  companyRepository,
  jobRepository,
  applicationRepository,
  resumeRepository,
  placementEventRepository,
  aiResultRepository,
  companyBattleService,
  analyticsService,
};

// Export individual repos and services
export {
  studentRepository,
  sessionRepository,
  auditLogRepository,
  companyRepository,
  jobRepository,
  applicationRepository,
  resumeRepository,
  placementEventRepository,
  aiResultRepository,
  companyBattleService,
  analyticsService,
};
