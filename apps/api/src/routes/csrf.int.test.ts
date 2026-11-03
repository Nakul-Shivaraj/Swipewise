import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../db.js";

describe("CSRF Protection (js/missing-token-validation)", () => {
  const app = createApp({
    prisma,
    schema: "test",
    enableCsrf: true,
    rateLimitMax: 100,
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
    await prisma.rateLimit.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.rateLimit.deleteMany();
  });

  it("returns 403 when a state-changing POST is made without a CSRF token", async () => {
    const res = await request(app).post("/api/v1/auth/signup").send({
      name: "No Csrf",
      email: "nocsrf@example.com",
      password: "Password123",
      confirmPassword: "Password123",
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("EBADCSRFTOKEN");
  });

  it("returns a token on GET /api/v1/csrf-token and succeeds when token is sent in x-csrf-token header", async () => {
    // 1. Get CSRF token
    const tokenRes = await request(app).get("/api/v1/csrf-token");
    expect(tokenRes.status).toBe(200);
    expect(tokenRes.body.csrfToken).toBeDefined();

    const csrfToken = tokenRes.body.csrfToken as string;
    const cookies = tokenRes.headers["set-cookie"];
    expect(cookies).toBeDefined();

    // 2. Perform state-changing POST with CSRF token and cookie
    const signupRes = await request(app)
      .post("/api/v1/auth/signup")
      .set("Cookie", cookies!)
      .set("x-csrf-token", csrfToken)
      .send({
        name: "With Csrf",
        email: "withcsrf@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      });

    expect(signupRes.status).toBe(201);
    expect(signupRes.body.user.email).toBe("withcsrf@example.com");
  });
});
