import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock("../db.js", () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
  },
}));

import { createApp } from "../app.js";

describe("GET /api/health (Issue #6)", () => {
  const app = createApp();

  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it('AC3: returns 200 {"status":"ok","db":"ok"} after SELECT 1 succeeds', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ "?column?": 1 }]);

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok", db: "ok" });
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('AC3: returns 503 {"status":"error","db":"down"} when the database query fails and never leaks error details', async () => {
    mockQueryRaw.mockRejectedValueOnce(
      new Error(
        "Connection failed to postgresql://postgres:super-secret@db.supabase.co:6543/postgres",
      ),
    );

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "error", db: "down" });
    expect(JSON.stringify(res.body)).not.toContain("super-secret");
    expect(JSON.stringify(res.body)).not.toContain("postgresql://");
  });
});
