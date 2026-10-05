export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

/** Keep session cookies first-party on Vite, Docker, and Vercel. */
export function apiUrl(path: string): string {
  return "/api" + path;
}

export async function api<T>(
  path: string,
  method = "GET",
  data?: unknown,
): Promise<T> {
  const form = data instanceof FormData;
  const response = await fetch(apiUrl(path), {
    method,
    credentials: "same-origin",
    headers: data && !form ? { "Content-Type": "application/json" } : undefined,
    body: data ? (form ? data : JSON.stringify(data)) : undefined,
  });
  const result = await response.json().catch(() => ({
    message: "The server could not be reached. Please retry.",
  }));
  if (!response.ok)
    throw new ApiError(result.message || "Request failed.", response.status);
  return result as T;
}
