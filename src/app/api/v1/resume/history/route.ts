import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container';
import { authenticateRequest, handleApiError } from '@/lib/auth-api-helpers';

export async function GET(req: NextRequest) {
  const requestId = req.headers.get('x-request-id') || 'Unknown';
  try {
    const payload = authenticateRequest(req);
    const tenantId = payload.tenantId;
    const studentId = payload.userId;

    const history = await container.resumeRepository.findByStudentHistory(studentId, tenantId);
    
    // Map list excluding the raw binary files
    const historyMetadata = history.map((res) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { content, ...metadata } = res;
      return metadata;
    });

    return NextResponse.json(historyMetadata);
  } catch (error) {
    return handleApiError(error, 'GET /api/v1/resume/history', requestId);
  }
}
