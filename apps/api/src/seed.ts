/**
 * Database seed script.
 * Empty seed for issue #4 - schema and seed data are in issue #9.
 */
export async function seed(): Promise<void> {
  console.log("Database seed completed (empty).");
}

seed().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
