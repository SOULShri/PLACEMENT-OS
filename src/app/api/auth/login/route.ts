import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { container } from '@/lib/container';
import { loginSchema } from '@/lib/validation/auth';
import { verifyPassword, generateAccessToken, generateRefreshToken } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = loginSchema.parse(body);

    // Fetch student by email
    const student = await container.studentRepository.findByEmail(validatedData.email);
    if (!student) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password using Argon2id via WASM
    const isMatch = await verifyPassword(validatedData.password, student.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    const payload = {
      userId: student.id,
      email: student.email,
      role: 'STUDENT',
      tenantId: student.tenantId,
    };

    // Sign JWT tokens
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Save session in database for RTR checks
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const ipAddress = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    await container.sessionRepository.createSession({
      tenantId: student.tenantId,
      userId: student.id,
      userAgent,
      ipAddress,
      refreshToken,
      expiresAt,
    });

    // Write audit log entry
    await container.auditLogRepository.log({
      tenantId: student.tenantId,
      actorId: student.id,
      action: 'USER_LOGIN',
      metadata: { ipAddress, userAgent },
      ipAddress,
      userAgent,
    });

    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        id: student.id,
        name: student.name,
        email: student.email,
        role: 'STUDENT',
      },
    });

    // Append HttpOnly Cookies to response headers
    const cookieFlags = '; Path=/; HttpOnly; SameSite=Strict' + (process.env.NODE_ENV === 'production' ? '; Secure' : '');
    
    // Access token (15 mins)
    response.headers.append(
      'Set-Cookie',
      `accessToken=${accessToken}${cookieFlags}; Max-Age=900`
    );

    // Refresh token (7 days)
    response.headers.append(
      'Set-Cookie',
      `refreshToken=${refreshToken}${cookieFlags}; Max-Age=604800`
    );

    return response;
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Login API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
