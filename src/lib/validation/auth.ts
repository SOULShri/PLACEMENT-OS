import { z } from 'zod';

export const registerSchema = z.object({
  tenantId: z.string().uuid('Invalid Institutional Tenant ID'),
  studentId: z.string().min(3, 'Roll number / Student ID is too short').max(50),
  name: z.string().min(2, 'Name is too short').max(100),
  email: z.string().email('Invalid email address').refine(
    (email) => email.endsWith('@vjti.ac.in') || email.endsWith('.edu') || email.endsWith('@gmail.com'),
    { message: 'Email must be a VJTI educational domain or permitted address' }
  ),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  phone: z.string().min(10, 'Phone number must be at least 10 digits').max(15),
  personalEmail: z.string().email('Invalid personal email address'),
  cgpa: z.number().min(0).max(10),
  branch: z.enum(['CS', 'IT', 'EXTC', 'MECH', 'CIVIL', 'EE']),
  skills: z.array(z.string()).min(1, 'Please specify at least one skill'),
  codingScore: z.number().optional().default(0),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const resetPasswordRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordConfirmSchema = z.object({
  token: z.string().uuid('Invalid reset token'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters long'),
});
