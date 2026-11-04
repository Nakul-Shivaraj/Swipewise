import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import argon2 from "argon2";
import { createApp } from "../app.js";
import { UserRecord, userRepo } from "../repositories/user.repository.js";
import { getCsrfTokenAndCookie } from "./test-helpers.js";

describe("POST /api/v1/auth/signup (US-01)", () => {
  const app = createApp();

  beforeEach(async () => {
    await userRepo.clear();
  });

  it("AC1: registers a user with argon2id hashed password and sets httpOnly auth cookie", async () => {
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        name: "Nakul Shivaraj",
        email: "nakul@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("user");
    expect(res.body.user.name).toBe("Nakul Shivaraj");
    expect(res.body.user.email).toBe("nakul@example.com");
    expect(res.body.user).not.toHaveProperty("password");

    // httpOnly cookie
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join(";") : cookies;
    expect(cookieStr).toMatch(/auth_token=/);
    expect(cookieStr).toMatch(/HttpOnly/i);

    // Verify argon2 password in repository
    const storedUser = await userRepo.findByEmail("nakul@example.com");
    expect(storedUser).toBeDefined();
    expect(storedUser?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it("AC3: returns 409 if email already exists (case-insensitive)", async () => {
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    await request(app)
      .post("/api/v1/auth/signup")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        name: "First User",
        email: "user@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      });

    const res = await request(app)
      .post("/api/v1/auth/signup")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        name: "Second User",
        email: "USER@EXAMPLE.COM",
        password: "Password123",
        confirmPassword: "Password123",
      });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: {
        code: "EMAIL_ALREADY_EXISTS",
        message: "An account with this email already exists. Log in instead?",
      },
    });
  });

  it("AC2: returns 400 with validation errors if input is invalid", async () => {
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        name: "",
        email: "invalid-email",
        password: "short",
        confirmPassword: "diff",
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("AC4: rate limits repeated sign up requests with 429", async () => {
    const rateLimitedApp = createApp({ rateLimitMax: 2 });
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(rateLimitedApp);
    for (let i = 0; i < 2; i++) {
      await request(rateLimitedApp)
        .post("/api/v1/auth/signup")
        .set("x-csrf-token", csrfToken)
        .set("Cookie", csrfCookie)
        .send({
          name: `User ${i}`,
          email: `user${i}@example.com`,
          password: "Password123",
          confirmPassword: "Password123",
        });
    }

    const res = await request(rateLimitedApp)
      .post("/api/v1/auth/signup")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        name: "Blocked User",
        email: "blocked@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      });

    expect(res.status).toBe(429);
    expect(res.body.error.message).toBe(
      "Too many tries. Wait a minute and try again.",
    );
  });
});

describe("Auth rate limit scope (Issue #42)", () => {
  it("5/min authLimiter applies only to POST /signup and POST /login; 6 quick /me calls succeed and 6th login attempt gets 429", async () => {
    const rateCounts = new Map<string, { hits: number; resetTime: Date }>();
    const fakePrisma = {
      $executeRawUnsafe: async () => 0,
      $queryRawUnsafe: async (_sql: string, key: string, resetTime: Date) => {
        const entry = rateCounts.get(key) ?? { hits: 0, resetTime };
        entry.hits += 1;
        rateCounts.set(key, entry);
        return [{ total_hits: entry.hits, reset_time: entry.resetTime }];
      },
    } as unknown as Parameters<typeof createApp>[0] extends { prisma?: infer P }
      ? P
      : never;

    const users = new Map<string, UserRecord>();
    const hash = await argon2.hash("Password123", { type: argon2.argon2id });
    const seededUser: UserRecord = {
      id: "user-rate-1",
      name: "Rate Scope User",
      email: "ratescope@example.com",
      passwordHash: hash,
      timeZone: "America/Los_Angeles",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    users.set(seededUser.email, seededUser);

    const scopedApp = createApp({ prisma: fakePrisma });
    scopedApp.set("userRepo", {
      findByEmail: async (email: string) =>
        users.get(email.trim().toLowerCase()) ?? null,
      findById: async (id: string) =>
        [...users.values()].find((u) => u.id === id) ?? null,
    });

    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(scopedApp);

    // 1st login attempt -> 200 OK (1/5 authLimiter hits)
    const loginRes = await request(scopedApp)
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        email: "ratescope@example.com",
        password: "Password123",
      });
    expect(loginRes.status).toBe(200);
    const authCookie = loginRes.headers["set-cookie"]!;

    // 6 quick GET /api/v1/auth/me calls -> all 6 succeed (200)
    for (let i = 0; i < 6; i++) {
      const meRes = await request(scopedApp)
        .get("/api/v1/auth/me")
        .set("Cookie", authCookie);
      expect(meRes.status).toBe(200);
    }

    // POST /api/v1/auth/logout -> succeeds (200)
    const logoutRes = await request(scopedApp)
      .post("/api/v1/auth/logout")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie);
    expect(logoutRes.status).toBe(200);

    // 4 more login attempts (total 5 login attempts) -> allowed by authLimiter (401)
    for (let i = 0; i < 4; i++) {
      const attemptRes = await request(scopedApp)
        .post("/api/v1/auth/login")
        .set("x-csrf-token", csrfToken)
        .set("Cookie", csrfCookie)
        .send({
          email: "ratescope@example.com",
          password: "WrongPassword999",
        });
      expect(attemptRes.status).toBe(401);
    }

    // 6th login attempt within a minute -> blocked with 429
    const sixthLoginRes = await request(scopedApp)
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        email: "ratescope@example.com",
        password: "WrongPassword999",
      });
    expect(sixthLoginRes.status).toBe(429);
    expect(sixthLoginRes.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(sixthLoginRes.body.error.message).toBe(
      "Too many tries. Wait a minute and try again.",
    );
  });
});
