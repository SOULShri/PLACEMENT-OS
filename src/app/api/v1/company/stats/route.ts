import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container';
import { authenticateRequest, handleApiError } from '@/lib/auth-api-helpers';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'Unknown';
  try {
    const payload = authenticateRequest(req);
    const tenantId = payload.tenantId;

    const { searchParams } = new URL(req.url);
    const companyId = searchParams.get('companyId');

    if (!companyId) {
      return NextResponse.json({ error: 'companyId query parameter is required' }, { status: 400 });
    }

    const stats = await container.analyticsService.getCompanyStats(companyId, tenantId);
    return NextResponse.json(stats);
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/company/stats', requestId);
  }
}
