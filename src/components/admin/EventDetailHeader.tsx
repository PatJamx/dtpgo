'use client';

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, MapPin, Clock, Users, Edit, Plus, MoreHorizontal } from 'lucide-react';
import { EventWithDetails } from '@/lib/types/event';
import { EventStatusBadge } from './EventStatusBadge';
import { cn } from '@/lib/utils';

interface EventDetailHeaderProps {
  event: EventWithDetails;
  onEdit: () => void;
  onCreateSession: () => void;
  onMoreActions?: () => void;
  className?: string;
}

export function EventDetailHeader({
  event,
  onEdit,
  onCreateSession,
  onMoreActions,
  className,
}: EventDetailHeaderProps) {
   const counts = event._count ?? {
    sessions: 0,
    attendance: 0,
    organizerAssignments: 0,
  };
  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEventDuration = () => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    const diffMs = end.getTime() - start.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffHours === 0) return `${diffMinutes} minutes`;
    if (diffMinutes === 0) return `${diffHours} hours`;
    return `${diffHours}h ${diffMinutes}m`;
  };

  const isCurrentlyActive = () => {
    const now = new Date();
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    return now >= start && now <= end;
  };

  return (
    <Card className={cn("border-0 shadow-sm dark:bg-gray-800 dark:border-gray-700", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100" title={event.name}>
                {event.name}
              </h1>
              <div className="flex items-center gap-3">
                <EventStatusBadge
                  isActive={event.isActive}
                  sessionCount={counts.sessions}
                  organizerCount={counts.organizerAssignments}
                  startDate={event.startDate}
                  endDate={event.endDate}
                  variant="detailed"
                />
              </div>
            </div>

            {event.description && (
              <p className="text-gray-600 dark:text-gray-400 text-base md:text-lg mb-3 max-w-3xl line-clamp-2" title={event.description}>
                {event.description}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  <Calendar className="h-5 w-5 text-gray-400" />
                </div>
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Date & Time</p>
                  <div className="space-y-1.5">
                    <p className="text-sm text-gray-600 dark:text-gray-400" title={formatDate(event.startDate)}>
                      {formatDate(event.startDate)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      {formatTime(event.startDate)} - {formatTime(event.endDate)}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Duration: {getEventDuration()}</p>
                  </div>
                </div>
              </div>

              {event.location && (
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    <MapPin className="h-5 w-5 text-gray-400" />
                  </div>
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Location</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400" title={event.location}>{event.location}</p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  <Clock className="h-5 w-5 text-gray-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Sessions</p>
                  <div className="space-y-1.5">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {counts.sessions} session{counts.sessions !== 1 ? 's' : ''}
                    </p>
                    {counts.sessions > 0 && (
                      <Badge variant="outline" className="text-xs dark:border-gray-600 dark:text-gray-300">
                        {counts.attendance} attendance records
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-1">
                  <Users className="h-5 w-5 text-gray-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Organizers</p>
                  <div className="space-y-1.5">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {counts.organizerAssignments} assigned
                    </p>
                    {isCurrentlyActive() && counts.organizerAssignments > 0 && (
                      <Badge variant="default" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700">
                        Active
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 ml-4 flex-shrink-0 w-40">
            <Button onClick={onEdit} variant="outline" size="sm" className="w-full justify-start">
              <Edit className="h-4 w-4 mr-2" />
              Edit Event
            </Button>
            <Button onClick={onCreateSession} size="sm" className="w-full justify-start">
              <Plus className="h-4 w-4 mr-2" />
              Create Session
            </Button>
            {onMoreActions && (
              <Button onClick={onMoreActions} variant="ghost" size="sm" className="w-full justify-start text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100">
                <MoreHorizontal className="h-4 w-4 mr-2" />
                More Actions
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-3 px-4 bg-gray-50 dark:bg-gray-700 rounded-lg border dark:border-gray-600">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Created:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {new Date(event.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-600 dark:text-gray-400">Last Updated:</span>
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {new Date(event.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
            <EventStatusBadge
              isActive={event.isActive}
              sessionCount={counts.sessions}
              organizerCount={counts.organizerAssignments}
              startDate={event.startDate}
              endDate={event.endDate}
              variant="compact"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
