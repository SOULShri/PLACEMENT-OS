import { NextRequest, NextResponse } from 'next/server';
import { container } from '@/lib/container';
import { verifyToken, generateAccessToken, generateRefreshToken } from '@/lib/crypto';
import cookie from 'cookie';

export async function POST(req: NextRequest) {
  try {
    const cookiesHeader = req.headers.get('cookie') || '';
    const parsedCookies = cookie.parse(cookiesHeader);
    const refreshToken = parsedCookies.refreshToken;

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Authentication token missing' },
        { status: 401 }
      );
    }

    let payload;
    try {
      payload = verifyToken(refreshToken);
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired token signature' },
        { status: 401 }
      );
    }

    // Verify session state in database
    const session = await container.sessionRepository.findByRefreshToken(refreshToken);

    if (!session) {
      // REUSE DETECTION TRIGGERED: 
      // The refresh token is cryptographically valid but not present in our database session registry.
      // This implies it was already consumed in a previous rotation, representing a potential token replay hijack.
      // Action: Invalidate all active sessions for this user.
      await container.sessionRepository.invalidateAllForUser(payload.userId);

      // Audit log the reuse breach attempt
      await container.auditLogRepository.log({
        tenantId: payload.tenantId,
        actorId: payload.userId,
        action: 'REFRESH_TOKEN_REUSE_BREACH',
        metadata: { info: 'Revoked all active sessions due to replay detection.' },
        ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
        userAgent: req.headers.get('user-agent') || 'Unknown',
      });

      // Clear both cookies to reset client state
      const response = NextResponse.json(
        { error: 'Security breach detected. All sessions terminated.' },
        { status: 401 }
      );
      response.headers.append('Set-Cookie', 'accessToken=; Path=/; Max-Age=0');
      response.headers.append('Set-Cookie', 'refreshToken=; Path=/; Max-Age=0');
      return response;
    }

    // Check expiration
    if (new Date() > session.expiresAt) {
      await container.sessionRepository.deleteSession(session.id);
      return NextResponse.json(
        { error: 'Token expired. Please login again.' },
        { status: 401 }
      );
    }

    // Rotation: Delete old session
    await container.sessionRepository.deleteSession(session.id);

    // Create new token credentials
    const newPayload = {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
    };

    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    // Save new session in database
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    await container.sessionRepository.createSession({
      tenantId: payload.tenantId,
      userId: payload.userId,
      userAgent,
      ipAddress,
      refreshToken: newRefreshToken,
      expiresAt,
    });

    const response = NextResponse.json({
      message: 'Token rotation successful',
    });

    // Set new cookies
    const cookieFlags = '; Path=/; HttpOnly; SameSite=Strict' + (process.env.NODE_ENV === 'production' ? '; Secure' : '');
    response.headers.append(
      'Set-Cookie',
      `accessToken=${newAccessToken}${cookieFlags}; Max-Age=900`
    );
    response.headers.append(
      'Set-Cookie',
      `refreshToken=${newRefreshToken}${cookieFlags}; Max-Age=604800`
    );

    return response;
  } catch (error) {
    console.error('Refresh API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
