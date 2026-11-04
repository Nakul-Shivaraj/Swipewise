import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import argon2 from "argon2";
import { createApp } from "../app.js";
import { prisma } from "../db.js";
import { getCsrfTokenAndCookie } from "./test-helpers.js";

describe("Auth Integration Tests (US-01 / Issue #10)", () => {
  const app = createApp({ prisma, schema: "test", rateLimitMax: 100 });

  beforeEach(async () => {
    // Clean up test schema before each test
    await prisma.user.deleteMany();
    await prisma.rateLimit.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany();
    await prisma.rateLimit.deleteMany();
    await prisma.$disconnect();
  });

  it("AC1: sign up saves the user to PostgreSQL via Prisma (argon2id, lowercase email, 409 if exists)", async () => {
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const res = await request(app)
      .post("/api/v1/auth/signup")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        name: "Integration User",
        email: "INTEGRATION@Example.COM",
        password: "Password123",
        confirmPassword: "Password123",
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe("integration@example.com");
    expect(res.body.user.name).toBe("Integration User");

    // Cookie verification
    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join(";") : cookies;
    expect(cookieStr).toMatch(/auth_token=/);
    expect(cookieStr).toMatch(/HttpOnly/i);
    expect(cookieStr).toMatch(/SameSite=Lax/i);

    // Verify stored in test schema in Postgres with argon2id and lowercase email
    const storedUser = await prisma.user.findUnique({
      where: { email: "integration@example.com" },
    });
    expect(storedUser).toBeDefined();
    expect(storedUser?.name).toBe("Integration User");
    expect(storedUser?.email).toBe("integration@example.com");
    expect(storedUser?.passwordHash).toMatch(/^\$argon2id\$/);

    const matches = await argon2.verify(
      storedUser!.passwordHash,
      "Password123",
    );
    expect(matches).toBe(true);

    // Duplicate email returns 409
    const dupRes = await request(app)
      .post("/api/v1/auth/signup")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        name: "Another User",
        email: "integration@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
    expect(dupRes.body.error.message).toBe(
      "An account with this email already exists. Log in instead?",
    );
  });

  it("AC2: log in validates credentials against database and returns generic error on mismatch", async () => {
    // Create user in DB
    const hash = await argon2.hash("Secret123", { type: argon2.argon2id });
    await prisma.user.create({
      data: {
        name: "Login User",
        email: "login@example.com",
        passwordHash: hash,
      },
    });

    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);

    // Wrong password -> 401 with generic error
    const wrongPassRes = await request(app)
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        email: "login@example.com",
        password: "WrongPassword999",
      });
    expect(wrongPassRes.status).toBe(401);
    expect(wrongPassRes.body).toEqual({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Email or password is incorrect.",
      },
    });

    // Non-existent email -> same generic error (never reveal whether email exists)
    const nonExistentRes = await request(app)
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        email: "nobody@example.com",
        password: "Secret123",
      });
    expect(nonExistentRes.status).toBe(401);
    expect(nonExistentRes.body).toEqual({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Email or password is incorrect.",
      },
    });

    // Correct credentials (case-insensitive email) -> 200 and auth cookie
    const validRes = await request(app)
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        email: "LOGIN@EXAMPLE.COM",
        password: "Secret123",
      });
    expect(validRes.status).toBe(200);
    expect(validRes.body.user.email).toBe("login@example.com");
    expect(validRes.body.user.name).toBe("Login User");

    const cookies = validRes.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join(";") : cookies;
    expect(cookieStr).toMatch(/auth_token=/);
    expect(cookieStr).toMatch(/HttpOnly/i);
    expect(cookieStr).toMatch(/SameSite=Lax/i);
  });

  it("AC3: log out clears the auth cookie", async () => {
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const res = await request(app)
      .post("/api/v1/auth/logout")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe("Logged out successfully.");

    const cookies = res.headers["set-cookie"];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join(";") : cookies;
    expect(cookieStr).toMatch(/auth_token=;/);
  });

  it("AC4: GET /api/v1/auth/me returns user data when authenticated, 401 when not", async () => {
    // Unauthenticated
    const unauthRes = await request(app).get("/api/v1/auth/me");
    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.error.code).toBe("UNAUTHORIZED");

    // Sign up to get cookie
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const signupRes = await request(app)
      .post("/api/v1/auth/signup")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        name: "Me User",
        email: "me@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      });
    const cookieHeader = signupRes.headers["set-cookie"]!;

    // Authenticated request
    const meRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Cookie", cookieHeader);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe("me@example.com");
    expect(meRes.body.user.name).toBe("Me User");
  });

  it("AC4: guard requires login for protected routes", async () => {
    // Unauthenticated request to protected route
    const res = await request(app).get("/api/v1/wallet");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");

    // Authenticated request
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(app);
    const signupRes = await request(app)
      .post("/api/v1/auth/signup")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        name: "Wallet User",
        email: "wallet@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      });
    const cookieHeader = signupRes.headers["set-cookie"]!;

    const authRes = await request(app)
      .get("/api/v1/wallet")
      .set("Cookie", cookieHeader);
    expect(authRes.status).toBe(200);
  });

  it("AC5: rate limits auth requests and stores limit counts in Postgres", async () => {
    const limitedApp = createApp({ prisma, schema: "test", rateLimitMax: 3 });
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(limitedApp);

    for (let i = 0; i < 3; i++) {
      const res = await request(limitedApp)
        .post("/api/v1/auth/login")
        .set("x-csrf-token", csrfToken)
        .set("Cookie", csrfCookie)
        .send({
          email: `ratelimit${i}@example.com`,
          password: "Password123",
        });
      expect(res.status).toBe(401);
    }

    // 4th request must be rate limited
    const blockedRes = await request(limitedApp)
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        email: "ratelimit3@example.com",
        password: "Password123",
      });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(blockedRes.body.error.message).toBe(
      "Too many tries. Wait a minute and try again.",
    );

    // Verify rate limit record was stored in Postgres in test schema
    const limits = await prisma.rateLimit.findMany();
    expect(limits.length).toBeGreaterThan(0);
  });

  it("AC5: rate limits protected routes like /api/v1/wallet and returns 429 when general limit is exceeded", async () => {
    // General rate limit set to 3 requests (1 signup + 2 wallet requests allowed)
    const limitedApp = createApp({
      prisma,
      schema: "test",
      rateLimitMax: 100,
      generalRateLimitMax: 3,
    });
    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(limitedApp);

    const signupRes = await request(limitedApp)
      .post("/api/v1/auth/signup")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        name: "Wallet Rate Limit User",
        email: "walletratelimit@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      });
    const cookieHeader = signupRes.headers["set-cookie"]!;

    // Request 1: allowed (200)
    const res1 = await request(limitedApp)
      .get("/api/v1/wallet")
      .set("Cookie", cookieHeader);
    expect(res1.status).toBe(200);

    // Request 2: allowed (200)
    const res2 = await request(limitedApp)
      .get("/api/v1/wallet")
      .set("Cookie", cookieHeader);
    expect(res2.status).toBe(200);

    // Request 3: must be rate limited with 429
    const res3 = await request(limitedApp)
      .get("/api/v1/wallet")
      .set("Cookie", cookieHeader);
    expect(res3.status).toBe(429);
    expect(res3.body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(res3.body.error.message).toBe(
      "Too many requests. Please try again later.",
    );
  });

  it("Issue #42: 5/min authLimiter applies only to POST /signup and POST /login; 6 quick /me calls succeed and 6th login attempt gets 429", async () => {
    const defaultRateApp = createApp({ prisma, schema: "test" });
    const hash = await argon2.hash("Password123", { type: argon2.argon2id });
    await prisma.user.create({
      data: {
        name: "Rate Scope User",
        email: "ratescope@example.com",
        passwordHash: hash,
      },
    });

    const { token: csrfToken, cookie: csrfCookie } =
      await getCsrfTokenAndCookie(defaultRateApp);

    // 1st login attempt -> succeeds and sets cookie (1/5 authLimiter hits used)
    const loginRes = await request(defaultRateApp)
      .post("/api/v1/auth/login")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie)
      .send({
        email: "ratescope@example.com",
        password: "Password123",
      });
    expect(loginRes.status).toBe(200);
    const authCookie = loginRes.headers["set-cookie"]!;

    // 6 quick GET /api/v1/auth/me calls -> all 6 succeed (200) because /me uses generalLimiter
    for (let i = 0; i < 6; i++) {
      const meRes = await request(defaultRateApp)
        .get("/api/v1/auth/me")
        .set("Cookie", authCookie);
      expect(meRes.status).toBe(200);
    }

    // POST /api/v1/auth/logout also uses generalLimiter -> succeeds (200)
    const logoutRes = await request(defaultRateApp)
      .post("/api/v1/auth/logout")
      .set("x-csrf-token", csrfToken)
      .set("Cookie", csrfCookie);
    expect(logoutRes.status).toBe(200);

    // 4 more login attempts (total 5 login attempts within the minute) -> all allowed by authLimiter
    for (let i = 0; i < 4; i++) {
      const attemptRes = await request(defaultRateApp)
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
    const sixthLoginRes = await request(defaultRateApp)
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
