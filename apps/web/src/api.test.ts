import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiFetch, getCsrfToken, setCachedCsrfToken } from "./api.js";

describe("Frontend API Helper with CSRF (apiFetch)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    setCachedCsrfToken(null);
  });

  it("fetches CSRF token from /api/v1/csrf-token and caches it", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ csrfToken: "mock-csrf-token-123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const token = await getCsrfToken();
    expect(token).toBe("mock-csrf-token-123");
    expect(fetchMock).toHaveBeenCalledWith("/api/v1/csrf-token");

    // Second call should use cached token without additional fetch
    const cached = await getCsrfToken();
    expect(cached).toBe("mock-csrf-token-123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("attaches x-csrf-token header on state-changing requests (POST, PATCH, DELETE)", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === "/api/v1/csrf-token") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ csrfToken: "test-token-456" }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ success: true }),
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    // POST request
    await apiFetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@example.com" }),
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/auth/login",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": "test-token-456",
        },
      }),
    );
  });

  it("does not attach x-csrf-token header on GET requests", async () => {
    setCachedCsrfToken("cached-token");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/api/v1/catalog/cards", { method: "GET" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/catalog/cards",
      expect.objectContaining({
        method: "GET",
        headers: {},
      }),
    );
  });
});
