import { describe, it, expect, beforeEach } from "vitest";
import { PrismaClient, User, Role } from "@prisma/client";
import { promoteUserToAdmin } from "./admin-promote.js";

function createFakePrisma() {
  const users: User[] = [
    {
      id: "user-1",
      email: "testuser@example.com",
      name: "Test User",
      passwordHash: "argon2id$mockhash",
      role: "USER" as Role,
      timeZone: "America/Los_Angeles",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const fake = {
    user: {
      findUnique: async ({ where }: { where: { email: string } }) =>
        users.find((u) => u.email === where.email) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { role: Role };
      }) => {
        const u = users.find((user) => user.id === where.id);
        if (!u) throw new Error("User not found");
        u.role = data.role;
        return { ...u };
      },
    },
  };

  return fake as unknown as PrismaClient;
}

describe("admin:promote logic (Issue #25)", () => {
  let fakePrisma: PrismaClient;

  beforeEach(() => {
    fakePrisma = createFakePrisma();
  });

  it("promotes an existing user from USER to ADMIN role", async () => {
    const result = await promoteUserToAdmin({
      email: "testuser@example.com",
      prisma: fakePrisma,
    });

    expect(result.success).toBe(true);
    expect(result.user?.role).toBe("ADMIN");
    expect(result.message).toContain(
      "Successfully promoted testuser@example.com (Test User) to admin.",
    );
  });

  it("is case-insensitive and trims whitespace when finding user", async () => {
    const result = await promoteUserToAdmin({
      email: "   TESTUSER@EXAMPLE.COM   ",
      prisma: fakePrisma,
    });

    expect(result.success).toBe(true);
    expect(result.user?.role).toBe("ADMIN");
  });

  it("returns a clear error message when user email is not found without crashing", async () => {
    const result = await promoteUserToAdmin({
      email: "unknown@example.com",
      prisma: fakePrisma,
    });

    expect(result.success).toBe(false);
    expect(result.user).toBeUndefined();
    expect(result.message).toBe(
      'User with email "unknown@example.com" not found.',
    );
  });

  it("returns a clear error message when email argument is empty or missing", async () => {
    const result = await promoteUserToAdmin({
      email: "   ",
      prisma: fakePrisma,
    });

    expect(result.success).toBe(false);
    expect(result.user).toBeUndefined();
    expect(result.message).toContain("A valid email argument is required");
  });
});
