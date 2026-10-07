import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { container } from '@/lib/container';
import { registerSchema } from '@/lib/validation/auth';
import { hashPassword, encrypt } from '@/lib/crypto';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = registerSchema.parse(body);

    // Verify or auto-create Tenant context for local ease
    let tenant = await container.prisma.tenant.findUnique({
      where: { id: validatedData.tenantId },
    });

    if (!tenant) {
      // For local testing convenience, if tenant is valid UUID but not found, provision it.
      tenant = await container.prisma.tenant.create({
        data: {
          id: validatedData.tenantId,
          name: 'VJTI Placement Cell',
        },
      });
    }

    // Check email uniqueness
    const existingEmail = await container.studentRepository.findByEmail(validatedData.email);
    if (existingEmail) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Check student roll number uniqueness
    const existingRoll = await container.studentRepository.findByRollNumber(
      validatedData.studentId,
      validatedData.tenantId
    );
    if (existingRoll) {
      return NextResponse.json(
        { error: 'Roll number / Student ID already registered' },
        { status: 400 }
      );
    }

    // Hash the password with WASM Argon2id
    const passwordHash = await hashPassword(validatedData.password);

    // Encrypt sensitive PII (Phone and Personal Email) with AES-256-GCM
    const encryptedPhone = encrypt(validatedData.phone);
    const encryptedPersonalEmail = encrypt(validatedData.personalEmail);

    // Save to PostgreSQL via repository pattern
    const student = await container.studentRepository.create({
      tenant: { connect: { id: validatedData.tenantId } },
      studentId: validatedData.studentId,
      name: validatedData.name,
      email: validatedData.email,
      passwordHash,
      encryptedPhone,
      encryptedPersonalEmail,
      cgpa: validatedData.cgpa,
      branch: validatedData.branch,
      skills: validatedData.skills,
      codingScore: validatedData.codingScore,
    });

    // Create a base user preferences entry
    await container.prisma.userPreference.create({
      data: {
        studentId: student.id,
        theme: 'dark',
        language: 'en',
        layout: 'compact',
      },
    });

    // Log the audit event
    await container.auditLogRepository.log({
      tenantId: student.tenantId,
      actorId: student.id,
      action: 'USER_REGISTERED',
      metadata: { studentId: student.studentId },
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
      userAgent: req.headers.get('user-agent') || 'Unknown',
    });

    return NextResponse.json(
      {
        message: 'Student registration successful',
        student: {
          id: student.id,
          studentId: student.studentId,
          name: student.name,
          email: student.email,
          branch: student.branch,
        },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    console.error('Registration API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
