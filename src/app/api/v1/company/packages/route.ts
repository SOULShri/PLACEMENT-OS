import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container';
import { authenticateRequest, handleApiError } from '@/lib/auth-api-helpers';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'Unknown';
  try {
    const payload = authenticateRequest(req);
    const tenantId = payload.tenantId;

    const leaders = await container.analyticsService.getCompanyPackages(tenantId);
    return NextResponse.json(leaders);
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/company/packages', requestId);
  }
}
