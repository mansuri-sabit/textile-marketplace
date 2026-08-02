import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Uniform response envelope so every client call can branch on `success`
 * without special-casing per endpoint.
 */
export type ApiSuccess<T> = { success: true; data: T };
export type ApiFailure = {
  success: false;
  error: { code: string; message: string; details?: unknown };
};

export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function fail(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
): NextResponse<ApiFailure> {
  return NextResponse.json(
    { success: false, error: { code, message, details } },
    { status },
  );
}

/** Thrown by services to signal an expected, client-facing failure. */
export class AppError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Wraps a route handler so services can throw instead of threading error
 * responses through every call site. Unexpected errors are logged server-side
 * and reduced to a generic 500 — internals never reach the client.
 */
export function route<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse>,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof ZodError) {
        return fail(
          "VALIDATION_ERROR",
          "Please check the highlighted fields.",
          422,
          err.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        );
      }

      if (err instanceof AppError) {
        return fail(err.code, err.message, err.status, err.details);
      }

      // Duplicate key — surfaces as a 409 rather than a confusing 500.
      if (
        typeof err === "object" &&
        err !== null &&
        (err as { code?: number }).code === 11000
      ) {
        return fail(
          "DUPLICATE",
          "That value is already taken.",
          409,
        );
      }

      console.error("[api] unhandled error:", err);
      return fail(
        "INTERNAL_ERROR",
        "Something went wrong. Please try again.",
        500,
      );
    }
  };
}
