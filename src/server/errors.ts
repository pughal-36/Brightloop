import "server-only";

export const ErrorCodes = {
  UNAUTHENTICATED: "UNAUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "VALIDATION",
  CONFLICT: "CONFLICT",
  INTERNAL: "INTERNAL",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export const DEFAULT_STATUS_MAP: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  INTERNAL: 500,
};

const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHENTICATED: "Authentication required",
  FORBIDDEN: "Access forbidden",
  NOT_FOUND: "Resource not found",
  VALIDATION: "Validation failed",
  CONFLICT: "Resource conflict",
  INTERNAL: "Internal server error",
};

class AppErrorClass extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(
    code: ErrorCode,
    status: number = DEFAULT_STATUS_MAP[code] ?? 500,
    message?: string
  ) {
    const defaultMsg = DEFAULT_MESSAGES[code] ?? "An error occurred";
    super(message || defaultMsg);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, AppErrorClass.prototype);
  }
}

export type AppError = AppErrorClass;

export const AppError = function (
  this: unknown,
  code: ErrorCode,
  status: number = DEFAULT_STATUS_MAP[code] ?? 500,
  message?: string
): AppErrorClass {
  return new AppErrorClass(code, status, message);
} as unknown as {
  new (code: ErrorCode, status?: number, message?: string): AppErrorClass;
  (code: ErrorCode, status?: number, message?: string): AppErrorClass;
};

export interface StandardErrorResponse {
  error: {
    code: ErrorCode;
    message: string;
  };
}

export function toErrorJson(error: unknown): StandardErrorResponse {
  if (error instanceof AppError) {
    if (error.code === "INTERNAL") {
      return {
        error: {
          code: "INTERNAL",
          message: "Internal server error",
        },
      };
    }
    return {
      error: {
        code: error.code,
        message: error.message,
      },
    };
  }

  return {
    error: {
      code: "INTERNAL",
      message: "Internal server error",
    },
  };
}

export function toErrorResponse(error: unknown): {
  status: number;
  body: StandardErrorResponse;
} {
  if (error instanceof AppError) {
    return {
      status: error.status,
      body: toErrorJson(error),
    };
  }

  return {
    status: 500,
    body: toErrorJson(error),
  };
}

