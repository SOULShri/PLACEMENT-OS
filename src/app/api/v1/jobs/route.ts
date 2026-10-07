import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container';
import { createJobSchema } from '@/lib/validation/api';
import { 
  authenticateRequest, 
  authorizeRole, 
  enforceTenant, 
  parsePagination, 
  handleApiError 
} from '@/lib/auth-api-helpers';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'Unknown';
  try {
    const payload = authenticateRequest(req);
    const { skip, take, page, limit } = parsePagination(req);

    const { searchParams } = new URL(req.url);
    const tenantIdParam = searchParams.get('tenantId');
    
    // Enforce tenant isolation
    if (tenantIdParam) {
      enforceTenant(payload, tenantIdParam);
    }
    
    const tenantId = payload.tenantId;
    const studentId = searchParams.get('studentId'); // Optional parameter for matching

    const [jobs, total] = await Promise.all([
      container.jobRepository.findAll(tenantId, skip, take),
      container.jobRepository.countAll(tenantId),
    ]);

    // If student ID is specified, run the Opportunity Radar matchmaking
    if (studentId) {
      // Ensure cross-tenant check for requested studentId
      const student = await container.studentRepository.findById(studentId, tenantId);
      if (student) {
        const jobsWithMatch = jobs.map((job) => {
          // 1. Check CGPA eligibility
          if (student.cgpa < job.minCgpa) {
            return { ...job, matchLevel: 'LOW', eligible: false };
          }

          // 2. Compute skill overlap ratio
          const required = job.requiredSkills.map((s) => s.toLowerCase());
          const studentSkills = student.skills.map((s) => s.toLowerCase());
          
          const matchedSkills = required.filter((s) => studentSkills.includes(s));
          const overlapRatio = required.length > 0 ? matchedSkills.length / required.length : 0;

          // 3. Define match categorizations
          let matchLevel = 'LOW';
          if (overlapRatio >= 0.6) {
            matchLevel = 'HIGH';
          } else if (overlapRatio >= 0.2) {
            matchLevel = 'MEDIUM';
          }

          return { ...job, matchLevel, eligible: true };
        });

        return NextResponse.json({
          data: jobsWithMatch,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          }
        });
      }
    }

    return NextResponse.json({
      data: jobs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/jobs', requestId);
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'Unknown';
  try {
    const payload = authenticateRequest(req);
    authorizeRole(payload, ['TPO', 'RECRUITER']);

    const body = await req.json();
    const validatedData = createJobSchema.parse(body);

    const tenantId = payload.tenantId;

    const job = await container.jobRepository.create({
      tenantId,
      company: { connect: { id: validatedData.companyId } },
      title: validatedData.title,
      description: validatedData.description,
      minCgpa: validatedData.minCgpa,
      requiredSkills: validatedData.requiredSkills,
      packageLpa: validatedData.packageLpa,
    });

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    // Audit Log mutation
    await container.auditLogRepository.log({
      tenantId,
      actorId: payload.userId,
      action: 'JOB_UPDATED', // Or JOB_CREATED
      metadata: { jobId: job.id, title: job.title },
      ipAddress,
      userAgent,
    });

    return NextResponse.json(job, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/jobs', requestId);
  }
}
