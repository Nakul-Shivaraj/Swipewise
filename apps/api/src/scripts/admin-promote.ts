import { prisma } from "../db.js";

async function main(): Promise<void> {
  const email = process.argv[2]?.trim();

  if (!email) {
    console.error("Usage: npm run admin:promote -- <email>");
    process.exit(1);
  }

  const normalized = email.toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalized },
  });

  if (!user) {
    console.error(`User with email "${email}" not found.`);
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN" },
  });

  console.log(`Successfully promoted ${user.email} (${user.name}) to admin.`);
}

main()
  .catch((err) => {
    console.error("Failed to promote user to admin:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
