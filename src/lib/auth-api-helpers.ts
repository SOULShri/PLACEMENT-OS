import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, TokenPayload } from './crypto';
import { parse } from 'cookie';

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Validates request cookies/headers for a valid access token.
 * Returns the cryptographically validated token payload.
 */
export function authenticateRequest(req: NextRequest): TokenPayload {
  const cookiesHeader = req.headers.get('cookie') || '';
  const parsedCookies = parse(cookiesHeader);
  let accessToken = parsedCookies.accessToken;

  // Fallback: Authorization Header
  if (!accessToken) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    }
  }

  if (!accessToken) {
    throw new AuthError(401, 'Authentication token missing');
  }

  try {
    return verifyToken(accessToken);
  } catch {
    throw new AuthError(401, 'Invalid or expired access token');
  }
}

/**
 * Validates role-based permissions (RBAC).
 */
export function authorizeRole(payload: TokenPayload, allowedRoles: string[]): void {
  if (!allowedRoles.includes(payload.role)) {
    throw new AuthError(403, 'Unauthorized role access');
  }
}

/**
 * Enforces tenant isolation.
 */
export function enforceTenant(payload: TokenPayload, tenantId: string | null): void {
  if (tenantId && payload.tenantId !== tenantId) {
    throw new AuthError(403, 'Tenant isolation breach detected');
  }
}

/**
 * Safely parses pagination limit and offset.
 * Default page = 1, default limit = 10, max limit = 100.
 */
export function parsePagination(req: NextRequest): { skip: number; take: number; page: number; limit: number } {
  const { searchParams } = new URL(req.url);
  
  let page = parseInt(searchParams.get('page') || '1', 10);
  let limit = parseInt(searchParams.get('limit') || '10', 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = 10;
  if (limit > 100) limit = 100; // Cap to prevent DoS

  const skip = (page - 1) * limit;
  const take = limit;

  return { skip, take, page, limit };
}

/**
 * Centralized API route error handler.
 */
export function handleApiError(error: unknown, prefix: string, requestId: string): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error(`[${prefix}] Error (Req ID: ${requestId}):`, error);

  const message = error instanceof Error ? error.message : 'Internal Server Error';
  return NextResponse.json(
    { error: 'Internal Server Error', details: message },
    { status: 500 }
  );
}
