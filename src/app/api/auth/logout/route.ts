import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container';
import { verifyToken } from '@/lib/crypto';
import cookie from 'cookie';

export async function POST(req: NextRequest) {
  try {
    const cookiesHeader = req.headers.get('cookie') || '';
    const parsedCookies = cookie.parse(cookiesHeader);
    const refreshToken = parsedCookies.refreshToken;

    if (refreshToken) {
      // Find and delete the session in the DB
      const session = await container.sessionRepository.findByRefreshToken(refreshToken);
      if (session) {
        await container.sessionRepository.deleteSession(session.id);

        try {
          const payload = verifyToken(refreshToken);
          await container.auditLogRepository.log({
            tenantId: payload.tenantId,
            actorId: payload.userId,
            action: 'USER_LOGOUT',
            metadata: { info: 'User requested session termination.' },
            ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
            userAgent: req.headers.get('user-agent') || 'Unknown',
          });
        } catch {
          // Token might be expired but session is cleared; proceed
        }
      }
    }

    const response = NextResponse.json({
      message: 'Logout successful',
    });

    // Clear cookies by setting Max-Age=0
    response.headers.append('Set-Cookie', 'accessToken=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict');
    response.headers.append('Set-Cookie', 'refreshToken=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict');

    return response;
  } catch (error) {
    console.error('Logout API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
