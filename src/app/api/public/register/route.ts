import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { studentSchema } from '@/lib/validations/student'
import { createStudent } from '@/lib/db/queries/students'
import { logStudentRegistration, logSystemEvent } from '@/lib/db/queries/activity'
import { withRateLimit } from '@/lib/auth/rate-limit'

export const POST = withRateLimit(
  'registration',
  async (request: NextRequest) => {
    const startTime = Date.now()
    let studentId: string | undefined

    const ipAddress =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'

    const userAgent = request.headers.get('user-agent') || 'unknown'

    try {
      // ------------------------------------------------------------
      // 1. Read request
      // ------------------------------------------------------------
      const body = await request.json()

      console.log('========== PUBLIC REGISTRATION ==========')
      console.log('Registration request received')
      console.log('Body:', {
        ...body,
        password: undefined,
      })

      // ------------------------------------------------------------
      // 2. Validate request
      // ------------------------------------------------------------
      const parsed = studentSchema.safeParse(body)

      if (!parsed.success) {
        console.error(
          'Registration validation failed:',
          parsed.error.flatten().fieldErrors
        )

        return NextResponse.json(
          {
            error: 'Validation failed',
            details: parsed.error.flatten().fieldErrors,
          },
          { status: 400 }
        )
      }

      console.log('Validation passed')

      // ------------------------------------------------------------
      // 3. Create student
      // ------------------------------------------------------------
      console.log('Creating student in database...')

      const student = await createStudent({
        ...parsed.data,
        registrationSource: 'public',
      })

      if (!student) {
        throw new Error('createStudent returned no student')
      }

      studentId = student.id

      console.log('Student created successfully:', student.id)

      // ------------------------------------------------------------
      // 4. Log registration activity
      // ------------------------------------------------------------
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
        )

        console.log('Registration activity logged')
      } catch (activityError) {
        // Activity logging must NOT prevent registration.
        console.error(
          'Failed to log registration activity:',
          activityError
        )
      }

      // ------------------------------------------------------------
      // 5. Return success
      // ------------------------------------------------------------
      console.log('========== REGISTRATION SUCCESS ==========')

      return NextResponse.json(
        {
          success: true,
          student,
        },
        { status: 201 }
      )
    } catch (error: unknown) {
      console.error('========== REGISTRATION ERROR ==========')
      console.error('Student ID:', studentId)
      console.error('Error:', error)

      // ------------------------------------------------------------
      // Determine error type
      // ------------------------------------------------------------
      let errorType = 'unknown_error'

      if (error instanceof z.ZodError) {
        errorType = 'validation_error'

        console.error(
          'Zod validation errors:',
          error.flatten().fieldErrors
        )
      } else if (
        error instanceof Prisma.PrismaClientKnownRequestError
      ) {
        errorType = 'prisma_known_error'

        console.error('Prisma error code:', error.code)
        console.error('Prisma error meta:', error.meta)

        if (error.code === 'P2002') {
          errorType = 'duplicate_record'
        }
      } else if (
        error instanceof Prisma.PrismaClientValidationError
      ) {
        errorType = 'prisma_validation_error'

        console.error('Prisma validation error:', error.message)
      } else if (
        error instanceof Prisma.PrismaClientInitializationError
      ) {
        errorType = 'prisma_initialization_error'

        console.error(
          'Prisma initialization error:',
          error.message
        )
      } else if (error instanceof Error) {
        console.error('Error name:', error.name)
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
      }

      // ------------------------------------------------------------
      // Try logging the failure, but don't let logging hide
      // the original error.
      // ------------------------------------------------------------
      try {
        await logSystemEvent(
          'registration_failed',
          `Public registration failed: ${errorType}`,
          'warning',
          {
            errorType,
            studentId,
            source: 'public',
            ipAddress,
            userAgent,
            registrationDuration: Date.now() - startTime,
          }
        )
      } catch (activityError) {
        console.error(
          'Failed to log registration failure:',
          activityError
        )
      }

      // ------------------------------------------------------------
      // Validation error
      // ------------------------------------------------------------
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: error.flatten().fieldErrors,
          },
          { status: 400 }
        )
      }

      // ------------------------------------------------------------
      // Prisma duplicate error
      // ------------------------------------------------------------
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
      ) {
        if (error.code === 'P2002') {
          const target = error.meta?.target

          const fields = Array.isArray(target)
            ? target.join(', ')
            : String(target || 'field')

          return NextResponse.json(
            {
              error: `A student with this ${fields} already exists.`,
              code: 'DUPLICATE_RECORD',
            },
            { status: 409 }
          )
        }

        // TEMPORARY: expose Prisma error so we can diagnose
        // the production problem.
        return NextResponse.json(
          {
            error: 'Database error',
            code: error.code,
            details: error.meta ?? null,
            message: error.message,
          },
          { status: 500 }
        )
      }

      // ------------------------------------------------------------
      // Prisma validation error
      // ------------------------------------------------------------
      if (
        error instanceof Prisma.PrismaClientValidationError
      ) {
        return NextResponse.json(
          {
            error: 'Database validation error',
            message: error.message,
          },
          { status: 500 }
        )
      }

      // ------------------------------------------------------------
      // Prisma initialization / connection error
      // ------------------------------------------------------------
      if (
        error instanceof Prisma.PrismaClientInitializationError
      ) {
        return NextResponse.json(
          {
            error: 'Database connection error',
            message: error.message,
          },
          { status: 500 }
        )
      }

      // ------------------------------------------------------------
      // Generic error
      // ------------------------------------------------------------
      if (error instanceof Error) {
        return NextResponse.json(
          {
            error: 'Server error',
            message: error.message,
          },
          { status: 500 }
        )
      }

      return NextResponse.json(
        {
          error: 'An unexpected error occurred.',
        },
        { status: 500 }
      )
    }
  }
)