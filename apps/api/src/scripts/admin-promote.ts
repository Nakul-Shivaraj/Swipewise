import { fileURLToPath } from "node:url";
import { PrismaClient, User } from "@prisma/client";
import { prisma as defaultPrisma } from "../db.js";

export interface PromoteAdminOptions {
  email: string;
  prisma?: PrismaClient;
}

export interface PromoteAdminResult {
  success: boolean;
  message: string;
  user?: User;
}

/**
 * Promotes an existing user to ADMIN role.
 * Safe, idempotent, and returns clear errors on missing or unknown users.
 */
export async function promoteUserToAdmin(
  options: PromoteAdminOptions,
): Promise<PromoteAdminResult> {
  const rawEmail = options.email?.trim();
  const normalized = rawEmail?.toLowerCase();
  if (!normalized) {
    return {
      success: false,
      message:
        "A valid email argument is required. Usage: npm run admin:promote -- <email>",
    };
  }

  const activePrisma = options.prisma ?? defaultPrisma;
  const user = await activePrisma.user.findUnique({
    where: { email: normalized },
  });

  if (!user) {
    return {
      success: false,
      message: `User with email "${rawEmail}" not found.`,
    };
  }

  const updated = await activePrisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
  });

  return {
    success: true,
    message: `Successfully promoted ${updated.email} (${updated.name}) to admin.`,
    user: updated,
  };
}

const isDirectRun =
  process.argv[1] &&
  (fileURLToPath(import.meta.url) === process.argv[1] ||
    process.argv[1].endsWith("admin-promote.ts") ||
    process.argv[1].endsWith("admin-promote.js"));

if (isDirectRun) {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: npm run admin:promote -- <email>");
    process.exit(1);
  }

  promoteUserToAdmin({ email })
    .then((result) => {
      if (!result.success) {
        console.error(result.message);
        process.exit(1);
      }
      console.log(result.message);
      return defaultPrisma.$disconnect();
    })
    .catch((err: unknown) => {
      console.error(
        err instanceof Error ? err.message : "Failed to promote user to admin.",
      );
      process.exit(1);
    });
}
