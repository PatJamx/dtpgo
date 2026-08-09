import { NextRequest, NextResponse } from 'next/server';
// import { z } from 'zod';
import { prisma } from '@/lib/db/client';
import { authenticateApiRequest, ApiAuthResult } from '@/lib/auth/api-auth';
import { logActivity } from '@/lib/db/queries/activity';
import { createEventSchema } from '@/lib/validations/event';

// Validation schema for event updates
// const updateEventSchema = createEventSchema.partial().extend({
//   isActive: z.boolean().optional(),
// });

export async function GET(request: NextRequest) {
  try {
    // Authenticate admin request
    const authResult = await authenticateApiRequest(request, {
      requiredRole: 'admin',
      requireAuth: true,
    });

    if (!authResult.success) {
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: authResult.statusCode || 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('isActive');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Build where clause
    const whereClause: Record<string, unknown> = {};
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { location: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== null && isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    // Build orderBy clause
    const orderBy: Record<string, string> = {};
    orderBy[sortBy] = sortOrder;

    // Get total count for pagination
    const totalCount = await prisma.event.count({ where: whereClause });

    // Get events with pagination
    const events = await prisma.event.findMany({
      where: whereClause,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        sessions: {
          select: {
            id: true,
            name: true,
            isActive: true,
            timeInStart: true,
            timeInEnd: true,
            timeOutStart: true,
            timeOutEnd: true,
          },
        },
        organizerAssignments: {
          include: {
            organizer: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
              },
            },
          },
        },
        _count: {
          select: {
            attendance: true,
            sessions: true,
            organizerAssignments: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      events,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1,
      },
    });

  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to fetch events',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  let authResult: ApiAuthResult | undefined;
  let body: Record<string, unknown> | undefined;

  try {
    // Authenticate admin request
    authResult = await authenticateApiRequest(request, {
      requiredRole: 'admin',
      requireAuth: true,
    });

    if (!authResult.success) {
      await logActivity({
        type: 'system_event',
        action: 'event_creation_failed',
        description: `Unauthorized attempt to create event`,
        severity: 'warning',
        category: 'authentication',
        metadata: { ipAddress, userAgent, error: authResult.error },
        userId: undefined,
      });
      return NextResponse.json(
        { error: authResult.error || 'Authentication failed' },
        { status: authResult.statusCode || 401 }
      );
    }

    if (!authResult.user) {
      await logActivity({
        type: 'system_event',
        action: 'event_creation_failed',
        description: `No user found in authentication result for event creation`,
        severity: 'error',
        category: 'authentication',
        metadata: { ipAddress, userAgent },
      });
      return NextResponse.json(
        { error: 'User not found in authentication result' },
        { status: 401 }
      );
    }

    const adminUser = authResult.user;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Validate request body
    const validationResult = createEventSchema.safeParse(body!);
    if (!validationResult.success) {
      console.error('Event creation validation failed:', {
        body,
        errors: validationResult.error.issues
      });
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const { name, description, startDate, endDate, location } = validationResult.data;

    // Validate date logic
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (start >= end) {
      return NextResponse.json(
        { error: 'End date must be after start date' },
        { status: 400 }
      );
    }

    // Check for duplicate event names
    const existingEvent = await prisma.event.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        isActive: true,
      },
    });

    if (existingEvent) {
      await logActivity({
        type: 'system_event',
        action: 'event_creation_failed',
        description: `Attempt to create duplicate event: ${name}`,
        severity: 'warning',
        category: 'data_management',
        metadata: { createdBy: adminUser.id, eventName: name, ipAddress, userAgent },
        userId: adminUser.id,
      });
      return NextResponse.json(
        { error: 'An active event with this name already exists' },
        { status: 409 }
      );
    }

    // Create event
    const newEvent = await prisma.event.create({
      data: {
        name,
        description,
        startDate: start,
        endDate: end,
        location,
        createdBy: adminUser.id,
      },
      include: {
        sessions: true,
        organizerAssignments: {
          include: {
            organizer: {
              select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
              },
            },
          },
        },
        _count: {
          select: {
            attendance: true,
            sessions: true,
            organizerAssignments: true,
          },
        },
      },
    });

    await logActivity({
      type: 'admin_action',
      action: 'event_created',
      description: `Admin ${adminUser.email} created new event: ${name}`,
      severity: 'info',
      category: 'data_management',
      metadata: {
        eventId: newEvent.id,
        eventName: name,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        location,
        creationDuration: Date.now() - startTime,
        ipAddress,
        userAgent,
      },
      userId: adminUser.id,
    });

    return NextResponse.json(
      { 
        success: true,
        message: 'Event created successfully',
        event: newEvent,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error creating event:', error);
    await logActivity({
      type: 'system_event',
      action: 'event_creation_failed',
      description: `Failed to create event: ${error instanceof Error ? error.message : 'Unknown error'}`,
      severity: 'error',
      category: 'system',
      metadata: {
        createdBy: authResult?.user?.id,
        eventData: body,
        errorMessage: error instanceof Error ? error.message : 'Unknown',
        creationDuration: Date.now() - startTime,
        ipAddress,
        userAgent,
      },
      userId: authResult?.user?.id,
    });
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'Failed to create event',
      },
      { status: 500 }
    );
  }
}
