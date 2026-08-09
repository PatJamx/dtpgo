import { AuthError } from '@supabase/supabase-js';

// Custom error types for authentication
export enum AuthErrorType {
  INVALID_CREDENTIALS = 'invalid_credentials',
  USER_NOT_FOUND = 'user_not_found',
  EMAIL_NOT_CONFIRMED = 'email_not_confirmed',
  WEAK_PASSWORD = 'weak_password',
  EMAIL_ALREADY_EXISTS = 'email_already_exists',
  NETWORK_ERROR = 'network_error',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SESSION_EXPIRED = 'session_expired',
  INSUFFICIENT_PERMISSIONS = 'insufficient_permissions',
  ACCOUNT_DISABLED = 'account_disabled',
  UNKNOWN_ERROR = 'unknown_error',
}

// User-friendly error messages
export const AUTH_ERROR_MESSAGES = {
  [AuthErrorType.INVALID_CREDENTIALS]: 'Invalid email or password. Please check your credentials and try again.',
  [AuthErrorType.USER_NOT_FOUND]: 'No account found with this email address.',
  [AuthErrorType.EMAIL_NOT_CONFIRMED]: 'Please check your email and click the confirmation link before signing in.',
  [AuthErrorType.WEAK_PASSWORD]: 'Password must be at least 8 characters long and contain uppercase, lowercase, and numbers.',
  [AuthErrorType.EMAIL_ALREADY_EXISTS]: 'An account with this email address already exists.',
  [AuthErrorType.NETWORK_ERROR]: 'Network error. Please check your connection and try again.',
  [AuthErrorType.RATE_LIMIT_EXCEEDED]: 'Too many attempts. Please wait a few minutes before trying again.',
  [AuthErrorType.SESSION_EXPIRED]: 'Your session has expired. Please sign in again.',
  [AuthErrorType.INSUFFICIENT_PERMISSIONS]: 'You do not have permission to access this resource.',
  [AuthErrorType.ACCOUNT_DISABLED]: 'Your account has been disabled. Please contact support.',
  [AuthErrorType.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.',
} as const;

// Error details interface
export interface AuthErrorDetails {
  type: AuthErrorType;
  message: string;
  originalError?: string;
  code?: string;
  retryAfter?: number;
}

/**
 * Parse Supabase Auth error and return user-friendly error details
 */
export function parseAuthError(error: AuthError | Error | unknown): AuthErrorDetails {
  // Handle Supabase Auth errors
  if (error && typeof error === 'object' && 'message' in error) {
    const authError = error as AuthError;
    const message = authError.message.toLowerCase();
    
    // Map Supabase error messages to our error types
    if (message.includes('invalid login credentials') || message.includes('invalid credentials')) {
      return {
        type: AuthErrorType.INVALID_CREDENTIALS,
        message: AUTH_ERROR_MESSAGES[AuthErrorType.INVALID_CREDENTIALS],
        originalError: authError.message,
        code: authError.status?.toString(),
      };
    }
    
    if (message.includes('user not found')) {
      return {
        type: AuthErrorType.USER_NOT_FOUND,
        message: AUTH_ERROR_MESSAGES[AuthErrorType.USER_NOT_FOUND],
        originalError: authError.message,
        code: authError.status?.toString(),
      };
    }
    
    if (message.includes('email not confirmed')) {
      return {
        type: AuthErrorType.EMAIL_NOT_CONFIRMED,
        message: AUTH_ERROR_MESSAGES[AuthErrorType.EMAIL_NOT_CONFIRMED],
        originalError: authError.message,
        code: authError.status?.toString(),
      };
    }
    
    if (message.includes('password') && message.includes('weak')) {
      return {
        type: AuthErrorType.WEAK_PASSWORD,
        message: AUTH_ERROR_MESSAGES[AuthErrorType.WEAK_PASSWORD],
        originalError: authError.message,
        code: authError.status?.toString(),
      };
    }
    
    if (message.includes('already registered') || message.includes('already exists')) {
      return {
        type: AuthErrorType.EMAIL_ALREADY_EXISTS,
        message: AUTH_ERROR_MESSAGES[AuthErrorType.EMAIL_ALREADY_EXISTS],
        originalError: authError.message,
        code: authError.status?.toString(),
      };
    }
    
    if (message.includes('network') || message.includes('connection')) {
      return {
        type: AuthErrorType.NETWORK_ERROR,
        message: AUTH_ERROR_MESSAGES[AuthErrorType.NETWORK_ERROR],
        originalError: authError.message,
        code: authError.status?.toString(),
      };
    }
    
    if (message.includes('rate limit') || message.includes('too many')) {
      return {
        type: AuthErrorType.RATE_LIMIT_EXCEEDED,
        message: AUTH_ERROR_MESSAGES[AuthErrorType.RATE_LIMIT_EXCEEDED],
        originalError: authError.message,
        code: authError.status?.toString(),
      };
    }
    
    if (message.includes('session') && message.includes('expired')) {
      return {
        type: AuthErrorType.SESSION_EXPIRED,
        message: AUTH_ERROR_MESSAGES[AuthErrorType.SESSION_EXPIRED],
        originalError: authError.message,
        code: authError.status?.toString(),
      };
    }
    
    if (message.includes('permission') || message.includes('unauthorized')) {
      return {
        type: AuthErrorType.INSUFFICIENT_PERMISSIONS,
        message: AUTH_ERROR_MESSAGES[AuthErrorType.INSUFFICIENT_PERMISSIONS],
        originalError: authError.message,
        code: authError.status?.toString(),
      };
    }
    
    if (message.includes('disabled') || message.includes('suspended')) {
      return {
        type: AuthErrorType.ACCOUNT_DISABLED,
        message: AUTH_ERROR_MESSAGES[AuthErrorType.ACCOUNT_DISABLED],
        originalError: authError.message,
        code: authError.status?.toString(),
      };
    }
  }
  
  // Handle generic errors
  if (error instanceof Error) {
    return {
      type: AuthErrorType.UNKNOWN_ERROR,
      message: AUTH_ERROR_MESSAGES[AuthErrorType.UNKNOWN_ERROR],
      originalError: error.message,
    };
  }
  
  // Handle unknown error types
  return {
    type: AuthErrorType.UNKNOWN_ERROR,
    message: AUTH_ERROR_MESSAGES[AuthErrorType.UNKNOWN_ERROR],
    originalError: String(error),
  };
}

/**
 * Get user-friendly error message for display
 */
export function getAuthErrorMessage(error: AuthError | Error | unknown): string {
  const errorDetails = parseAuthError(error);
  return errorDetails.message;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: AuthError | Error | unknown): boolean {
  const errorDetails = parseAuthError(error);
  
  return [
    AuthErrorType.NETWORK_ERROR,
    AuthErrorType.UNKNOWN_ERROR,
  ].includes(errorDetails.type);
}

/**
 * Get retry delay in milliseconds
 */
export function getRetryDelay(error: AuthError | Error | unknown): number {
  const errorDetails = parseAuthError(error);
  
  switch (errorDetails.type) {
    case AuthErrorType.RATE_LIMIT_EXCEEDED:
      return errorDetails.retryAfter ? errorDetails.retryAfter * 1000 : 60000; // 1 minute default
    case AuthErrorType.NETWORK_ERROR:
      return 5000; // 5 seconds
    case AuthErrorType.UNKNOWN_ERROR:
      return 10000; // 10 seconds
    default:
      return 0; // No retry
  }
}

/**
 * Log authentication errors for monitoring
 */
export function logAuthError(
  error: AuthError | Error | unknown,
  context: {
    action: string;
    userId?: string;
    ipAddress?: string;
    userAgent?: string;
  }
): void {
  const errorDetails = parseAuthError(error);
  
  const logData = {
    timestamp: new Date().toISOString(),
    errorType: errorDetails.type,
    errorMessage: errorDetails.message,
    originalError: errorDetails.originalError,
    errorCode: errorDetails.code,
    context,
  };
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Auth Error FULL:', error);
    console.error('Auth Error DETAILS:', logData);
  }
  
  // In production, you might want to send this to a logging service
  // like Sentry, LogRocket, or your own logging infrastructure
}

/**
 * Create standardized error response for API routes
 */
export function createAuthErrorResponse(
  error: AuthError | Error | unknown,
  statusCode: number = 400
): Response {
  const errorDetails = parseAuthError(error);
  
  return new Response(
    JSON.stringify({
      error: errorDetails.type,
      message: errorDetails.message,
      code: errorDetails.code,
      retryAfter: errorDetails.retryAfter,
    }),
    {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'X-Error-Type': errorDetails.type,
        ...(errorDetails.retryAfter && {
          'Retry-After': errorDetails.retryAfter.toString(),
        }),
      },
    }
  );
}

/**
 * Error boundary helper for React components
 */
export function handleAuthError(
  error: AuthError | Error | unknown,
  setError: (message: string) => void,
  setLoading: (loading: boolean) => void
): void {
  const errorDetails = parseAuthError(error);
  
  setError(errorDetails.message);
  setLoading(false);
  
  // Log the error for monitoring
  logAuthError(error, {
    action: 'component_error',
  });
}

/**
 * Validation error formatter
 */
export function formatValidationErrors(errors: Array<{ path: string; message: string }>): string {
  if (errors.length === 0) return 'Validation failed';
  
  if (errors.length === 1) {
    return errors[0].message;
  }
  
  return `Multiple validation errors: ${errors.map(e => e.message).join(', ')}`;
}
