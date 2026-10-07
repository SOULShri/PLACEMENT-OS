import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container';
import { validateDocument } from '@/lib/document-validator';
import { authenticateRequest, handleApiError } from '@/lib/auth-api-helpers';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'Unknown';
  try {
    const payload = authenticateRequest(req);
    const tenantId = payload.tenantId;
    const studentId = payload.userId;

    const resume = await container.resumeRepository.findActiveByStudent(studentId, tenantId);
    if (!resume) {
      return NextResponse.json({ message: 'No active resume found' }, { status: 404 });
    }

    // Return metadata without raw binary buffer content to keep payload small
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { content, ...metadata } = resume;
    return NextResponse.json(metadata);
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/resume', requestId);
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'Unknown';
  try {
    const payload = authenticateRequest(req);
    const tenantId = payload.tenantId;
    const studentId = payload.userId;

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Validate document (PDF or DOCX, size < 10MB, security tags check)
    const validation = validateDocument(buffer, file.name);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    if (!validation.isSanitary) {
      return NextResponse.json({ error: validation.error || 'File failed sanity checks.' }, { status: 400 });
    }

    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    // Extract metadata fields from formData for differential comparisons
    const skillsRaw = formData.get('skills')?.toString() || '';
    const education = formData.get('education')?.toString() || '';
    const projectsRaw = formData.get('projects')?.toString() || '';

    const skills = skillsRaw.split(',').map(s => s.trim()).filter(Boolean);
    const projects = projectsRaw.split(',').map(p => p.trim()).filter(Boolean);

    // Get current version history to calculate version count
    const history = await container.resumeRepository.findByStudentHistory(studentId, tenantId);
    const nextVersion = history.length > 0 ? history[0].version + 1 : 1;

    // Deactivate previous active ones first
    await container.resumeRepository.deactivateAll(studentId, tenantId);

    // Save as new active version
    const resume = await container.resumeRepository.create({
      tenantId,
      filename: file.name,
      version: nextVersion,
      size: buffer.length,
      hash,
      content: buffer,
      skills,
      education,
      projects,
      isActive: true,
      student: { connect: { id: studentId } },
    });

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    // Log audit trail event
    await container.auditLogRepository.log({
      tenantId,
      actorId: studentId,
      action: 'RESUME_UPLOADED',
      metadata: { resumeId: resume.id, filename: resume.filename, version: resume.version },
      ipAddress,
      userAgent,
    });

    // Sync skills back to student record to keep profile matching accurate
    if (skills.length > 0) {
      // Fetch current student profile
      const student = await container.studentRepository.findById(studentId, tenantId);
      if (student) {
        const uniqueSkills = Array.from(new Set([...student.skills, ...skills]));
        await container.studentRepository.update(studentId, tenantId, {
          skills: uniqueSkills,
        });
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { content, ...metadata } = resume;
    return NextResponse.json(metadata, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/resume', requestId);
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'Unknown';
  try {
    const payload = authenticateRequest(req);
    const tenantId = payload.tenantId;
    const studentId = payload.userId;

    const { searchParams } = new URL(req.url);
    const resumeIdParam = searchParams.get('id');

    let targetId = resumeIdParam;
    if (!targetId) {
      const active = await container.resumeRepository.findActiveByStudent(studentId, tenantId);
      if (!active) {
        return NextResponse.json({ error: 'No active resume to delete' }, { status: 404 });
      }
      targetId = active.id;
    }

    // Verify ownership before deleting
    const targetResume = await container.resumeRepository.findById(targetId, tenantId);
    if (!targetResume || targetResume.studentId !== studentId) {
      return NextResponse.json({ error: 'Resume not found or unauthorized' }, { status: 404 });
    }

    await container.resumeRepository.softDelete(targetId, tenantId);

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    await container.auditLogRepository.log({
      tenantId,
      actorId: studentId,
      action: 'RESUME_UPDATED',
      metadata: { info: 'Resume version soft deleted', resumeId: targetId },
      ipAddress,
      userAgent,
    });

    return NextResponse.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    return handleApiError(error, 'DELETE /api/v1/resume', requestId);
  }
}
