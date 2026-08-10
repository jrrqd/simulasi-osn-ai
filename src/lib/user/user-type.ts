export const USER_TYPE_VALUES = ["free", "vip", "test"] as const;

export type UserType = (typeof USER_TYPE_VALUES)[number];

export const USER_TYPE_LABELS: Record<UserType, string> = {
  free: "Gratis",
  vip: "VIP",
  test: "Test",
};

export type UserAccess = {
  id: string;
  role: string;
  userType: UserType;
  isAdmin: boolean;
  personalReady: boolean;
};

export function isUserType(value: unknown): value is UserType {
  return (
    typeof value === "string" &&
    (USER_TYPE_VALUES as readonly string[]).includes(value)
  );
}

export function parseUserType(value: unknown): UserType {
  return isUserType(value) ? value : "free";
}

export function isStudentTier(userType: UserType): boolean {
  return USER_TYPE_VALUES.includes(userType);
}
