import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container';
import { authenticateRequest, handleApiError } from '@/lib/auth-api-helpers';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'Unknown';
  try {
    const payload = authenticateRequest(req);
    const tenantId = payload.tenantId;

    const { searchParams } = new URL(req.url);
    const resumeId = searchParams.get('id');

    let resume;
    if (resumeId) {
      resume = await container.resumeRepository.findById(resumeId, tenantId);
    } else {
      resume = await container.resumeRepository.findActiveByStudent(payload.userId, tenantId);
    }

    if (!resume) {
      return new NextResponse('Resume not found', { status: 404 });
    }

    // Role-based verification
    if (payload.role === 'STUDENT' && resume.studentId !== payload.userId) {
      return new NextResponse('Unauthorized access to resume', { status: 403 });
    }

    // Set MIME type
    let mimeType = 'application/octet-stream';
    if (resume.filename.toLowerCase().endsWith('.pdf')) {
      mimeType = 'application/pdf';
    } else if (resume.filename.toLowerCase().endsWith('.docx')) {
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    }

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    // Log audit log event
    await container.auditLogRepository.log({
      tenantId,
      actorId: payload.userId,
      action: 'RESUME_DOWNLOADED',
      metadata: { resumeId: resume.id, filename: resume.filename, role: payload.role },
      ipAddress,
      userAgent,
    });

    const response = new NextResponse(resume.content);
    response.headers.set('Content-Type', mimeType);
    response.headers.set('Content-Disposition', `inline; filename="${resume.filename}"`);
    return response;
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/resume/view', requestId);
  }
}
