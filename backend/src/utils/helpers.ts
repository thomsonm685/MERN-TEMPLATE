export interface SuccessBody<T> {
  success: true;
  message: string;
  data: T;
}

export interface ErrorBody {
  success: false;
  error: {
    message: string;
    code: string;
    details: unknown;
  };
}

export function successResponse<T>(data: T, message = 'Success'): SuccessBody<T> {
  return { success: true, message, data };
}

export function errorResponse(message: string, code = 'ERROR', details: unknown = {}): ErrorBody {
  return { success: false, error: { message, code, details } };
}
