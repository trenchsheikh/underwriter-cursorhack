/**
 * Thin fetch wrapper for the Mandate backend.
 *
 * Single seam for: base URL, JSON headers, error-envelope unwrap,
 * AbortController plumbing. Every other lib/*.ts goes through here.
 *
 * Why so small: contract changes shouldn't touch HTTP plumbing, and
 * HTTP plumbing changes (auth headers, base URL, retries) shouldn't
 * touch the contract callers.
 */

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    detail: string,
    readonly raw?: unknown,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

/** Generic JSON GET / POST. Throws ApiError on non-2xx. */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let code = "http_error";
    let detail = `${res.status} ${res.statusText}`;
    let raw: unknown;
    try {
      raw = await res.json();
      const obj = raw as { error?: string; detail?: string; message?: string };
      code = obj.error ?? code;
      detail = obj.detail ?? obj.message ?? detail;
    } catch {
      // not JSON; keep the status-line detail
    }
    throw new ApiError(res.status, code, detail, raw);
  }
  // 204 No Content
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Probe the backend; resolves true iff the health endpoint answered 2xx. */
export async function probeBackend(signal?: AbortSignal): Promise<boolean> {
  try {
    await apiFetch<unknown>("/api/health", { signal });
    return true;
  } catch {
    return false;
  }
}
