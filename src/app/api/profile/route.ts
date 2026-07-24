import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { user } from "@/db/schema";
import { requireApiUser } from "@/lib/api";
import {
  isValidBirthDate,
  isValidGrade,
  missingProfileFields,
  PROFILE_FIELDS,
  type ProfileField,
} from "@/lib/profile";

const SNOOZE_MS = 24 * 60 * 60 * 1000;

function profilePayload(row: typeof user.$inferSelect) {
  const profile = {
    birthDate: row.birthDate,
    schoolName: row.schoolName,
    grade: row.grade,
    city: row.city,
  };
  const missing = missingProfileFields(profile);
  const snoozedUntil = row.profilePromptSnoozedUntil;
  const snoozed =
    snoozedUntil != null && snoozedUntil.getTime() > Date.now();

  return {
    birthDate: row.birthDate,
    schoolName: row.schoolName,
    grade: row.grade,
    city: row.city,
    onboardingCompleted: Boolean(row.onboardingCompletedAt),
    onboardingCompletedAt: row.onboardingCompletedAt,
    profilePromptSnoozedUntil: snoozedUntil,
    profilePromptSnoozed: snoozed,
    missingFields: missing,
  };
}

export async function GET(req: Request) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;

  const db = await getDb();
  const row = await db.query.user.findFirst({
    where: eq(user.id, authResult.user.id),
  });
  if (!row) {
    return Response.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  return Response.json(profilePayload(row));
}

export async function PATCH(req: Request) {
  const authResult = await requireApiUser(req);
  if ("error" in authResult) return authResult.error;

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const db = await getDb();
  const updates: Partial<typeof user.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (body.completeOnboarding === true) {
    updates.onboardingCompletedAt = new Date();
  }

  if (body.snoozeProfilePrompt === true) {
    updates.profilePromptSnoozedUntil = new Date(Date.now() + SNOOZE_MS);
  }

  if ("birthDate" in body) {
    const value = String(body.birthDate ?? "").trim();
    if (!value) {
      updates.birthDate = null;
    } else if (!isValidBirthDate(value)) {
      return Response.json(
        { error: "Tanggal lahir tidak valid" },
        { status: 400 },
      );
    } else {
      updates.birthDate = value;
    }
  }

  if ("schoolName" in body) {
    const value = String(body.schoolName ?? "").trim();
    updates.schoolName = value || null;
  }

  if ("grade" in body) {
    const value = String(body.grade ?? "").trim();
    if (!value) {
      updates.grade = null;
    } else if (!isValidGrade(value)) {
      return Response.json({ error: "Kelas tidak valid" }, { status: 400 });
    } else {
      updates.grade = value;
    }
  }

  if ("city" in body) {
    const value = String(body.city ?? "").trim();
    updates.city = value || null;
  }

  const profileKeys = PROFILE_FIELDS.filter((field) => field in body);
  const actionKeys = [
    body.completeOnboarding === true,
    body.snoozeProfilePrompt === true,
    profileKeys.length > 0,
  ].some(Boolean);

  if (!actionKeys) {
    return Response.json({ error: "Tidak ada perubahan" }, { status: 400 });
  }

  // Clear snooze after a successful field save so next missing field can show later
  if (profileKeys.length > 0) {
    updates.profilePromptSnoozedUntil = null;
  }

  await db.update(user).set(updates).where(eq(user.id, authResult.user.id));

  const row = await db.query.user.findFirst({
    where: eq(user.id, authResult.user.id),
  });
  if (!row) {
    return Response.json({ error: "User tidak ditemukan" }, { status: 404 });
  }

  return Response.json(profilePayload(row));
}

export type { ProfileField };
