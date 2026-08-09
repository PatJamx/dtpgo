import { generateQRCodeBuffer } from './generator';

export interface StudentInfo {
  studentId: string;
}

/**
 * Generate the student attendance QR code.
 *
 * IMPORTANT:
 * This intentionally does NOT add a logo or overlay.
 * The QR needs to remain completely machine-readable.
 */
export async function createBrandedQRCode(
  studentInfo: StudentInfo
): Promise<Buffer> {
  if (!studentInfo?.studentId) {
    throw new Error('Student ID is required.');
  }

  return generateQRCodeBuffer(studentInfo.studentId, {
    width: 800,
    margin: 5,
    errorCorrectionLevel: 'H',
  });
}