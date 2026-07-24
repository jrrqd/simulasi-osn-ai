export const PROFILE_GRADES = ["X", "XI", "XII"] as const;
export type ProfileGrade = (typeof PROFILE_GRADES)[number];

export const PROFILE_FIELDS = [
  "birthDate",
  "schoolName",
  "grade",
  "city",
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];

export const PROFILE_FIELD_LABELS: Record<ProfileField, string> = {
  birthDate: "Tanggal lahir",
  schoolName: "Nama sekolah",
  grade: "Kelas",
  city: "Kota",
};

export function missingProfileFields(profile: {
  birthDate: string | null;
  schoolName: string | null;
  grade: string | null;
  city: string | null;
}): ProfileField[] {
  return PROFILE_FIELDS.filter((field) => {
    const value = profile[field];
    return !value || !String(value).trim();
  });
}

export function isValidGrade(value: string): value is ProfileGrade {
  return (PROFILE_GRADES as readonly string[]).includes(value);
}

export function isValidBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  if (date.toISOString().slice(0, 10) !== value) return false;
  const now = new Date();
  const min = new Date("1990-01-01T00:00:00.000Z");
  return date <= now && date >= min;
}
