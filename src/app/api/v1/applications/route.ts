import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container';
import { createApplicationSchema } from '@/lib/validation/api';
import { 
  authenticateRequest, 
  authorizeRole, 
  enforceTenant, 
  parsePagination, 
  handleApiError,
  AuthError
} from '@/lib/auth-api-helpers';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'Unknown';
  try {
    const payload = authenticateRequest(req);
    const { skip, take, page, limit } = parsePagination(req);

    const { searchParams } = new URL(req.url);
    const tenantIdParam = searchParams.get('tenantId');
    const studentIdParam = searchParams.get('studentId');
    const jobId = searchParams.get('jobId');

    if (tenantIdParam) {
      enforceTenant(payload, tenantIdParam);
    }

    const tenantId = payload.tenantId;

    // RBAC: STUDENT can only view their own applications
    let targetStudentId = studentIdParam;
    if (payload.role === 'STUDENT') {
      if (studentIdParam && studentIdParam !== payload.userId) {
        throw new AuthError(403, 'Unauthorized student context access');
      }
      targetStudentId = payload.userId;
    }

    if (targetStudentId) {
      const [apps, total] = await Promise.all([
        container.applicationRepository.findByStudent(targetStudentId, tenantId, skip, take),
        container.applicationRepository.countByStudent(targetStudentId, tenantId),
      ]);
      return NextResponse.json({
        data: apps,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        }
      });
    }

    if (jobId) {
      // TPO or RECRUITER role required to query by Job ID
      authorizeRole(payload, ['TPO', 'RECRUITER', 'ALUMNI']);

      const [apps, total] = await Promise.all([
        container.applicationRepository.findByJob(jobId, tenantId, skip, take),
        container.applicationRepository.countByJob(jobId, tenantId),
      ]);
      return NextResponse.json({
        data: apps,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        }
      });
    }

    return NextResponse.json({ error: 'Either studentId or jobId must be specified' }, { status: 400 });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/applications', requestId);
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'Unknown';
  try {
    const payload = authenticateRequest(req);
    // Only STUDENTS and TPOs (on behalf of students) can submit applications
    authorizeRole(payload, ['STUDENT', 'TPO']);

    const body = await req.json();
    const validatedData = createApplicationSchema.parse(body);

    const tenantId = payload.tenantId;
    
    // RBAC check: STUDENT can only apply for themselves
    let studentId = validatedData.studentId;
    if (payload.role === 'STUDENT') {
      studentId = payload.userId;
    } else if (!studentId) {
      return NextResponse.json({ error: 'studentId is required for admin submission' }, { status: 400 });
    }

    // Verify student eligibility
    const student = await container.studentRepository.findById(studentId, tenantId);
    const job = await container.jobRepository.findById(validatedData.jobId, tenantId);

    if (!student || !job) {
      return NextResponse.json({ error: 'Student or Job not found' }, { status: 404 });
    }

    if (student.cgpa < job.minCgpa) {
      return NextResponse.json({ error: 'Ineligible: Student CGPA is below the minimum required CGPA for this job' }, { status: 400 });
    }

    // Check for existing applications to prevent duplicate requests
    const studentApps = await container.applicationRepository.findByStudent(studentId, tenantId);
    const alreadyApplied = studentApps.some((app) => app.jobId === validatedData.jobId);
    if (alreadyApplied) {
      return NextResponse.json({ error: 'Already applied for this opportunity' }, { status: 400 });
    }

    // Initialize placement timeline engine array
    const initialTimeline = [
      {
        status: 'APPLIED',
        timestamp: new Date().toISOString(),
        note: 'Applied successfully through PlacementOS.',
      },
    ];

    const application = await container.applicationRepository.create({
      tenantId,
      student: { connect: { id: studentId } },
      job: { connect: { id: validatedData.jobId } },
      status: 'APPLIED',
      timelineHistory: initialTimeline,
    });

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    // Write audit log entry
    await container.auditLogRepository.log({
      tenantId,
      actorId: payload.userId,
      action: 'JOB_APPLIED',
      metadata: { applicationId: application.id, jobId: job.id, companyName: job.company.name },
      ipAddress,
      userAgent,
    });

    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/applications', requestId);
  }
}
