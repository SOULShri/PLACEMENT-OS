import { z } from 'zod';

export const createCompanySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  industry: z.string().optional(),
});

export const updateCompanySchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  industry: z.string().optional(),
});

export const createJobSchema = z.object({
  companyId: z.string().uuid('Invalid Company ID'),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  minCgpa: z.number().min(0).max(10),
  requiredSkills: z.array(z.string()).min(1, 'At least one skill is required'),
  packageLpa: z.number().nonnegative(),
});

export const updateJobSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  minCgpa: z.number().min(0).max(10).optional(),
  requiredSkills: z.array(z.string()).min(1).optional(),
  packageLpa: z.number().nonnegative().optional(),
});

export const createApplicationSchema = z.object({
  jobId: z.string().uuid('Invalid Job ID'),
  studentId: z.string().uuid('Invalid Student ID').optional(),
  tenantId: z.string().uuid('Invalid Tenant ID').optional(),
});

export const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  cgpa: z.number().min(0).max(10).optional(),
  skills: z.array(z.string()).min(1).optional(),
  codingScore: z.number().min(0).max(1000).optional(),
});
