import { eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { attempts, topicMastery, user } from "../src/db/schema";
import { rebuildTopicMasteryForUser } from "../src/lib/attempts";

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error("Usage: tsx scripts/rebuild-user-mastery.ts <email>");
    process.exit(1);
  }

  const db = await getDb();
  const target = await db.query.user.findFirst({
    where: eq(user.email, email),
  });
  if (!target) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const beforeMastery = await db
    .select()
    .from(topicMastery)
    .where(eq(topicMastery.userId, target.id));
  const attemptRows = await db
    .select()
    .from(attempts)
    .where(eq(attempts.userId, target.id));

  console.log(
    JSON.stringify(
      {
        user: { id: target.id, name: target.name, email: target.email },
        before: {
          topicMasteryRows: beforeMastery.length,
          attempts: attemptRows.length,
        },
      },
      null,
      2,
    ),
  );

  const rebuilt = await rebuildTopicMasteryForUser(target.id);
  console.log(JSON.stringify({ rebuilt }, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
