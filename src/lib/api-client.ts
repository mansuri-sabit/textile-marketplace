/**
 * Typed client for the marketplace API.
 *
 * Every response uses the same `{ success, data | error }` envelope, so this
 * unwraps it once and throws a structured ApiError rather than making every
 * caller check `success` by hand.
 */

export type FieldError = { field: string; message: string };

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Field errors keyed by field name, for inline form display. */
  get fieldErrors(): Record<string, string> {
    if (!Array.isArray(this.details)) return {};
    return Object.fromEntries(
      (this.details as FieldError[])
        .filter((d) => d && typeof d.field === "string")
        .map((d) => [d.field, d.message]),
    );
  }
}

let refreshing: Promise<boolean> | null = null;

/**
 * Refreshes an expired access token at most once per burst of 401s — a page
 * with several parallel requests must not fire several refreshes.
 */
async function refreshSession(): Promise<boolean> {
  refreshing ??= fetch("/api/auth/refresh", { method: "POST" })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
  /** Internal: prevents an infinite refresh loop. */
  _retried?: boolean;
};

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, signal, _retried } = options;

  const res = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok || !payload?.success) {
    const error = payload?.error ?? {};

    // One transparent retry after refreshing, so a lapsed access token does not
    // surface to the user as a failure.
    if (res.status === 401 && !_retried && error.code !== "UNAUTHENTICATED") {
      if (await refreshSession()) {
        return apiFetch<T>(path, { ...options, _retried: true });
      }
    }

    throw new ApiError(
      error.code ?? "REQUEST_FAILED",
      error.message ?? "Something went wrong. Please try again.",
      res.status,
      error.details,
    );
  }

  return payload.data as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => apiFetch<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "POST", body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: "PATCH", body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: "DELETE" }),
};

/** Builds a query string, dropping empty values so URLs stay clean and cacheable. */
export function qs(params: Record<string, string | number | boolean | string[] | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    if (Array.isArray(value)) {
      if (value.length) search.set(key, value.join(","));
    } else {
      search.set(key, String(value));
    }
  }
  const str = search.toString();
  return str ? `?${str}` : "";
}
