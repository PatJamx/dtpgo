'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { useSearchParams } from 'next/navigation';

import { QRScanner } from './QRScanner';
import { ManualInput } from './ManualInput';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

import { Button } from '@/components/ui/button';

import {
  Alert,
  AlertDescription,
} from '@/components/ui/alert';

import { Badge } from '@/components/ui/badge';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Users,
  AlertCircle,
  CheckCircle2,
  Camera,
  Scan,
  Keyboard,
} from 'lucide-react';

import { toast } from 'sonner';

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface Session {
  id: string;
  name: string;
  description?: string;
  eventId: string;

  event: {
    id: string;
    name: string;
    location?: string;
    startDate: string;
    endDate: string;
  };

  timeInStart: string;
  timeInEnd: string;

  timeOutStart?: string;
  timeOutEnd?: string;

  isActive: boolean;

  _count: {
    attendance: number;
  };
}

interface ScanResultUpdate {
  firstName?: string;
  lastName?: string;
  studentIdNumber?: string;
  scanType?: string;
  isDuplicate?: boolean;
  isError?: boolean;
  errorMessage?: string;
}

/* -------------------------------------------------------------------------- */
/* Component                                                                  */
/* -------------------------------------------------------------------------- */

export function ScanPage() {
  const searchParams = useSearchParams();

  /* ------------------------------------------------------------------------ */
  /* State                                                                    */
  /* ------------------------------------------------------------------------ */

  const [selectedSession, setSelectedSession] =
    useState<Session | null>(null);

  const [sessions, setSessions] =
    useState<Session[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [scanMode, setScanMode] =
    useState<'select' | 'scan'>('select');

  const [inputMode, setInputMode] =
    useState<'qr' | 'manual'>('qr');

  const [attendanceStats, setAttendanceStats] =
    useState({
      totalScanned: 0,
      lastScanTime: null as Date | null,
    });

  const [showLeaveDialog, setShowLeaveDialog] =
    useState(false);

  const [isScanningActive, setIsScanningActive] =
    useState(false);

  const pendingNavigationRef =
    useRef<'sessions' | 'back' | null>(null);

  const sessionIdFromUrl =
    searchParams.get('sessionId');

  /* ------------------------------------------------------------------------ */
  /* Load sessions                                                            */
  /* ------------------------------------------------------------------------ */

  const loadSessions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        '/api/organizer/sessions',
        {
          method: 'GET',
          cache: 'no-store',
        }
      );

      if (!response.ok) {
        throw new Error(
          'Failed to load sessions.'
        );
      }

      const data =
        await response.json();

      setSessions(
        Array.isArray(data.sessions)
          ? data.sessions
          : []
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to load sessions.';

      console.error(
        'Failed to load sessions:',
        err
      );

      setError(message);

      toast.error(
        'Error loading sessions',
        {
          description: message,
        }
      );
    } finally {
      setLoading(false);
    }
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Initial load                                                             */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  /* ------------------------------------------------------------------------ */
  /* Auto-select session from URL                                             */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (
      !sessionIdFromUrl ||
      sessions.length === 0
    ) {
      return;
    }

    const session =
      sessions.find(
        (item) =>
          item.id === sessionIdFromUrl
      );

    if (!session) {
      return;
    }

    setSelectedSession(session);
    setScanMode('scan');
  }, [
    sessionIdFromUrl,
    sessions,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Scanner cleanup helper                                                   */
  /* ------------------------------------------------------------------------ */

  const cleanupScanner = useCallback(
    async () => {
      const globalWindow =
        window as typeof window & {
          __qrScannerCleanup?: () =>
            | void
            | Promise<void>;
        };

      if (
        globalWindow.__qrScannerCleanup
      ) {
        try {
          await globalWindow.__qrScannerCleanup();
        } catch (err) {
          console.warn(
            'QR scanner cleanup warning:',
            err
          );
        }
      }

      setIsScanningActive(false);
    },
    []
  );

  /* ------------------------------------------------------------------------ */
  /* Before-unload protection                                                 */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    const handleBeforeUnload = (
      event: BeforeUnloadEvent
    ) => {
      if (!isScanningActive) {
        return;
      }

      event.preventDefault();

      event.returnValue =
        'You are currently scanning QR codes. Are you sure you want to leave?';
    };

    window.addEventListener(
      'beforeunload',
      handleBeforeUnload
    );

    return () => {
      window.removeEventListener(
        'beforeunload',
        handleBeforeUnload
      );
    };
  }, [isScanningActive]);

  /* ------------------------------------------------------------------------ */
  /* Cleanup on unmount                                                       */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    return () => {
      const globalWindow =
        window as typeof window & {
          __qrScannerCleanup?: () =>
            | void
            | Promise<void>;
        };

      if (
        globalWindow.__qrScannerCleanup
      ) {
        void globalWindow.__qrScannerCleanup();
      }
    };
  }, []);

  /* ------------------------------------------------------------------------ */
  /* Session selection                                                        */
  /* ------------------------------------------------------------------------ */

  const handleSessionSelect = useCallback(
    (session: Session) => {
      setSelectedSession(session);
      setScanMode('scan');
      setInputMode('qr');

      const url =
        new URL(window.location.href);

      url.searchParams.set(
        'sessionId',
        session.id
      );

      window.history.replaceState(
        {},
        '',
        url.toString()
      );
    },
    []
  );

  /* ------------------------------------------------------------------------ */
  /* Back to sessions                                                         */
  /* ------------------------------------------------------------------------ */

  const handleBackToSessions =
    useCallback(() => {
      if (isScanningActive) {
        pendingNavigationRef.current =
          'sessions';

        setShowLeaveDialog(true);

        return;
      }

      setSelectedSession(null);
      setScanMode('select');

      const url =
        new URL(window.location.href);

      url.searchParams.delete(
        'sessionId'
      );

      window.history.replaceState(
        {},
        '',
        url.toString()
      );
    }, [isScanningActive]);

  /* ------------------------------------------------------------------------ */
  /* Confirm leave                                                            */
  /* ------------------------------------------------------------------------ */

  const handleConfirmLeave =
    useCallback(async () => {
      await cleanupScanner();

      setShowLeaveDialog(false);

      const navigation =
        pendingNavigationRef.current;

      pendingNavigationRef.current = null;

      if (
        navigation === 'sessions'
      ) {
        setSelectedSession(null);
        setScanMode('select');
        setInputMode('qr');

        const url =
          new URL(window.location.href);

        url.searchParams.delete(
          'sessionId'
        );

        window.history.replaceState(
          {},
          '',
          url.toString()
        );

        return;
      }

      if (
        navigation === 'back'
      ) {
        window.history.back();
      }
    }, [cleanupScanner]);

  /* ------------------------------------------------------------------------ */
  /* Cancel leave                                                             */
  /* ------------------------------------------------------------------------ */

  const handleCancelLeave =
    useCallback(() => {
      setShowLeaveDialog(false);
      pendingNavigationRef.current =
        null;
    }, []);

  /* ------------------------------------------------------------------------ */
  /* Scanner state                                                            */
  /* ------------------------------------------------------------------------ */

  const handleScannerCleanup =
    useCallback(() => {
      setIsScanningActive(false);
    }, []);

  const handleScanningStateChange =
    useCallback(
      (scanning: boolean) => {
        setIsScanningActive(
          scanning
        );
      },
      []
    );

  /* ------------------------------------------------------------------------ */
  /* Switch input mode                                                        */
  /* ------------------------------------------------------------------------ */

  const handleInputModeChange =
    useCallback(
      async (
        mode: 'qr' | 'manual'
      ) => {
        if (
          mode !== 'qr' &&
          isScanningActive
        ) {
          await cleanupScanner();
        }

        setInputMode(mode);
      },
      [
        cleanupScanner,
        isScanningActive,
      ]
    );

  /* ------------------------------------------------------------------------ */
  /* Determine time-in / time-out                                             */
  /* ------------------------------------------------------------------------ */

  const getScanType = useCallback(
    (session: Session) => {
      const now = new Date();

      const timeInStart =
        new Date(
          session.timeInStart
        );

      const timeInEnd =
        new Date(
          session.timeInEnd
        );

      const timeOutStart =
        session.timeOutStart
          ? new Date(
              session.timeOutStart
            )
          : null;

      const timeOutEnd =
        session.timeOutEnd
          ? new Date(
              session.timeOutEnd
            )
          : null;

      /*
       * Time-out has priority if the current
       * time is inside the time-out window.
       */
      if (
        timeOutStart &&
        timeOutEnd &&
        now >= timeOutStart &&
        now <= timeOutEnd
      ) {
        return 'time_out';
      }

      /*
       * Otherwise use the time-in window.
       */
      if (
        now >= timeInStart &&
        now <= timeInEnd
      ) {
        return 'time_in';
      }

      /*
       * Preserve the existing application
       * behavior: default to time-in outside
       * the configured windows.
       */
      return 'time_in';
    },
    []
  );

  /* ------------------------------------------------------------------------ */
  /* Extract student ID from QR data                                         */
  /* ------------------------------------------------------------------------ */

  const extractStudentId =
    useCallback(
      (qrData: string): string => {
        const value =
          qrData.trim();

        if (!value) {
          throw new Error(
            'The QR code is empty.'
          );
        }

        /*
         * First try JSON.
         *
         * Supports:
         *
         * {
         *   "studentId": "2024-00123"
         * }
         *
         * and:
         *
         * {
         *   "studentIdNumber": "2024-00123"
         * }
         */
        try {
          const parsed =
            JSON.parse(value);

          if (
            parsed &&
            typeof parsed ===
              'object' &&
            !Array.isArray(parsed)
          ) {
            const object =
              parsed as Record<
                string,
                unknown
              >;

            const possibleId =
              object.studentId ??
              object.studentIdNumber;

            if (
              typeof possibleId ===
                'string' &&
              possibleId.trim()
            ) {
              return possibleId.trim();
            }

            if (
              typeof possibleId ===
                'number'
            ) {
              return String(
                possibleId
              ).trim();
            }
          }
        } catch {
          /*
           * Not JSON.
           *
           * This is completely normal for the
           * new QR format because the QR contains
           * only the student ID.
           */
        }

        /*
         * Plain-text QR.
         */
        return value;
      },
      []
    );

  /* ------------------------------------------------------------------------ */
  /* Record attendance                                                        */
  /* ------------------------------------------------------------------------ */

  const recordAttendance =
    useCallback(
      async (
        studentId: string,
        updateScanResult: (
          data: ScanResultUpdate
        ) => void,
        source:
          | 'qr'
          | 'manual'
      ) => {
        if (!selectedSession) {
          throw new Error(
            'No attendance session is selected.'
          );
        }

        const normalizedStudentId =
          studentId.trim();

        if (!normalizedStudentId) {
          throw new Error(
            'Please provide a student ID.'
          );
        }

        console.log(
          `🔍 Processing ${source} attendance:`,
          normalizedStudentId
        );

        /* ------------------------------------------------------------------ */
        /* Determine scan type                                                 */
        /* ------------------------------------------------------------------ */

        const scanType =
          getScanType(
            selectedSession
          );

        console.log(
          '🕐 Scan type:',
          scanType
        );

        const toastId =
          source === 'qr'
            ? 'scan-processing'
            : 'manual-scan-processing';

        toast.loading(
          'Processing scan...',
          {
            id: toastId,
            duration: Infinity,
            description:
              `Recording ${
                scanType ===
                'time_in'
                  ? 'Time-In'
                  : 'Time-Out'
              } for ${normalizedStudentId}`,
          }
        );

        try {
          /* --------------------------------------------------------------- */
          /* API request                                                      */
          /* --------------------------------------------------------------- */

          const response =
            await fetch(
              '/api/organizer/attendance',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json',
                },
                body: JSON.stringify({
                  sessionId:
                    selectedSession.id,

                  eventId:
                    selectedSession.eventId,

                  studentId:
                    normalizedStudentId,

                  scanType,
                }),
              }
            );

          console.log(
            '📥 Attendance response:',
            response.status,
            response.statusText
          );

          /* --------------------------------------------------------------- */
          /* Parse response safely                                            */
          /* --------------------------------------------------------------- */

          let responseData:
            | Record<string, any>
            | null = null;

          try {
            responseData =
              await response.json();
          } catch {
            responseData = null;
          }

          /* --------------------------------------------------------------- */
          /* Duplicate                                                        */
          /* --------------------------------------------------------------- */

          if (
            response.status === 409
          ) {
            toast.dismiss(
              toastId
            );

            const studentInfo =
              responseData?.student ??
              {};

            updateScanResult({
              firstName:
                studentInfo.firstName ??
                'Student',

              lastName:
                studentInfo.lastName ??
                normalizedStudentId,

              studentIdNumber:
                studentInfo.studentIdNumber ??
                normalizedStudentId,

              scanType,

              isDuplicate: true,

              isError: false,
            });

            toast.warning(
              'Already Recorded',
              {
                description:
                  responseData?.message ??
                  'This student has already been recorded for this session.',

                duration: 4000,
              }
            );

            console.log(
              '⚠️ Duplicate attendance handled.'
            );

            /*
             * IMPORTANT:
             *
             * Do NOT throw here.
             *
             * A duplicate is an expected attendance
             * result, not a scanner failure.
             */
            return;
          }

          /* --------------------------------------------------------------- */
          /* Other API errors                                                 */
          /* --------------------------------------------------------------- */

          if (!response.ok) {
            toast.dismiss(
              toastId
            );

            const message =
              responseData?.message ??
              responseData?.error ??
              'Failed to record attendance.';

            throw new Error(
              message
            );
          }

          /* --------------------------------------------------------------- */
          /* Successful attendance                                            */
          /* --------------------------------------------------------------- */

          toast.dismiss(
            toastId
          );

          const result =
            responseData ?? {};

          console.log(
            '✅ Attendance recorded:',
            result
          );

          const student =
            result.student;

          updateScanResult({
            firstName:
              student?.firstName ??
              'Student',

            lastName:
              student?.lastName ??
              '',

            studentIdNumber:
              student?.studentIdNumber ??
              normalizedStudentId,

            scanType,

            isDuplicate: false,

            isError: false,

            errorMessage:
              undefined,
          });

          /* --------------------------------------------------------------- */
          /* Update stats                                                     */
          /* --------------------------------------------------------------- */

          setAttendanceStats(
            (previous) => ({
              totalScanned:
                previous.totalScanned +
                1,

              lastScanTime:
                new Date(),
            })
          );

          /* --------------------------------------------------------------- */
          /* Success toast                                                    */
          /* --------------------------------------------------------------- */

          const scanTypeText =
            scanType ===
            'time_in'
              ? 'Time-In'
              : 'Time-Out';

          const studentName =
            student?.firstName &&
            student?.lastName
              ? `${student.firstName} ${student.lastName}`
              : normalizedStudentId;

          toast.success(
            `Successfully ${scanTypeText}!`,
            {
              description:
                `${studentName} - ${
                  student?.studentIdNumber ??
                  normalizedStudentId
                }`,

              duration: 4000,
            }
          );
        } catch (error) {
          toast.dismiss(
            toastId
          );

          const message =
            error instanceof Error
              ? error.message
              : 'Failed to record attendance.';

          console.error(
            `❌ ${source} attendance error:`,
            error
          );

          toast.error(
            'Recording Failed',
            {
              description:
                message,
            }
          );

          throw error;
        }
      },
      [
        getScanType,
        selectedSession,
      ]
    );

  /* ------------------------------------------------------------------------ */
  /* QR scan handler                                                          */
  /* ------------------------------------------------------------------------ */

  const handleQRScan =
    useCallback(
      async (
        qrData: string,
        updateScanResult: (
          data: ScanResultUpdate
        ) => void
      ) => {
        console.log(
          '📷 Raw QR decoded text:',
          qrData
        );

        /*
         * QRScanner has already successfully
         * decoded the QR.
         *
         * We now extract the student ID.
         */
        let studentId: string;

        try {
          studentId =
            extractStudentId(
              qrData
            );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Invalid QR code.';

          updateScanResult({
            isError: true,
            isDuplicate: false,
            errorMessage:
              message,
          });

          toast.error(
            'Invalid QR Code',
            {
              description:
                message,
            }
          );

          throw error;
        }

        console.log(
          '🎓 Student ID extracted:',
          studentId
        );

        await recordAttendance(
          studentId,
          updateScanResult,
          'qr'
        );
      },
      [
        extractStudentId,
        recordAttendance,
      ]
    );

  /* ------------------------------------------------------------------------ */
  /* Manual input handler                                                     */
  /* ------------------------------------------------------------------------ */

  const handleManualScan =
    useCallback(
      async (
        studentIdNumber: string,
        updateScanResult: (
          data: ScanResultUpdate
        ) => void
      ) => {
        const studentId =
          studentIdNumber.trim();

        if (!studentId) {
          const error =
            new Error(
              'Please enter a student ID number.'
            );

          toast.error(
            'Invalid Input',
            {
              description:
                error.message,
            }
          );

          throw error;
        }

        await recordAttendance(
          studentId,
          updateScanResult,
          'manual'
        );
      },
      [recordAttendance]
    );

  /* ------------------------------------------------------------------------ */
  /* Loading state                                                            */
  /* ------------------------------------------------------------------------ */

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />

            <div>
              <h2 className="text-lg font-semibold">
                Loading Sessions...
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Please wait while we load your
                available sessions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Error state                                                              */
  /* ------------------------------------------------------------------------ */

  if (error) {
    return (
      <div className="flex min-h-[400px] items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              Error Loading Sessions
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />

              <AlertDescription>
                {error}
              </AlertDescription>
            </Alert>

            <Button
              type="button"
              onClick={() => {
                void loadSessions();
              }}
              className="w-full"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Scan mode                                                                */
  /* ------------------------------------------------------------------------ */

  if (
    scanMode === 'scan' &&
    selectedSession
  ) {
    return (
      <>
        <div className="mx-auto w-full max-w-5xl space-y-4 p-4 sm:p-6">

          {/* ---------------------------------------------------------------- */}
          {/* Desktop Stats                                                    */}
          {/* ---------------------------------------------------------------- */}

          <div className="hidden sm:flex justify-end">
            <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-2 shadow-sm">
              <div className="rounded-lg bg-yellow-500/10 p-2">
                <Users className="h-5 w-5 text-yellow-600" />
              </div>

              <div>
                <div className="text-xl font-bold">
                  {
                    attendanceStats.totalScanned
                  }
                </div>

                <div className="text-xs text-muted-foreground">
                  Scanned Today
                </div>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Mobile Stats                                                     */}
          {/* ---------------------------------------------------------------- */}

          <div className="fixed bottom-4 right-4 z-50 sm:hidden">
            <div className="rounded-xl border border-white/20 bg-gradient-to-br from-yellow-500 to-amber-500 p-3 shadow-lg">
              <div className="text-center">
                <div className="text-xl font-bold text-white">
                  {
                    attendanceStats.totalScanned
                  }
                </div>

                <div className="text-[9px] font-medium uppercase tracking-wider text-white/90">
                  Today
                </div>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* Session Header                                                   */}
          {/* ---------------------------------------------------------------- */}

          <Card className="w-full border-border bg-card/50 backdrop-blur-xl">
            <CardContent className="p-4 sm:p-6">

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex min-w-0 flex-1 items-center gap-3">

                  <Button
                    type="button"
                    onClick={
                      handleBackToSessions
                    }
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>

                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-lg sm:text-xl">
                      {
                        selectedSession
                          .event
                          .name
                      }
                    </CardTitle>

                    <CardDescription className="truncate">
                      {
                        selectedSession.name
                      }
                    </CardDescription>
                  </div>
                </div>

                <Badge
                  variant={
                    selectedSession.isActive
                      ? 'default'
                      : 'secondary'
                  }
                  className={
                    selectedSession.isActive
                      ? 'border-emerald-500/30 bg-emerald-500/20 text-emerald-600'
                      : ''
                  }
                >
                  {selectedSession.isActive ? (
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                  ) : (
                    <Clock className="mr-1 h-3 w-3" />
                  )}

                  {selectedSession.isActive
                    ? 'Active'
                    : 'Inactive'}
                </Badge>
              </div>

              {/* ------------------------------------------------------------ */}
              {/* Input Mode                                                    */}
              {/* ------------------------------------------------------------ */}

              <div className="mt-4 flex justify-center">
                <div className="flex items-center gap-1 rounded-xl bg-muted p-1">

                  <button
                    type="button"
                    onClick={() => {
                      void handleInputModeChange(
                        'qr'
                      );
                    }}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                      inputMode === 'qr'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Scan className="h-4 w-4" />
                    QR Scan
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleInputModeChange(
                        'manual'
                      );
                    }}
                    className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                      inputMode === 'manual'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Keyboard className="h-4 w-4" />
                    Manual
                  </button>

                </div>
              </div>

              {/* ------------------------------------------------------------ */}
              {/* Session Information                                          */}
              {/* ------------------------------------------------------------ */}

              <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3 sm:text-sm">

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4 flex-shrink-0" />

                  <span className="truncate">
                    {new Date(
                      selectedSession.timeInStart
                    ).toLocaleDateString(
                      'en-PH',
                      {
                        timeZone:
                          'Asia/Manila',
                        month: 'short',
                        day: 'numeric',
                      }
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 flex-shrink-0" />

                  <span className="truncate">
                    {new Date(
                      selectedSession.timeInStart
                    ).toLocaleTimeString(
                      'en-PH',
                      {
                        timeZone:
                          'Asia/Manila',
                        hour: 'numeric',
                        minute:
                          '2-digit',
                        hour12: true,
                      }
                    )}
                  </span>
                </div>

                {selectedSession.event
                  .location && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="h-4 w-4 flex-shrink-0" />

                    <span className="truncate">
                      {
                        selectedSession
                          .event
                          .location
                      }
                    </span>
                  </div>
                )}

              </div>

              {/* ------------------------------------------------------------ */}
              {/* Mobile Stats                                                  */}
              {/* ------------------------------------------------------------ */}

              <div className="mt-3 rounded-lg border border-border bg-muted p-2 sm:hidden">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />

                    <span className="font-medium">
                      Scanned
                    </span>
                  </div>

                  <span className="font-semibold">
                    {
                      attendanceStats.totalScanned
                    }
                  </span>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* ---------------------------------------------------------------- */}
          {/* Scanner / Manual Interface                                      */}
          {/* ---------------------------------------------------------------- */}

          <Card className="w-full border-border shadow-lg">
            <CardContent className="p-4 sm:p-6">

              {inputMode === 'qr' ? (
                <QRScanner
                  onCleanup={
                    handleScannerCleanup
                  }
                  onScanningStateChange={
                    handleScanningStateChange
                  }
                  onScan={
                    handleQRScan
                  }
                  onError={(
                    scannerError
                  ) => {
                    console.error(
                      'Scanner error:',
                      scannerError
                    );

                    /*
                     * IMPORTANT:
                     *
                     * html5-qrcode reports
                     * "No MultiFormat Readers..."
                     * for normal camera frames that
                     * don't contain a QR.
                     *
                     * The updated QRScanner filters
                     * those internally, so this handler
                     * is only for actual scanner errors.
                     */
                    toast.error(
                      'Scanner Error',
                      {
                        description:
                          scannerError,
                      }
                    );
                  }}
                />
              ) : (
                <ManualInput
                  sessionId={
                    selectedSession.id
                  }
                  eventId={
                    selectedSession.eventId
                  }
                  onScan={
                    handleManualScan
                  }
                  onError={(
                    manualError
                  ) => {
                    console.error(
                      'Manual input error:',
                      manualError
                    );

                    toast.error(
                      'Input Error',
                      {
                        description:
                          manualError,
                      }
                    );
                  }}
                  onScanningStateChange={
                    handleScanningStateChange
                  }
                />
              )}

            </CardContent>
          </Card>

        </div>

        {/* ------------------------------------------------------------------ */}
        {/* Leave Confirmation                                                 */}
        {/* ------------------------------------------------------------------ */}

        <Dialog
          open={showLeaveDialog}
          onOpenChange={
            setShowLeaveDialog
          }
        >
          <DialogContent className="sm:max-w-md">

            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <Camera className="h-5 w-5" />
                Stop Scanning?
              </DialogTitle>

              <DialogDescription>
                You are currently scanning QR
                codes. If you leave now, the
                scanner will be stopped.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="gap-2">

              <Button
                type="button"
                variant="outline"
                onClick={
                  handleCancelLeave
                }
              >
                Continue Scanning
              </Button>

              <Button
                type="button"
                onClick={() => {
                  void handleConfirmLeave();
                }}
                className="bg-red-500 text-white hover:bg-red-600"
              >
                Stop & Leave
              </Button>

            </DialogFooter>

          </DialogContent>
        </Dialog>
      </>
    );
  }

  /* ------------------------------------------------------------------------ */
  /* Session Selection Mode                                                   */
  /* ------------------------------------------------------------------------ */

  return (
    <>
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">

        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">
            Select a Session
          </h1>

          <p className="mt-1 text-muted-foreground">
            Choose an active session to start
            scanning QR codes.
          </p>
        </div>

        {sessions.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center p-10 text-center">

              <div className="mb-4 rounded-full bg-muted p-4">
                <Scan className="h-8 w-8 text-muted-foreground" />
              </div>

              <h2 className="text-lg font-semibold">
                No Sessions Available
              </h2>

              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                There are currently no sessions
                available for attendance scanning.
              </p>

              <Button
                type="button"
                onClick={() => {
                  void loadSessions();
                }}
                className="mt-5"
              >
                Refresh Sessions
              </Button>

            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

            {sessions.map(
              (session) => (
                <Card
                  key={session.id}
                  className="transition-shadow hover:shadow-lg"
                >
                  <CardHeader>

                    <div className="flex items-start justify-between gap-3">

                      <div className="min-w-0">
                        <CardTitle className="truncate">
                          {
                            session.event
                              .name
                          }
                        </CardTitle>

                        <CardDescription className="mt-1">
                          {session.name}
                        </CardDescription>
                      </div>

                      <Badge
                        variant={
                          session.isActive
                            ? 'default'
                            : 'secondary'
                        }
                        className={
                          session.isActive
                            ? 'bg-emerald-500 text-white'
                            : ''
                        }
                      >
                        {session.isActive
                          ? 'Active'
                          : 'Inactive'}
                      </Badge>

                    </div>

                  </CardHeader>

                  <CardContent className="space-y-4">

                    <div className="space-y-2 text-sm text-muted-foreground">

                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />

                        <span>
                          {new Date(
                            session.timeInStart
                          ).toLocaleDateString(
                            'en-PH',
                            {
                              timeZone:
                                'Asia/Manila',
                              month:
                                'short',
                              day: 'numeric',
                              year:
                                'numeric',
                            }
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />

                        <span>
                          {new Date(
                            session.timeInStart
                          ).toLocaleTimeString(
                            'en-PH',
                            {
                              timeZone:
                                'Asia/Manila',
                              hour:
                                'numeric',
                              minute:
                                '2-digit',
                              hour12:
                                true,
                            }
                          )}

                          {' – '}

                          {new Date(
                            session.timeInEnd
                          ).toLocaleTimeString(
                            'en-PH',
                            {
                              timeZone:
                                'Asia/Manila',
                              hour:
                                'numeric',
                              minute:
                                '2-digit',
                              hour12:
                                true,
                            }
                          )}
                        </span>
                      </div>

                      {session.event
                        .location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />

                          <span className="truncate">
                            {
                              session
                                .event
                                .location
                            }
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />

                        <span>
                          {
                            session
                              ._count
                              .attendance
                          }{' '}
                          attendance records
                        </span>
                      </div>

                    </div>

                    <Button
                      type="button"
                      className="w-full"
                      disabled={
                        !session.isActive
                      }
                      onClick={() => {
                        handleSessionSelect(
                          session
                        );
                      }}
                    >
                      <Scan className="mr-2 h-4 w-4" />

                      {session.isActive
                        ? 'Start Scanning'
                        : 'Session Inactive'}
                    </Button>

                  </CardContent>
                </Card>
              )
            )}

          </div>
        )}

      </div>

      {/* -------------------------------------------------------------------- */}
      {/* Leave Dialog                                                         */}
      {/* -------------------------------------------------------------------- */}

      <Dialog
        open={showLeaveDialog}
        onOpenChange={
          setShowLeaveDialog
        }
      >
        <DialogContent className="sm:max-w-md">

          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Camera className="h-5 w-5" />
              Stop Scanning?
            </DialogTitle>

            <DialogDescription>
              You are currently scanning QR codes.
              If you leave now, the scanner will be
              stopped.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">

            <Button
              type="button"
              variant="outline"
              onClick={
                handleCancelLeave
              }
            >
              Continue Scanning
            </Button>

            <Button
              type="button"
              onClick={() => {
                void handleConfirmLeave();
              }}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Stop & Leave
            </Button>

          </DialogFooter>

        </DialogContent>
      </Dialog>
    </>
  );
}

export default ScanPage;