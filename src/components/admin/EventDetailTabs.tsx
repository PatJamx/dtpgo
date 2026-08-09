'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Clock, Users, BarChart3, Plus, Eye, Edit, Trash2, Calendar, CheckCircle } from 'lucide-react';
import { EventWithDetails } from '@/lib/types/event';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { AdminGuard } from '@/components/auth/AdminGuard';
import { useAttendance } from '@/hooks/use-attendance';

interface EventDetailTabsProps {
  event: EventWithDetails;
  onCreateSession: () => void;
  onViewSession: (sessionId: string) => void;
  onEditSession: (sessionId: string) => void;
  onDeleteSession: (sessionId: string) => void;
  onAssignOrganizer: () => void;
  onViewOrganizer: (organizerId: string) => void;
  onRemoveOrganizer: (organizerId: string) => void;
  className?: string;
}

export function EventDetailTabs({
  event,
  onCreateSession,
  onViewSession,
  onEditSession,
  onDeleteSession,
  onAssignOrganizer,
  onViewOrganizer,
  onRemoveOrganizer,
  className,
}: EventDetailTabsProps) {
  const [activeTab, setActiveTab] = useState('sessions');

  const counts = {
    sessions: event._count?.sessions ?? event.sessions.length,
    organizerAssignments: event._count?.organizerAssignments ?? event.organizerAssignments.length,
    attendance: event._count?.attendance ?? 0,
  };
  
  // Fetch attendance data for the attendance tab
  const { loading, kpis, rows, perSessionAggregates } = useAttendance(event.id);

  // Initialize tab from URL (?tab=...) and keep in sync with back/forward
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }

    const onPopState = () => {
      const sp = new URLSearchParams(window.location.search);
      const t = sp.get('tab');
      if (t && t !== activeTab) {
        setActiveTab(t);
      }
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', value);
    // Push a new history entry so back/forward preserves tab state
    window.history.pushState({}, '', url.toString());
  };

  const formatDate = (date: string | Date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const formatTime = (date: string | Date) => new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const getSessionStatus = (session: { timeInStart: string | Date; timeInEnd: string | Date; timeOutEnd: string | Date | null }) => {
    const now = new Date();
    const timeInStart = new Date(session.timeInStart);
    const timeInEnd = new Date(session.timeInEnd);
    const timeOutEnd = session.timeOutEnd ? new Date(session.timeOutEnd) : null;
    if (now < timeInStart) return 'upcoming';
    if (now >= timeInStart && now <= timeInEnd) return 'time-in';
    if (now > timeInEnd && timeOutEnd && now <= timeOutEnd) return 'time-out';
    if (timeOutEnd && now > timeOutEnd) return 'ended';
    return 'unknown';
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'upcoming': return 'secondary';
      case 'time-in': return 'default';
      case 'time-out': return 'outline';
      case 'ended': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusDisplayName = (status: string) => {
    switch (status) {
      case 'upcoming': return 'Upcoming';
      case 'time-in': return 'Time-In Active';
      case 'time-out': return 'Time-Out Active';
      case 'ended': return 'Ended';
      default: return 'Unknown';
    }
  };

  // Lazy attendance components (client-only)
  const AttendanceFilters = dynamic(() => import('@/components/admin/attendance/AttendanceFilters').then(m => m.AttendanceFilters), { ssr: false });
  const AttendanceKpis = dynamic(() => import('@/components/admin/attendance/AttendanceKpis').then(m => m.AttendanceKpis), { ssr: false });
  const AttendanceTable = dynamic(() => import('@/components/admin/attendance/AttendanceTable').then(m => m.AttendanceTable), { ssr: false });

  return (
    <div className={cn("space-y-6", className)}>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Sessions
            <Badge variant="secondary" className="ml-1">
              {counts.sessions}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="organizers" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Organizers
            <Badge variant="secondary" className="ml-1">
              {counts.organizerAssignments}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Attendance
          </TabsTrigger>
          <TabsTrigger value="statistics" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Statistics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Event Sessions</h3>
            {event.sessions.length > 0 && (
              <Button onClick={onCreateSession} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Create Session
              </Button>
            )}
          </div>

          {event.sessions.length === 0 ? (
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="text-center py-10">
                <Clock className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h4 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-2">No sessions created</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Create your first session to start tracking attendance.</p>
                <Button onClick={onCreateSession}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Session
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {event.sessions.map((session) => {
                const status = getSessionStatus(session);
                return (
                  <Card key={session.id} className="hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate" title={session.name}>{session.name}</h4>
                            <Badge variant={getStatusBadgeVariant(status)}>{getStatusDisplayName(status)}</Badge>
                          </div>
                          {session.description && (
                            <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2" title={session.description}>{session.description}</p>
                          )}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Time-In:</span>
                              <p className="font-medium dark:text-gray-200">{formatTime(session.timeInStart)} - {formatTime(session.timeInEnd)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Time-Out:</span>
                              <p className="font-medium dark:text-gray-200">
                                {session.timeOutStart ? formatTime(session.timeOutStart) : 'N/A'} - 
                                {session.timeOutEnd ? formatTime(session.timeOutEnd) : 'N/A'}
                              </p>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Date:</span>
                              <p className="font-medium dark:text-gray-200">{formatDate(session.timeInStart)}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">Status:</span>
                              <p className="font-medium dark:text-gray-200">{getStatusDisplayName(status)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => onViewSession(session.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => onEditSession(session.id)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => onDeleteSession(session.id)} className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="organizers" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Assigned Organizers</h3>
            <Button onClick={onAssignOrganizer} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Assign Organizer
            </Button>
          </div>

          {event.organizerAssignments.length === 0 ? (
            <Card className="dark:bg-gray-800 dark:border-gray-700">
              <CardContent className="text-center py-10">
                <Users className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h4 className="text-base font-medium text-gray-900 dark:text-gray-100 mb-2">No organizers assigned</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Assign organizers to manage this event and track attendance.</p>
                <Button onClick={onAssignOrganizer}>
                  <Plus className="h-4 w-4 mr-2" />
                  Assign First Organizer
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {event.organizerAssignments.map((assignment) => (
                <Card key={assignment.id} className="hover:shadow-md transition-shadow dark:bg-gray-800 dark:border-gray-700">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
                          <Users className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate" title={assignment.organizer.fullName}>{assignment.organizer.fullName}</h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate" title={assignment.organizer.email}>{assignment.organizer.email}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">Assigned {new Date(assignment.assignedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={assignment.organizer.isActive ? 'default' : 'secondary'}>
                          {assignment.organizer.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => onViewOrganizer(assignment.organizer.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => onRemoveOrganizer(assignment.organizer.id)} className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Attendance Tab (Admin only) */}
        <TabsContent value="attendance" className="space-y-4">
          <AdminGuard requiredRole="admin">
            <Suspense fallback={<div className="h-16 bg-gray-100 rounded animate-pulse" />}>
              <AttendanceFilters 
                sessions={event.sessions.map((s) => ({ id: s.id, name: s.name }))}
                eventId={event.id}
              />
            </Suspense>
            <Suspense fallback={<div className="h-24 bg-gray-100 rounded animate-pulse" />}>
              <AttendanceKpis loading={loading} data={kpis ?? undefined} perSessionAggregates={perSessionAggregates} />
            </Suspense>
            <Suspense fallback={<div className="h-24 bg-gray-100 rounded animate-pulse" />}>
              <AttendanceTable loading={loading} rows={rows} eventTimeZone={'Asia/Manila'} />
            </Suspense>
          </AdminGuard>
        </TabsContent>

        <TabsContent value="statistics" className="space-y-4">
          <h3 className="text-lg font-semibold">Event Statistics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{counts.sessions}</div>
                <p className="text-xs text-muted-foreground">{counts.sessions === 1 ? 'session' : 'sessions'} created</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Organizers</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{counts.organizerAssignments}</div>
                <p className="text-xs text-muted-foreground">{counts.organizerAssignments === 1 ? 'organizer' : 'organizers'} assigned</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Attendance</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{counts.attendance}</div>
                <p className="text-xs text-muted-foreground">{counts.attendance === 1 ? 'record' : 'records'} tracked</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Event Duration</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(() => {
                  const start = new Date(event.startDate);
                  const end = new Date(event.endDate);
                  const diffMs = end.getTime() - start.getTime();
                  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                  return `${diffHours}h`;
                })()}</div>
                <p className="text-xs text-muted-foreground">{formatDate(event.startDate)} - {formatDate(event.endDate)}</p>
              </CardContent>
            </Card>
          </div>
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader>
              <CardTitle className="dark:text-gray-100">Event Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Event Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Name:</span>
                      <span className="font-medium dark:text-gray-200">{event.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Status:</span>
                      <Badge variant={event.isActive ? 'default' : 'secondary'}>{event.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Location:</span>
                      <span className="font-medium dark:text-gray-200">{event.location || 'Not specified'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Created:</span>
                      <span className="font-medium dark:text-gray-200">{new Date(event.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Performance Metrics</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Session Coverage:</span>
                      <span className="font-medium dark:text-gray-200">{counts.sessions > 0 ? 'Good' : 'Needs Sessions'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Organizer Coverage:</span>
                      <span className="font-medium dark:text-gray-200">{counts.organizerAssignments > 0 ? 'Good' : 'Needs Organizers'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Data Collection:</span>
                      <span className="font-medium dark:text-gray-200">{counts.attendance > 0 ? 'Active' : 'No Data'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
