import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { studentSchema } from '@/lib/validations/student';
import { createStudent } from '@/lib/db/queries/students';
import {
  logStudentRegistration,
  logSystemEvent,
} from '@/lib/db/queries/activity';
import { withRateLimit } from '@/lib/auth/rate-limit';

export const POST = withRateLimit(
  'registration',
  async (request: NextRequest) => {
    const startTime = Date.now();
    let studentId: string | undefined;

    // Extract request metadata
    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const userAgent =
      request.headers.get('user-agent') || 'unknown';

    try {
      const body = await request.json();
      const parsed = studentSchema.parse(body);

      const student = await createStudent({
        ...parsed,
        registrationSource: 'public',
      });

      if (!student) {
        throw new Error('Failed to create student');
      }

      studentId = student.id;

      // Log successful registration activity
      try {
        await logStudentRegistration(
          student.id,
          'public',
          undefined,
          {
            studentIdNumber: student.studentIdNumber,
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            programId: student.programId,
            year: student.year,
            registrationDuration: Date.now() - startTime,
            validationPassed: true,
            selfRegistration: true,
          },
          ipAddress,
          userAgent
        );
      } catch (activityError) {
        // Activity logging should never make registration fail
        console.error(
          'Failed to log public registration activity:',
          activityError
        );
      }

      return NextResponse.json(
        { student },
        { status: 201 }
      );
    } catch (error: unknown) {
      // Determine error type for logging
      try {
        let errorType = 'unknown_error';

        const errorDetails: Record<string, unknown> = {
          registrationDuration: Date.now() - startTime,
          validationPassed: false,
          selfRegistration: true,
        };

        if (error instanceof z.ZodError) {
          errorType = 'validation_error';

          errorDetails.validationErrors =
            error.flatten().fieldErrors;
        } else if (
          error instanceof Prisma.PrismaClientKnownRequestError
        ) {
          if (error.code === 'P2002') {
            errorType = 'duplicate_record';
            errorDetails.duplicateFields = error.meta?.target;
          } else {
            errorType = 'database_error';
            errorDetails.prismaErrorCode = error.code;
          }
        } else if (
          error instanceof Prisma.PrismaClientInitializationError
        ) {
          errorType = 'database_initialization_error';
        } else if (
          error instanceof Prisma.PrismaClientUnknownRequestError
        ) {
          errorType = 'database_unknown_error';
        }

        await logSystemEvent(
          'registration_failed',
          `Public registration attempt failed: ${errorType}`,
          'warning',
          {
            errorType,
            studentId,
            source: 'public',
            ipAddress,
            userAgent,
            ...errorDetails,
          }
        );
      } catch (activityError) {
        console.error(
          'Failed to log public registration failure activity:',
          activityError
        );
      }

      // Validation error
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      // Prisma duplicate record
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
      ) {
        if (error.code === 'P2002') {
          const target = error.meta?.target;

          const fields = Array.isArray(target)
            ? target.join(', ')
            : 'provided information';

          const message = `A student with this ${fields} already exists.`;

          return NextResponse.json(
            { error: message },
            { status: 409 }
          );
        }
      }

      // IMPORTANT:
      // Log the complete server-side error so it appears
      // in Vercel function logs.
      console.error(
        '========== STUDENT REGISTRATION ERROR =========='
      );
      console.error(error);
      console.error(
        '================================================'
      );

      // Temporarily return the actual error message so we can
      // diagnose the production failure.
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : 'An unexpected error occurred.',
        },
        { status: 500 }
      );
    }
  }
);