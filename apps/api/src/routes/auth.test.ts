import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { userRepo } from '../repositories/user.repository.js';

describe('POST /api/v1/auth/signup (US-01)', () => {
  const app = createApp();

  beforeEach(() => {
    userRepo.clear();
  });

  it('AC1: registers a user with argon2id hashed password and sets httpOnly auth cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Nakul Shivaraj',
        email: 'nakul@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.name).toBe('Nakul Shivaraj');
    expect(res.body.user.email).toBe('nakul@example.com');
    expect(res.body.user).not.toHaveProperty('password');

    // httpOnly cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieStr = Array.isArray(cookies) ? cookies.join(';') : cookies;
    expect(cookieStr).toMatch(/auth_token=/);
    expect(cookieStr).toMatch(/HttpOnly/i);

    // Verify argon2 password in repository
    const storedUser = userRepo.findByEmail('nakul@example.com');
    expect(storedUser).toBeDefined();
    expect(storedUser?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('AC3: returns 409 if email already exists (case-insensitive)', async () => {
    await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'First User',
        email: 'user@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });

    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Second User',
        email: 'USER@EXAMPLE.COM',
        password: 'Password123',
        confirmPassword: 'Password123',
      });

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: {
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'An account with this email already exists. Log in instead?',
      },
    });
  });

  it('AC2: returns 400 with validation errors if input is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        name: '',
        email: 'invalid-email',
        password: 'short',
        confirmPassword: 'diff',
      });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('AC4: rate limits repeated sign up requests with 429', async () => {
    const rateLimitedApp = createApp({ rateLimitMax: 2 });
    for (let i = 0; i < 2; i++) {
      await request(rateLimitedApp)
        .post('/api/v1/auth/signup')
        .send({
          name: `User ${i}`,
          email: `user${i}@example.com`,
          password: 'Password123',
          confirmPassword: 'Password123',
        });
    }

    const res = await request(rateLimitedApp)
      .post('/api/v1/auth/signup')
      .send({
        name: 'Blocked User',
        email: 'blocked@example.com',
        password: 'Password123',
        confirmPassword: 'Password123',
      });

    expect(res.status).toBe(429);
    expect(res.body.error.message).toBe('Too many tries. Wait a minute and try again.');
  });
});
