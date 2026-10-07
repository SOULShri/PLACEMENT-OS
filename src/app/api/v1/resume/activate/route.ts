import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container';
import { authenticateRequest, handleApiError } from '@/lib/auth-api-helpers';
import { z } from 'zod';

const activateSchema = z.object({
  resumeId: z.string().uuid('Invalid Resume ID'),
});

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'Unknown';
  try {
    const payload = authenticateRequest(req);
    const tenantId = payload.tenantId;
    const studentId = payload.userId;

    const body = await req.json();
    const validatedData = activateSchema.parse(body);

    // Verify ownership of the target resume first
    const resume = await container.resumeRepository.findById(validatedData.resumeId, tenantId);
    if (!resume || resume.studentId !== studentId) {
      return NextResponse.json({ error: 'Resume not found or unauthorized' }, { status: 404 });
    }

    await container.resumeRepository.activateVersion(validatedData.resumeId, studentId, tenantId);

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    // Log audit trail event
    await container.auditLogRepository.log({
      tenantId,
      actorId: studentId,
      action: 'RESUME_ACTIVATED',
      metadata: { resumeId: resume.id, filename: resume.filename, version: resume.version },
      ipAddress,
      userAgent,
    });

    // Sync student skills table with activated resume skills
    if (resume.skills.length > 0) {
      const student = await container.studentRepository.findById(studentId, tenantId);
      if (student) {
        const uniqueSkills = Array.from(new Set([...student.skills, ...resume.skills]));
        await container.studentRepository.update(studentId, tenantId, {
          skills: uniqueSkills,
        });
      }
    }

    return NextResponse.json({ message: 'Version activated successfully' });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/resume/activate', requestId);
  }
}
