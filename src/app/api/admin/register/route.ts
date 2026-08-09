import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { studentSchema } from '@/lib/validations/student'
import { createStudent } from '@/lib/db/queries/students'
import { logStudentRegistration, logSystemEvent } from '@/lib/db/queries/activity'
import { authenticatePermissionApi, createAuthErrorResponse } from '@/lib/auth/api-auth'
import { withRateLimit } from '@/lib/auth/rate-limit'
import { Prisma } from '@prisma/client'

export const POST = withRateLimit('registration', async (request: NextRequest) => {
  // Check if user has permission to register students (admin or organizer)
  const authResult = await authenticatePermissionApi(request, 'canRegisterStudents');
  
  if (!authResult.success) {
    return createAuthErrorResponse(authResult);
  }
  const startTime = Date.now()
  let studentId: string | undefined
  
  // Extract request metadata
  const ipAddress = request.headers.get('x-forwarded-for') || 
                   request.headers.get('x-real-ip') || 
                   'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  try {
    const body = await request.json()

    // Validate input
    const parsed = studentSchema.parse(body)

    // Create student
    const student = await createStudent({
      studentIdNumber: parsed.studentIdNumber,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email: parsed.email,
      year: parsed.year,
      programId: parsed.programId,
      registrationSource: 'admin',
    })

    // if (!student) {
    //   throw new Error('Failed to create student')
    // }

    studentId = student.id

    // Log successful registration activity
    try {
      await logStudentRegistration(
        student.id,
        'admin',
        undefined, // adminId would be available with authentication
        {
          studentIdNumber: student.studentIdNumber,
          firstName: student.firstName,
          lastName: student.lastName,
          email: student.email,
          programId: student.programId,
          year: student.year,
          registrationDuration: Date.now() - startTime,
          validationPassed: true,
        },
        ipAddress,
        userAgent
      )
    } catch (activityError) {
      // Don't fail the registration if activity logging fails
      console.error('Failed to log registration activity:', activityError)
    }

    // Optionally send email here when email service is available in Epic 6

    return NextResponse.json({
      student,
      studentId: student.id,
      id: student.id,
    }, { status: 201 })
  } catch (error: unknown) {
    // Log failed registration attempt
    try {
      let errorType = 'unknown_error'
      const errorDetails: Record<string, unknown> = {
        registrationDuration: Date.now() - startTime,
        validationPassed: false,
      }

      if (error instanceof ZodError) {
        errorType = 'validation_error'
        errorDetails.validationErrors = error.issues.map((i) => ({ 
          path: i.path.join('.'), 
          message: i.message 
        }))
      } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          errorType = 'duplicate_record'
          errorDetails.duplicateFields = error.meta?.target
        } else {
          errorType = 'database_error'
          errorDetails.prismaErrorCode = error.code
        }
      }

      await logSystemEvent(
        'registration_failed',
        `Admin registration attempt failed: ${errorType}`,
        'warning',
        {
          errorType,
          studentId,
          source: 'admin',
          ipAddress,
          userAgent,
          ...errorDetails,
        }
      )
    } catch (activityError) {
      console.error('Failed to log registration failure activity:', activityError)
    }

    // Zod validation error
    if (error instanceof ZodError) {
      const issues = error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
      return NextResponse.json({ error: 'Validation failed', issues }, { status: 400 })
    }

    // Prisma unique constraint errors and others
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint failed on the fields: (constraint details)
        return NextResponse.json({ error: 'Duplicate record', detail: error.meta?.target || null }, { status: 409 })
      }
    }

    console.error('Admin register API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}); 