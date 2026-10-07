import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container';
import { authenticateRequest, handleApiError } from '@/lib/auth-api-helpers';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'Unknown';
  try {
    const payload = authenticateRequest(req);
    const tenantId = payload.tenantId;

    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q') || '';

    const results = await container.analyticsService.getGlobalSearch(query, tenantId);
    return NextResponse.json(results);
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/company/search', requestId);
  }
}
