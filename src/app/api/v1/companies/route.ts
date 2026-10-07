import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container';
import { createCompanySchema } from '@/lib/validation/api';
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

    if (tenantIdParam) {
      enforceTenant(payload, tenantIdParam);
    }

    const tenantId = payload.tenantId;

    const [companies, total] = await Promise.all([
      container.companyRepository.findAll(tenantId, skip, take),
      container.companyRepository.countAll(tenantId),
    ]);

    return NextResponse.json({
      data: companies,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/companies', requestId);
  }
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'Unknown';
  try {
    const payload = authenticateRequest(req);
    authorizeRole(payload, ['TPO', 'RECRUITER']);

    const body = await req.json();
    const validatedData = createCompanySchema.parse(body);

    const tenantId = payload.tenantId;

    const existing = await container.companyRepository.findByName(validatedData.name, tenantId);
    if (existing) {
      return NextResponse.json({ error: 'Company already exists' }, { status: 400 });
    }

    const company = await container.companyRepository.create({
      tenant: { connect: { id: tenantId } },
      name: validatedData.name,
      industry: validatedData.industry,
    });

    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    // Audit log
    await container.auditLogRepository.log({
      tenantId,
      actorId: payload.userId,
      action: 'COMPANY_UPDATED',
      metadata: { companyId: company.id, name: company.name },
      ipAddress,
      userAgent,
    });

    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'POST /api/v1/companies', requestId);
  }
}
