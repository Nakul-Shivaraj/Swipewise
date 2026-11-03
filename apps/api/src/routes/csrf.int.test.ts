import { describe, it, expect, beforeEach, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../app.js";
import { prisma } from "../db.js";

describe("CSRF Protection (js/missing-token-validation)", () => {
  const app = createApp({
    prisma,
    schema: "test",
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

  it("returns 403 on POST, PATCH, and DELETE /api/v1/wallet/cards without CSRF token even for a logged-in user", async () => {
    // 1. Get CSRF token to sign up
    const tokenRes = await request(app).get("/api/v1/csrf-token");
    const csrfToken = tokenRes.body.csrfToken as string;
    const csrfCookie = tokenRes.headers["set-cookie"]!;

    const signupRes = await request(app)
      .post("/api/v1/auth/signup")
      .set("Cookie", csrfCookie)
      .set("x-csrf-token", csrfToken)
      .send({
        name: "Wallet CSRF User",
        email: "walletcsrf@example.com",
        password: "Password123",
        confirmPassword: "Password123",
      });

    const authCookie = signupRes.headers["set-cookie"]![0]!.split(";")[0]!;

    // POST /api/v1/wallet/cards without CSRF token returns 403
    const postRes = await request(app)
      .post("/api/v1/wallet/cards")
      .set("Cookie", authCookie)
      .send({ cardId: "123e4567-e89b-12d3-a456-426614174000" });
    expect(postRes.status).toBe(403);
    expect(postRes.body.error.code).toBe("EBADCSRFTOKEN");
    expect(postRes.body.error.message).toBe("Invalid or missing CSRF token.");

    // PATCH /api/v1/wallet/cards/:id without CSRF token returns 403
    const patchRes = await request(app)
      .patch("/api/v1/wallet/cards/123e4567-e89b-12d3-a456-426614174000")
      .set("Cookie", authCookie)
      .send({ nickname: "Hacked" });
    expect(patchRes.status).toBe(403);
    expect(patchRes.body.error.code).toBe("EBADCSRFTOKEN");
    expect(patchRes.body.error.message).toBe("Invalid or missing CSRF token.");

    // DELETE /api/v1/wallet/cards/:id without CSRF token returns 403
    const deleteRes = await request(app)
      .delete("/api/v1/wallet/cards/123e4567-e89b-12d3-a456-426614174000")
      .set("Cookie", authCookie);
    expect(deleteRes.status).toBe(403);
    expect(deleteRes.body.error.code).toBe("EBADCSRFTOKEN");
    expect(deleteRes.body.error.message).toBe("Invalid or missing CSRF token.");
  });
});
