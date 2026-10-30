import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import argon2 from 'argon2';
import { createApp } from '../app.js';
import { createPrismaClient } from '../db/client.js';

describe('Auth Integration Tests (US-01 / Issue #10)', () => {
  const prisma = createPrismaClient({ schema: 'test' });
  const app = createApp({ prisma });

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

  it('AC1: sign up saves the user to PostgreSQL via Prisma (argon2id, lowercase email, 409 if exists)', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Integration User',
        email: 'INTEGRATION@Example.COM',
        password: 'Password123',
        confirmPassword: 'Password123',
      });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('integration@example.com');
    expect(res.body.user.name).toBe('Integration User');

    // Cookie verification
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
    expect(cookieStr).toMatch(/auth_token=/);
    expect(cookieStr).toMatch(/HttpOnly/i);
    expect(cookieStr).toMatch(/SameSite=Lax/i);

    // Verify stored in test schema in Postgres with argon2id and lowercase email
    const storedUser = await prisma.user.findUnique({
      where: { email: 'integration@example.com' },
    });
    expect(storedUser).toBeDefined();
    expect(storedUser?.name).toBe('Integration User');
    expect(storedUser?.email).toBe('integration@example.com');
    expect(storedUser?.passwordHash).toMatch(/^\$argon2id\$/);

    const matches = await argon2.verify(storedUser!.passwordHash, 'Password123');
    expect(matches).toBe(true);

    // Duplicate email returns 409
    const dupRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Another User',
        email: 'integration@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe('EMAIL_ALREADY_EXISTS');
    expect(dupRes.body.error.message).toBe(
      'An account with this email already exists. Log in instead?'
    );
  });

  it('AC2: log in validates credentials against database and returns generic error on mismatch', async () => {
    // Create user in DB
    const hash = await argon2.hash('Secret123', { type: argon2.argon2id });
    await prisma.user.create({
      data: {
        name: 'Login User',
        email: 'login@example.com',
        passwordHash: hash,
      },
    });

    // Wrong password -> 401 with generic error
    const wrongPassRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'login@example.com',
        password: 'WrongPassword999',
      });
    expect(wrongPassRes.status).toBe(401);
    expect(wrongPassRes.body).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      },
    });

    // Non-existent email -> same generic error (never reveal whether email exists)
    const nonExistentRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'nobody@example.com',
        password: 'Secret123',
      });
    expect(nonExistentRes.status).toBe(401);
    expect(nonExistentRes.body).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      },
    });

    // Correct credentials (case-insensitive email) -> 200 and auth cookie
    const validRes = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'LOGIN@EXAMPLE.COM',
        password: 'Secret123',
      });
    expect(validRes.status).toBe(200);
    expect(validRes.body.user.email).toBe('login@example.com');
    expect(validRes.body.user.name).toBe('Login User');

    const cookies = validRes.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
    expect(cookieStr).toMatch(/auth_token=/);
    expect(cookieStr).toMatch(/HttpOnly/i);
    expect(cookieStr).toMatch(/SameSite=Lax/i);
  });

  it('AC3: log out clears the auth cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out successfully.');

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
    expect(cookieStr).toMatch(/auth_token=;/);
  });

  it('AC4: GET /api/v1/auth/me returns user data when authenticated, 401 when not', async () => {
    // Unauthenticated
    const unauthRes = await request(app).get('/api/v1/auth/me');
    expect(unauthRes.status).toBe(401);
    expect(unauthRes.body.error.code).toBe('UNAUTHORIZED');

    // Sign up to get cookie
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Me User',
        email: 'me@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });
    const cookieHeader = signupRes.headers['set-cookie']!;

    // Authenticated request
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookieHeader);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('me@example.com');
    expect(meRes.body.user.name).toBe('Me User');
  });

  it('AC4: guard requires login for protected routes', async () => {
    // Unauthenticated request to protected route
    const res = await request(app).get('/api/v1/wallet');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');

    // Authenticated request
    const signupRes = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Wallet User',
        email: 'wallet@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });
    const cookieHeader = signupRes.headers['set-cookie']!;

    const authRes = await request(app)
      .get('/api/v1/wallet')
      .set('Cookie', cookieHeader);
    expect(authRes.status).toBe(200);
  });

  it('AC5: rate limits auth requests and stores limit counts in Postgres', async () => {
    const limitedApp = createApp({ prisma, rateLimitMax: 3 });

    for (let i = 0; i < 3; i++) {
      const res = await request(limitedApp)
        .post('/api/v1/auth/login')
        .send({
          email: `ratelimit${i}@example.com`,
          password: 'Password123',
        });
      expect(res.status).toBe(401);
    }

    // 4th request must be rate limited
    const blockedRes = await request(limitedApp)
      .post('/api/v1/auth/login')
      .send({
        email: 'ratelimit3@example.com',
        password: 'Password123',
      });

    expect(blockedRes.status).toBe(429);
    expect(blockedRes.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(blockedRes.body.error.message).toBe(
      'Too many tries. Wait a minute and try again.'
    );

    // Verify rate limit record was stored in Postgres in test schema
    const limits = await prisma.rateLimit.findMany();
    expect(limits.length).toBeGreaterThan(0);
  });
});
