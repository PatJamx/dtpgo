'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from 'html5-qrcode';

import {
  Camera,
  CheckCircle,
  AlertCircle,
  Scan,
  X,
  Upload,
} from 'lucide-react';

import { toast } from 'sonner';

interface ScanResult {
  firstName?: string;
  lastName?: string;
  studentIdNumber?: string;
  scanType?: string;
  isDuplicate?: boolean;
  isError?: boolean;
  errorMessage?: string;
  timestamp: Date;
}

interface QRScannerProps {
  onScan: (
    qrData: string,
    updateResult: (data: Partial<ScanResult>) => void
  ) => Promise<void>;

  onError?: (error: string) => void;

  onCleanup?: () => void;

  onScanningStateChange?: (
    isScanning: boolean
  ) => void;
}

export function QRScanner({
  onScan,
  onError,
  onCleanup,
  onScanningStateChange,
}: QRScannerProps) {
  /*
   * --------------------------------------------------
   * Refs
   * --------------------------------------------------
   */

  const scannerRef = useRef<Html5Qrcode | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const isMountedRef = useRef(true);

  const processingRef = useRef(false);

  const lastDecodedValueRef =
    useRef<string>('');

  const lastDecodedAtRef =
    useRef<number>(0);

  /*
   * --------------------------------------------------
   * State
   * --------------------------------------------------
   */

  const [isScanning, setIsScanning] =
    useState(false);

  const [cameraId, setCameraId] =
    useState<string | null>(null);

  const [cameraError, setCameraError] =
    useState<string | null>(null);

  const [isProcessing, setIsProcessing] =
    useState(false);

  const [scanAnimation, setScanAnimation] =
    useState(false);

  const [lastScanResult, setLastScanResult] =
    useState<ScanResult | null>(null);

  /*
   * --------------------------------------------------
   * Update scanning state
   * --------------------------------------------------
   */

  const updateScanningState = useCallback(
    (value: boolean) => {
      if (!isMountedRef.current) {
        return;
      }

      setIsScanning(value);

      onScanningStateChange?.(value);
    },
    [onScanningStateChange]
  );

  /*
   * --------------------------------------------------
   * Update scan result
   * --------------------------------------------------
   */

  const updateScanResult = useCallback(
    (data: Partial<ScanResult>) => {
      if (!isMountedRef.current) {
        return;
      }

      setLastScanResult((previous) => ({
        timestamp:
          previous?.timestamp ?? new Date(),
        ...previous,
        ...data,
      }));
    },
    []
  );

  /*
   * --------------------------------------------------
   * Select best camera
   * --------------------------------------------------
   */

  const selectBestCamera = useCallback(
    (
      cameras: Array<{
        id: string;
        label: string;
      }>
    ) => {
      if (!cameras.length) {
        return null;
      }

      /*
       * Prefer rear/environment camera.
       */
      const rearCamera = cameras.find(
        (camera) => {
          const label =
            camera.label.toLowerCase();

          return (
            label.includes('back') ||
            label.includes('rear') ||
            label.includes('environment')
          );
        }
      );

      return rearCamera ?? cameras[0];
    },
    []
  );

  /*
   * --------------------------------------------------
   * Load available cameras
   * --------------------------------------------------
   */

  useEffect(() => {
    isMountedRef.current = true;

    const loadCameras = async () => {
      try {
        const cameras =
          await Html5Qrcode.getCameras();

        if (!cameras || cameras.length === 0) {
          throw new Error(
            'No camera was found on this device.'
          );
        }

        const selectedCamera =
          selectBestCamera(cameras);

        if (!selectedCamera) {
          throw new Error(
            'No usable camera was found.'
          );
        }

        if (isMountedRef.current) {
          setCameraId(selectedCamera.id);
          setCameraError(null);
        }
      } catch (error) {
        console.error(
          'Failed to get cameras:',
          error
        );

        if (isMountedRef.current) {
          const message =
            error instanceof Error
              ? error.message
              : 'Unable to access camera.';

          setCameraError(message);
        }
      }
    };

    loadCameras();

    return () => {
      isMountedRef.current = false;
    };
  }, [selectBestCamera]);

  /*
   * --------------------------------------------------
   * Extract student ID from QR data
   * --------------------------------------------------
   *
   * New QR format:
   *
   *     202412345
   *
   * Older JSON format:
   *
   *     {
   *       "studentId": "202412345"
   *     }
   *
   * We support both.
   */

  const extractStudentId = useCallback(
    (decodedText: string): string => {
      const value =
        decodedText.trim();

      if (!value) {
        throw new Error(
          'The QR code is empty.'
        );
      }

      /*
       * First try JSON.
       */
      try {
        const parsed: unknown =
          JSON.parse(value);

        if (
          parsed &&
          typeof parsed === 'object' &&
          'studentId' in parsed
        ) {
          const studentId =
            (parsed as {
              studentId?: unknown;
            }).studentId;

          if (
            typeof studentId === 'string' &&
            studentId.trim()
          ) {
            return studentId.trim();
          }

          if (
            typeof studentId === 'number'
          ) {
            return String(studentId);
          }
        }
      } catch {
        /*
         * Not JSON.
         *
         * That's okay.
         */
      }

      /*
       * Support URLs containing studentId.
       *
       * Example:
       *
       * /scan?studentId=123456
       */
      try {
        if (
          value.startsWith('http://') ||
          value.startsWith('https://')
        ) {
          const url =
            new URL(value);

          const studentId =
            url.searchParams.get(
              'studentId'
            );

          if (studentId?.trim()) {
            return studentId.trim();
          }

          const id =
            url.searchParams.get('id');

          if (id?.trim()) {
            return id.trim();
          }
        }
      } catch {
        /*
         * Not a URL.
         */
      }

      /*
       * New QR format:
       *
       * plain student ID.
       */
      return value;
    },
    []
  );

  /*
   * --------------------------------------------------
   * Handle decoded QR
   * --------------------------------------------------
   */

  const handleDecodedText = useCallback(
    async (decodedText: string) => {
      const value =
        decodedText.trim();

      if (!value) {
        return;
      }

      /*
       * Prevent duplicate processing when the
       * same QR remains in front of the camera.
       */
      const now = Date.now();

      if (
        value === lastDecodedValueRef.current &&
        now - lastDecodedAtRef.current < 3000
      ) {
        return;
      }

      /*
       * Prevent concurrent API requests.
       */
      if (processingRef.current) {
        return;
      }

      lastDecodedValueRef.current = value;
      lastDecodedAtRef.current = now;

      processingRef.current = true;

      if (!isMountedRef.current) {
        processingRef.current = false;
        return;
      }

      setIsProcessing(true);
      setScanAnimation(true);

      setLastScanResult({
        timestamp: new Date(),
        isError: false,
        isDuplicate: false,
      });

      try {
        console.log(
          '[QR] Raw decoded value:',
          value
        );

        /*
         * Extract the actual student ID.
         */
        const studentId =
          extractStudentId(value);

        console.log(
          '[QR] Extracted student ID:',
          studentId
        );

        if (!studentId) {
          throw new Error(
            'The QR code does not contain a student ID.'
          );
        }

        /*
         * Send the student ID to the parent.
         */
        await onScan(
          studentId,
          updateScanResult
        );

        console.log(
          '[QR] Attendance processing completed.'
        );

        if (isMountedRef.current) {
          setLastScanResult(
            (previous) => ({
              timestamp:
                previous?.timestamp ??
                new Date(),
              ...previous,
            })
          );
        }
      } catch (error) {
        console.error(
          '[QR] Processing error:',
          error
        );

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to process QR code.';

        if (isMountedRef.current) {
          setLastScanResult({
            timestamp: new Date(),
            isError: true,
            isDuplicate: false,
            errorMessage: message,
          });

          toast.error(
            'QR Scan Failed',
            {
              description: message,
            }
          );
        }

        onError?.(message);
      } finally {
        processingRef.current =
          false;

        if (isMountedRef.current) {
          setIsProcessing(false);

          window.setTimeout(() => {
            if (isMountedRef.current) {
              setScanAnimation(false);
            }
          }, 500);
        }
      }
    },
    [
      extractStudentId,
      onError,
      onScan,
      updateScanResult,
    ]
  );

  /*
   * --------------------------------------------------
   * Stop existing scanner
   * --------------------------------------------------
   */

  const destroyScanner =
    useCallback(async () => {
      const scanner =
        scannerRef.current;

      if (!scanner) {
        return;
      }

      try {
        await scanner.stop();
      } catch (error) {
        console.warn(
          '[QR] Scanner stop warning:',
          error
        );
      }

      try {
        scanner.clear();
      } catch (error) {
        console.warn(
          '[QR] Scanner clear warning:',
          error
        );
      }

      scannerRef.current = null;
    }, []);

  /*
   * --------------------------------------------------
   * Start scanner with selected camera
   * --------------------------------------------------
   */

  const startScannerWithCamera =
    useCallback(
      async (
        selectedCameraId: string
      ) => {
        /*
         * Destroy previous scanner first.
         */
        await destroyScanner();

        /*
         * Clear old result.
         */
        if (isMountedRef.current) {
          setCameraError(null);
        }

        /*
         * Create new scanner.
         */
        const scanner =
          new Html5Qrcode(
            'qr-reader',
            {
              verbose: false,
            }
          );

        scannerRef.current =
          scanner;

        console.log(
          '[QR] Starting camera:',
          selectedCameraId
        );

        /*
         * Start camera.
         */
        await scanner.start(
          selectedCameraId,
          {
            fps: 10,

            /*
             * A 280x280 scanning area works well
             * for QR codes on phones and monitors.
             */
            qrbox: {
              width: 280,
              height: 280,
            },

            aspectRatio: 1.0,

            /*
             * ONLY scan QR codes.
             */
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
            ],

            /*
             * Allow mirrored cameras to work.
             */
            disableFlip: false,
          },

          /*
           * SUCCESS CALLBACK
           */
          async (decodedText) => {
            await handleDecodedText(
              decodedText
            );
          },

          /*
           * FRAME ERROR CALLBACK
           *
           * IMPORTANT:
           *
           * "No MultiFormat Readers..."
           * is NOT a camera failure.
           *
           * It simply means that particular
           * video frame did not contain a readable QR.
           */
          (errorMessage) => {
            if (
              errorMessage?.includes(
                'No MultiFormat Readers were able to detect the code'
              )
            ) {
              return;
            }

            if (
              errorMessage?.includes(
                'QR code parse error'
              )
            ) {
              return;
            }

            console.debug(
              '[QR] Frame scan:',
              errorMessage
            );
          }
        );

        if (isMountedRef.current) {
          updateScanningState(true);
        }

        console.log(
          '[QR] Scanner started successfully.'
        );
      },
      [
        destroyScanner,
        handleDecodedText,
        updateScanningState,
      ]
    );

  /*
   * --------------------------------------------------
   * Start scanner
   * --------------------------------------------------
   */

  const startScanning =
    useCallback(async () => {
      if (isScanning) {
        return;
      }

      try {
        setCameraError(null);

        let selectedCameraId =
          cameraId;

        /*
         * If we don't already know the camera,
         * request camera list.
         */
        if (!selectedCameraId) {
          const cameras =
            await Html5Qrcode.getCameras();

          if (
            !cameras ||
            cameras.length === 0
          ) {
            throw new Error(
              'No camera was found on this device.'
            );
          }

          const selectedCamera =
            selectBestCamera(cameras);

          if (!selectedCamera) {
            throw new Error(
              'No usable camera was found.'
            );
          }

          selectedCameraId =
            selectedCamera.id;

          if (isMountedRef.current) {
            setCameraId(
              selectedCameraId
            );
          }
        }

        await startScannerWithCamera(
          selectedCameraId
        );
      } catch (error) {
        console.error(
          '[QR] Failed to start scanner:',
          error
        );

        const message =
          error instanceof Error
            ? error.message
            : 'Failed to start camera.';

        if (isMountedRef.current) {
          setCameraError(message);
        }

        updateScanningState(false);

        toast.error(
          'Unable to start scanner',
          {
            description: message,
          }
        );

        onError?.(message);
      }
    }, [
      cameraId,
      isScanning,
      onError,
      selectBestCamera,
      startScannerWithCamera,
      updateScanningState,
    ]);

  /*
   * --------------------------------------------------
   * Stop scanner
   * --------------------------------------------------
   */

  const stopScanning =
    useCallback(async () => {
      try {
        await destroyScanner();
      } finally {
        processingRef.current =
          false;

        if (isMountedRef.current) {
          updateScanningState(false);
          setIsProcessing(false);
          setScanAnimation(false);
        }

        onCleanup?.();
      }
    }, [
      destroyScanner,
      onCleanup,
      updateScanningState,
    ]);

  /*
   * --------------------------------------------------
   * Scan QR from image
   * --------------------------------------------------
   */

  const handleFileSelected =
    useCallback(
      async (
        event: React.ChangeEvent<HTMLInputElement>
      ) => {
        const file =
          event.target.files?.[0];

        if (!file) {
          return;
        }

        try {
          setIsProcessing(true);
          setCameraError(null);

          /*
           * Stop live camera first.
           */
          await destroyScanner();

          /*
           * Create temporary scanner for image.
           */
          const imageScanner =
            new Html5Qrcode(
              'qr-reader',
              {
                verbose: false,
              }
            );

          scannerRef.current =
            imageScanner;

          console.log(
            '[QR] Reading image:',
            file.name
          );

          const decodedText =
            await imageScanner.scanFile(
              file,
              true
            );

          console.log(
            '[QR] Image decoded:',
            decodedText
          );

          /*
           * Process exactly like a camera QR.
           */
          await handleDecodedText(
            decodedText
          );

          /*
           * Image scanner is no longer
           * needed.
           */
          try {
            imageScanner.clear();
          } catch {
            // Ignore.
          }

          scannerRef.current = null;
        } catch (error) {
          console.error(
            '[QR] Image scan failed:',
            error
          );

          const message =
            error instanceof Error
              ? error.message
              : 'Could not read the QR image.';

          toast.error(
            'QR image could not be read',
            {
              description:
                'Make sure the entire QR code is visible, sharp, and not cropped.',
            }
          );

          onError?.(message);

          try {
            scannerRef.current?.clear();
          } catch {
            // Ignore.
          }

          scannerRef.current = null;
        } finally {
          if (
            fileInputRef.current
          ) {
            fileInputRef.current.value =
              '';
          }

          if (
            isMountedRef.current
          ) {
            setIsProcessing(false);
          }
        }
      },
      [
        destroyScanner,
        handleDecodedText,
        onError,
      ]
    );

  /*
   * --------------------------------------------------
   * Component cleanup
   * --------------------------------------------------
   */

  useEffect(() => {
    return () => {
      isMountedRef.current =
        false;

      processingRef.current =
        false;

      const scanner =
        scannerRef.current;

      scannerRef.current = null;

      if (scanner) {
        scanner
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scanner.clear();
            } catch {
              // Ignore.
            }
          });
      }
    };
  }, []);

  /*
   * --------------------------------------------------
   * Optional global cleanup
   * --------------------------------------------------
   */

  useEffect(() => {
    const cleanup =
      async () => {
        await stopScanning();
      };

    const windowWithCleanup =
      window as Window & {
        __qrScannerCleanup?: () => Promise<void>;
      };

    windowWithCleanup.__qrScannerCleanup =
      cleanup;

    return () => {
      delete windowWithCleanup.__qrScannerCleanup;
    };
  }, [stopScanning]);

  /*
   * --------------------------------------------------
   * Render
   * --------------------------------------------------
   */

  return (
    <div className="space-y-4">

      {/* -------------------------------------------- */}
      {/* Scanner */}
      {/* -------------------------------------------- */}

      <div
        className={[
          'relative overflow-hidden rounded-2xl',
          'border border-gray-200 dark:border-gray-700',
          'bg-black',
          'shadow-xl',
          scanAnimation
            ? 'ring-4 ring-green-400/50'
            : '',
        ].join(' ')}
      >

        <div
          id="qr-reader"
          className="w-full min-h-[360px]"
        />

        {/* Ready overlay */}
        {!isScanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-950/95 text-white p-6 text-center">

            <div className="mb-4 rounded-full bg-yellow-400/10 p-5">
              <Scan className="h-10 w-10 text-yellow-400" />
            </div>

            <h3 className="text-xl font-bold">
              Ready to Scan
            </h3>

            <p className="mt-2 max-w-md text-sm text-gray-300">
              Start the scanner and place
              the student's QR code inside
              the scanning frame.
            </p>

          </div>
        )}

        {/* Scanning guide */}
        {isScanning && (
          <div className="pointer-events-none absolute inset-0">

            <div className="absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border-2 border-yellow-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.18)]" />

            <div
              className="absolute left-1/2 top-1/2 h-0.5 w-[260px] -translate-x-1/2 bg-yellow-400 shadow-lg"
              style={{
                animation:
                  'qr-scan-line 2s ease-in-out infinite',
              }}
            />

          </div>
        )}

      </div>

      {/* -------------------------------------------- */}
      {/* Camera error */}
      {/* -------------------------------------------- */}

      {cameraError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">

          <div className="flex gap-3">

            <AlertCircle className="h-5 w-5 flex-shrink-0" />

            <div>

              <p className="font-semibold">
                Camera unavailable
              </p>

              <p className="mt-1 text-sm">
                {cameraError}
              </p>

              <p className="mt-2 text-xs opacity-80">
                You can also use "Scan Image"
                to test a QR code image.
              </p>

            </div>

          </div>

        </div>
      )}

      {/* -------------------------------------------- */}
      {/* Last scan result */}
      {/* -------------------------------------------- */}

      {lastScanResult && (
        <div
          className={[
            'rounded-xl border p-4',
            lastScanResult.isError
              ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30'
              : lastScanResult.isDuplicate
                ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/30'
                : 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30',
          ].join(' ')}
        >

          <div className="flex items-start gap-3">

            {lastScanResult.isError ? (
              <AlertCircle className="h-6 w-6 text-red-600" />
            ) : lastScanResult.isDuplicate ? (
              <AlertCircle className="h-6 w-6 text-yellow-600" />
            ) : (
              <CheckCircle className="h-6 w-6 text-green-600" />
            )}

            <div className="min-w-0 flex-1">

              <p className="font-semibold">

                {lastScanResult.isError
                  ? 'Scan Failed'
                  : lastScanResult.isDuplicate
                    ? 'Duplicate Scan'
                    : 'Scan Successful'}

              </p>

              {lastScanResult.errorMessage && (
                <p className="mt-1 text-sm">
                  {lastScanResult.errorMessage}
                </p>
              )}

              {lastScanResult.firstName && (
                <p className="mt-1 text-lg font-bold">
                  {lastScanResult.firstName}{' '}
                  {lastScanResult.lastName}
                </p>
              )}

              {lastScanResult.studentIdNumber && (
                <p className="text-sm opacity-75">
                  Student ID:{' '}
                  {lastScanResult.studentIdNumber}
                </p>
              )}

              {lastScanResult.scanType && (
                <p className="text-sm opacity-75">
                  Scan type:{' '}
                  {lastScanResult.scanType}
                </p>
              )}

            </div>

          </div>

        </div>
      )}

      {/* -------------------------------------------- */}
      {/* Buttons */}
      {/* -------------------------------------------- */}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

        {!isScanning ? (
          <button
            type="button"
            onClick={startScanning}
            disabled={isProcessing}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 font-semibold text-black transition hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2"
          >
            <Camera className="h-5 w-5" />

            Start Scanner
          </button>
        ) : (
          <button
            type="button"
            onClick={stopScanning}
            disabled={isProcessing}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-red-500 px-4 font-semibold text-white transition hover:bg-red-600 disabled:opacity-50 sm:col-span-2"
          >
            <X className="h-5 w-5" />

            Stop Scanner
          </button>
        )}

        <button
          type="button"
          onClick={() =>
            fileInputRef.current?.click()
          }
          disabled={isProcessing}
          className="flex h-12 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-4 font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
        >
          <Upload className="h-5 w-5" />

          Scan Image
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
        />

      </div>

      {/* -------------------------------------------- */}
      {/* Scanning tips */}
      {/* -------------------------------------------- */}

      {isScanning &&
        !isProcessing && (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200">

            <p className="font-semibold">
              Scanning tips
            </p>

            <ul className="mt-2 list-disc space-y-1 pl-5">

              <li>
                Display the student's QR
                code at full brightness.
              </li>

              <li>
                Keep the entire QR code
                visible.
              </li>

              <li>
                Hold the camera steady.
              </li>

              <li>
                Avoid glare and reflections.
              </li>

              <li>
                Move closer or farther
                away until the QR fits
                inside the frame.
              </li>

            </ul>

          </div>
        )}

      {/* -------------------------------------------- */}
      {/* Processing indicator */}
      {/* -------------------------------------------- */}

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">

          <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />

          Processing attendance...

        </div>
      )}

      {/* -------------------------------------------- */}
      {/* Animation */}
      {/* -------------------------------------------- */}

      <style jsx>{`
        @keyframes qr-scan-line {
          0% {
            transform: translate(-50%, -120px);
          }

          50% {
            transform: translate(-50%, 120px);
          }

          100% {
            transform: translate(-50%, -120px);
          }
        }
      `}</style>

    </div>
  );
}

export default QRScanner;