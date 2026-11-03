let cachedCsrfToken: string | null = null;

export async function getCsrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;
  try {
    const res = await fetch("/api/v1/csrf-token");
    if (res.ok) {
      const data = (await res.json()) as { csrfToken?: string; token?: string };
      cachedCsrfToken = data.csrfToken || data.token || "";
      return cachedCsrfToken;
    }
  } catch {
    // If fetching token fails, return empty string
  }
  return "";
}

export function setCachedCsrfToken(token: string | null): void {
  cachedCsrfToken = token;
}

export async function apiFetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const method = (options?.method || "GET").toUpperCase();
  const isStateChanging = ["POST", "PATCH", "PUT", "DELETE"].includes(method);

  let headers: Record<string, string> = {};
  if (options?.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      headers = { ...(options.headers as Record<string, string>) };
    }
  }

  if (isStateChanging) {
    const token = await getCsrfToken();
    if (token && !headers["x-csrf-token"]) {
      headers["x-csrf-token"] = token;
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 403) {
    cachedCsrfToken = null;
  }

  return response;
}
