'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, Eye, Edit, Trash2 } from 'lucide-react';
import { EventWithDetails } from '@/lib/types/event';
import { cn } from '@/lib/utils';
import { EventStatusBadge } from './EventStatusBadge';
import { QuickOrganizerAssignment } from './QuickOrganizerAssignment';

interface EventsListProps {
  events: EventWithDetails[];
  selectedEventId: string | null;
  onEventSelect: (event: EventWithDetails) => void;
  onViewDetails: (event: EventWithDetails) => void;
  onEditEvent: (event: EventWithDetails) => void;
  onDeleteEvent: (event: EventWithDetails) => void;
  onAssignmentChange?: () => void;
  loading?: boolean;
  className?: string;
}

export function EventsList({
  events,
  selectedEventId,
  onEventSelect,
  onViewDetails,
  onEditEvent,
  onDeleteEvent,
  onAssignmentChange,
  loading,
  className,
}: EventsListProps) {
  if (loading) {
    return (
      <div className={cn('space-y-2', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className={cn('rounded-md border border-dashed border-gray-200 bg-gray-50 p-8 text-center dark:border-gray-700 dark:bg-gray-900/50', className)}>
        <p className="text-lg font-medium text-gray-900 dark:text-gray-100">No events found</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Get started by creating your first event.</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {events.map((event) => {
        const counts = {
          sessions: event._count?.sessions ?? event.sessions?.length ?? 0,
          organizerAssignments: event._count?.organizerAssignments ?? event.organizerAssignments?.length ?? 0,
        };

        return (
          <div
            key={event.id}
            onClick={() => onEventSelect(event)}
            className={cn(
              'border rounded-md p-3 cursor-pointer transition-shadow hover:shadow-sm bg-white dark:bg-gray-800 dark:border-gray-700',
              selectedEventId === event.id && 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate" title={event.name}>{event.name}</h4>
                  <EventStatusBadge
                    isActive={event.isActive}
                    sessionCount={counts.sessions}
                    organizerCount={counts.organizerAssignments}
                    startDate={event.startDate}
                    endDate={event.endDate}
                    variant="compact"
                  />
                </div>
                {event.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate" title={event.description}>{event.description}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1 min-w-0">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className="truncate" title={`${new Date(event.startDate).toLocaleDateString()} - ${new Date(event.endDate).toLocaleDateString()}`}>
                      {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  {event.location && (
                    <div className="flex items-center gap-1 min-w-0">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="truncate" title={event.location}>{event.location}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{counts.sessions} sessions</span>
                  </div>
                  <QuickOrganizerAssignment
                    eventId={event.id}
                    eventName={event.name}
                    assignedOrganizers={event.organizerAssignments.map(assignment => ({
                      assignmentId: assignment.id,
                      organizer: {
                        id: assignment.organizer.id,
                        email: assignment.organizer.email,
                        fullName: assignment.organizer.fullName,
                        role: assignment.organizer.role as 'admin' | 'organizer',
                        isActive: assignment.organizer.isActive,
                        lastLoginAt: null,
                      },
                      assignedAt: assignment.assignedAt instanceof Date ? assignment.assignedAt.toISOString() : assignment.assignedAt,
                    }))}
                    onAssignmentChange={onAssignmentChange}
                    className="ml-auto"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button aria-label="View event" variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); onViewDetails(event); }} className="h-8 w-8">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button aria-label="Edit event" variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); onEditEvent(event); }} className="h-8 w-8">
                  <Edit className="h-4 w-4" />
                </Button>
                <Button aria-label="Delete event" variant="outline" size="icon" onClick={(e) => { e.stopPropagation(); onDeleteEvent(event); }} className="h-8 w-8 text-red-600 hover:text-red-700">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
