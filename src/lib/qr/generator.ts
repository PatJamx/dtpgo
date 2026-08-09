import QRCode from 'qrcode';

export interface QRGeneratorOptions {
  width?: number;
  margin?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

/**
 * Generate the QR code used by the attendance scanner.
 *
 * IMPORTANT:
 * The QR payload is intentionally just the student ID.
 *
 * Example:
 * 202512345
 *
 * Do not put logos, URLs, JSON, or additional text inside this QR.
 * This makes the QR much easier for html5-qrcode to detect reliably.
 */
export async function generateQRCodeDataURL(
  studentId: string,
  options: QRGeneratorOptions = {}
): Promise<string> {
  const normalizedStudentId = String(studentId ?? '').trim();

  if (!normalizedStudentId) {
    throw new Error('Cannot generate QR code: student ID is empty.');
  }

  const width = options.width ?? 600;
  const margin = options.margin ?? 4;
  const errorCorrectionLevel =
    options.errorCorrectionLevel ?? 'H';

  return QRCode.toDataURL(normalizedStudentId, {
    type: 'image/png',
    width,
    margin,
    errorCorrectionLevel,

    // Keep QR modules crisp.
    scale: 10,

    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });
}

/**
 * Generate a QR code as a Buffer.
 *
 * Useful for API routes that return image/png.
 */
export async function generateQRCodeBuffer(
  studentId: string,
  options: QRGeneratorOptions = {}
): Promise<Buffer> {
  const dataUrl = await generateQRCodeDataURL(
    studentId,
    options
  );

  const base64 = dataUrl.split(',')[1];

  if (!base64) {
    throw new Error('Failed to generate QR code data.');
  }

  return Buffer.from(base64, 'base64');
}