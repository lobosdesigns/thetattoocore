export type UserRole = "user" | "moderator" | "admin" | "owner";

export const assignableUserRoles = ["user", "moderator", "admin"] as const;

type AssignableUserRole = (typeof assignableUserRoles)[number];

const roleRank: Record<UserRole, number> = {
  user: 0,
  moderator: 1,
  admin: 2,
  owner: 3,
};

export function isAssignableUserRole(
  value: string,
): value is AssignableUserRole {
  return assignableUserRoles.includes(value as AssignableUserRole);
}

export function canModerateUserStatus(
  actorRole: UserRole,
  targetRole: UserRole,
) {
  return (
    actorRole !== "user" &&
    targetRole !== "owner" &&
    roleRank[actorRole] > roleRank[targetRole]
  );
}
