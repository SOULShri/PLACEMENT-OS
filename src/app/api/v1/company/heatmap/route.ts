import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container';
import { authenticateRequest, handleApiError } from '@/lib/auth-api-helpers';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'Unknown';
  try {
    const payload = authenticateRequest(req);
    const tenantId = payload.tenantId;

    const heatmap = await container.analyticsService.getPlacementHeatmap(tenantId);
    return NextResponse.json(heatmap);
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/company/heatmap', requestId);
  }
}
