import { NextRequest, NextResponse } from 'next/server';
import { parseUserAgent } from '@/lib/ua-parser';
import { logger } from '@/lib/logger';

// Edge-safe JWT payload decoder (no Node crypto dependencies)
function decodeJwtPayload(token: string): { userId: string; email: string; role: string; tenantId: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    // Polyfill atob decoding inside Edge runtime safely
    const raw = atob(base64);
    const jsonPayload = decodeURIComponent(
      raw.split('').map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

// Memory map for rate limiting (since Vercel edge/local instance memory is shared per-worker)
const rateLimitMap = new Map<string, { tokens: number; lastRefill: number }>();

function checkRateLimit(key: string, limit: number, periodMs: number = 60000): boolean {
  const now = Date.now();
  const state = rateLimitMap.get(key) || { tokens: limit, lastRefill: now };

  const elapsed = now - state.lastRefill;
  const refillRate = limit / periodMs;
  const refilledTokens = state.tokens + elapsed * refillRate;
  const currentTokens = Math.min(limit, refilledTokens);

  if (currentTokens >= 1) {
    rateLimitMap.set(key, { tokens: currentTokens - 1, lastRefill: now });
    return false; // Not limited
  }

  rateLimitMap.set(key, { tokens: currentTokens, lastRefill: now });
  return true; // Limited
}

export function middleware(req: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  // Parse token
  const accessToken = req.cookies.get('accessToken')?.value;
  const payload = accessToken ? decodeJwtPayload(accessToken) : null;
  const userAgent = req.headers.get('user-agent') || '';
  const clientInfo = parseUserAgent(userAgent);
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';

  // 1. Rate Limiting Middleware
  const rateLimitKey = payload ? `usr:${payload.userId}` : `ip:${ip}`;
  let limit = 30; // default for guest
  if (payload) {
    if (payload.role === 'STUDENT') {
      limit = 100;
    } else if (['TPO', 'RECRUITER', 'ALUMNI'].includes(payload.role)) {
      limit = 300;
    }
  }

  if (checkRateLimit(rateLimitKey, limit)) {
    logger.warn('Rate limit exceeded', { requestId, rateLimitKey, limit });
    return new NextResponse(
      JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 2. CSRF Protection for mutating request types (POST, PUT, DELETE, PATCH)
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');

    if (origin) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host) {
          logger.warn('CSRF origin mismatch detected', { requestId, origin, host });
          return new NextResponse(
            JSON.stringify({ error: 'CSRF validation failed: Origin mismatch' }),
            { status: 403, headers: { 'Content-Type': 'application/json' } }
          );
        }
      } catch {
        logger.warn('CSRF invalid origin header', { requestId, origin });
        return new NextResponse(
          JSON.stringify({ error: 'CSRF validation failed: Invalid Origin' }),
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  // Inject request ID header for backend tracing
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-request-id', requestId);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 3. Set Secure Headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self';"
  );

  // 4. Structured Request Latency Logging
  const latencyMs = Date.now() - startTime;

  logger.logRequest({
    request_id: requestId,
    tenant_id: payload?.tenantId || undefined,
    user_id: payload?.userId || undefined,
    ip_address: ip,
    latency: latencyMs,
    endpoint: req.nextUrl.pathname,
    method: req.method,
    status: response.status,
    browser: clientInfo.browser,
    os: clientInfo.os,
    device: clientInfo.device,
  });

  return response;
}

// Apply middleware to API paths and core dashboards
export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*'],
};
