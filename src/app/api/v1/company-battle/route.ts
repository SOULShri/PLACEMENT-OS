import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container';
import { cacheManager } from '@/lib/cache';
import { 
  authenticateRequest, 
  enforceTenant, 
  handleApiError 
} from '@/lib/auth-api-helpers';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'Unknown';
  try {
    const payload = authenticateRequest(req);

    const { searchParams } = new URL(req.url);
    const companyIdA = searchParams.get('companyIdA');
    const companyIdB = searchParams.get('companyIdB');
    const tenantIdParam = searchParams.get('tenantId');

    if (!companyIdA || !companyIdB) {
      return NextResponse.json(
        { error: 'companyIdA and companyIdB are required' },
        { status: 400 }
      );
    }

    if (tenantIdParam) {
      enforceTenant(payload, tenantIdParam);
    }

    const tenantId = payload.tenantId;

    // Cache lookup
    const cacheKey = `battle:${companyIdA}:${companyIdB}:${tenantId}`;
    const cachedResult = await cacheManager.get(cacheKey);
    if (cachedResult) {
      return NextResponse.json(cachedResult);
    }

    const comparison = await container.companyBattleService.compareCompanies(
      companyIdA,
      companyIdB,
      tenantId
    );

    // Store in cache for 15 mins
    await cacheManager.set(cacheKey, comparison, 15 * 60);

    return NextResponse.json(comparison);
  } catch (error: unknown) {
    return handleApiError(error, 'GET /api/v1/company-battle', requestId);
  }
}
