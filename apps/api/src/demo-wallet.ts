import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./db.js";
import { DEMO_CARDS } from "./seed-data.js";

export interface SeedDemoWalletOptions {
  email: string;
  env?: NodeJS.ProcessEnv;
  prisma?: PrismaClient;
}

/**
 * Dev-only helper that attaches the 3 demo catalog cards to an existing user's wallet.
 * Refuses to run unless ALLOW_DEMO_SEED=true is set. Idempotent (never creates duplicates).
 */
export async function seedDemoWalletForUser(
  options: SeedDemoWalletOptions,
): Promise<{ addedCount: number; totalWalletCards: number }> {
  const env = options.env ?? process.env;
  if (env.ALLOW_DEMO_SEED !== "true") {
    throw new Error(
      "Refusing to seed demo wallet: ALLOW_DEMO_SEED=true must be set (dev-only).",
    );
  }

  const activePrisma = options.prisma ?? defaultPrisma;
  const normalizedEmail = options.email.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error("A valid --email <email> argument is required.");
  }

  const user = await activePrisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw new Error(`No user found with email "${normalizedEmail}".`);
  }

  const demoCardNames = DEMO_CARDS.map((c) => c.name);
  const catalogCards = await activePrisma.card.findMany({
    where: { name: { in: demoCardNames } },
  });

  if (catalogCards.length === 0) {
    throw new Error(
      'No demo catalog cards found in database. Run "npm run db:seed" first.',
    );
  }

  const existingWalletCards = await activePrisma.walletCard.findMany({
    where: { userId: user.id },
  });
  const existingCardIds = new Set(existingWalletCards.map((wc) => wc.cardId));

  let addedCount = 0;
  for (const card of catalogCards) {
    if (!existingCardIds.has(card.id)) {
      await activePrisma.walletCard.create({
        data: {
          userId: user.id,
          cardId: card.id,
        },
      });
      addedCount++;
    }
  }

  const totalWalletCards = await activePrisma.walletCard.count({
    where: { userId: user.id },
  });

  return { addedCount, totalWalletCards };
}

function parseEmailFromArgs(argv: string[]): string | null {
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--email" && argv[i + 1]) {
      return argv[i + 1]!;
    }
    if (argv[i]?.startsWith("--email=")) {
      return argv[i]!.slice("--email=".length);
    }
  }
  return null;
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  const email = parseEmailFromArgs(process.argv.slice(2));
  if (!email) {
    console.error(
      "Usage: ALLOW_DEMO_SEED=true npm run db:demo-wallet -- --email <email>",
    );
    process.exit(1);
  }

  seedDemoWalletForUser({ email })
    .then(({ addedCount, totalWalletCards }) => {
      console.log(
        `Demo wallet seed complete for ${email}: added ${addedCount} card(s) (${totalWalletCards} total in wallet).`,
      );
      return defaultPrisma.$disconnect();
    })
    .catch((err: unknown) => {
      console.error(
        err instanceof Error ? err.message : "Failed to seed demo wallet.",
      );
      process.exit(1);
    });
}
