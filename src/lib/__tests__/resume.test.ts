import { validateDocument } from '../document-validator';
import { ResumeRepository } from '../repositories/resume.repository';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../prisma';

// Mock the Prisma client globally to run connection-free tests
jest.mock('../prisma', () => {
  return {
    prisma: {
      resume: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((promises) => Promise.all(promises)),
    },
  };
});

describe('Resume Management & Security Validation', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Document Validator Core', () => {
    it('should validate a sanitary mock PDF file', () => {
      const cleanPdf = Buffer.from('%PDF-1.5\n%...\n%%EOF');
      const result = validateDocument(cleanPdf, 'resume_v1.pdf');

      expect(result.isValid).toBe(true);
      expect(result.isSanitary).toBe(true);
      expect(result.mimeType).toBe('application/pdf');
    });

    it('should reject a PDF with embedded javascript patterns', () => {
      const maliciousPdf = Buffer.from('%PDF-1.5\n/JS (app.alert(1))\n%%EOF');
      const result = validateDocument(maliciousPdf, 'resume_v1.pdf');

      expect(result.isValid).toBe(true);
      expect(result.isSanitary).toBe(false);
      expect(result.error).toContain('scripting tags');
    });

    it('should validate a clean mock DOCX file structure', () => {
      const docxHeader = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // PK zip header
      const restOfDoc = Buffer.from('[Content_Types].xml word/document.xml content');
      const cleanDocx = Buffer.concat([docxHeader, restOfDoc]);
      const result = validateDocument(cleanDocx, 'resume_v2.docx');

      expect(result.isValid).toBe(true);
      expect(result.isSanitary).toBe(true);
      expect(result.mimeType).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    });

    it('should reject a DOCX which is a renamed generic zip file without Word structures', () => {
      const genericZip = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00, 0x61, 0x62, 0x63]);
      const result = validateDocument(genericZip, 'resume_v2.docx');

      expect(result.isValid).toBe(false);
      expect(result.isSanitary).toBe(false);
      expect(result.error).toContain('Renamed generic zip');
    });

    it('should reject executable file extensions or headers', () => {
      const exeHeader = Buffer.from([0x4D, 0x5A, 0x00, 0x00]); // MZ header
      const result = validateDocument(exeHeader, 'resume.pdf');

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Executable file signature');
    });

    it('should enforce size boundaries', () => {
      const cleanPdf = Buffer.from('%PDF-1.5\n%...\n%%EOF');
      const result = validateDocument(cleanPdf, 'resume.pdf', 5); // 5 bytes limit

      expect(result.isValid).toBe(false);
      expect(result.error).toContain('exceeds limit');
    });
  });

  describe('Resume Repository', () => {
    const mockResume = {
      id: 'resume-uuid-1',
      tenantId: 'tenant-vjti',
      studentId: 'student-vjti',
      filename: 'my_resume.pdf',
      version: 1,
      size: 1024,
      hash: 'sha-hash',
      isActive: true,
      skills: ['React', 'SQL'],
      education: 'VJTI',
      projects: ['PlacementOS'],
    };

    it('should retrieve specific resume metadata', async () => {
      const repo = new ResumeRepository(prisma as unknown as PrismaClient);
      (prisma.resume.findFirst as jest.Mock).mockResolvedValue(mockResume);

      const res = await repo.findById('resume-uuid-1', 'tenant-vjti');
      expect(res).not.toBeNull();
      expect(res?.filename).toBe('my_resume.pdf');
      expect(prisma.resume.findFirst).toHaveBeenCalledWith({
        where: { id: 'resume-uuid-1', tenantId: 'tenant-vjti', deletedAt: null },
      });
    });

    it('should deactivate older versions and activate the targeted resume in transaction', async () => {
      const repo = new ResumeRepository(prisma as unknown as PrismaClient);

      await repo.activateVersion('resume-uuid-1', 'student-vjti', 'tenant-vjti');

      expect(prisma.resume.updateMany).toHaveBeenCalledWith({
        where: { studentId: 'student-vjti', tenantId: 'tenant-vjti', isActive: true },
        data: { isActive: false },
      });
      expect(prisma.resume.update).toHaveBeenCalledWith({
        where: { id: 'resume-uuid-1', studentId: 'student-vjti', tenantId: 'tenant-vjti' },
        data: { isActive: true },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    });

    it('should soft delete resume version successfully', async () => {
      const repo = new ResumeRepository(prisma as unknown as PrismaClient);

      await repo.softDelete('resume-uuid-1', 'tenant-vjti');

      expect(prisma.resume.update).toHaveBeenCalledWith({
        where: { id: 'resume-uuid-1', tenantId: 'tenant-vjti' },
        data: { deletedAt: expect.any(Date), isActive: false },
      });
    });
  });
});
