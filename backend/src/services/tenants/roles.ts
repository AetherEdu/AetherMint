/**
 * Institution role hierarchy and permissions (issue #399).
 *
 * Every member of an institution workspace holds exactly one role. Roles are
 * totally ordered by authority so that role checks and role-assignment guards
 * can be expressed with a single numeric comparison.
 *
 *   owner      (4) — full control of the workspace, incl. other admins
 *   admin      (3) — day-to-day management, membership, issuance scope
 *   instructor (2) — teaching duties; cannot manage membership or issue
 *   registrar  (1) — credential issuance within the configured authority
 */

export enum InstitutionRole {
  OWNER = "owner",
  ADMIN = "admin",
  INSTRUCTOR = "instructor",
  REGISTRAR = "registrar",
}

export const ROLE_LEVELS: Record<InstitutionRole, number> = {
  [InstitutionRole.OWNER]: 4,
  [InstitutionRole.ADMIN]: 3,
  [InstitutionRole.INSTRUCTOR]: 2,
  [InstitutionRole.REGISTRAR]: 1,
};

/** Institution-scoped permission constants. */
export const PERMISSIONS = {
  WORKSPACE_MANAGE: "workspace:manage",
  MEMBER_INVITE: "member:invite",
  MEMBER_MANAGE: "member:manage",
  CREDENTIAL_ISSUE: "credential:issue",
  CREDENTIAL_AUTHORITY: "credential:authority",
} as const;

export type InstitutionPermission =
  (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Permissions granted to each institution role. */
export const ROLE_PERMISSIONS: Record<InstitutionRole, InstitutionPermission[]> = {
  [InstitutionRole.OWNER]: [
    PERMISSIONS.WORKSPACE_MANAGE,
    PERMISSIONS.MEMBER_INVITE,
    PERMISSIONS.MEMBER_MANAGE,
    PERMISSIONS.CREDENTIAL_ISSUE,
    PERMISSIONS.CREDENTIAL_AUTHORITY,
  ],
  [InstitutionRole.ADMIN]: [
    PERMISSIONS.WORKSPACE_MANAGE,
    PERMISSIONS.MEMBER_INVITE,
    PERMISSIONS.MEMBER_MANAGE,
    PERMISSIONS.CREDENTIAL_ISSUE,
    PERMISSIONS.CREDENTIAL_AUTHORITY,
  ],
  [InstitutionRole.INSTRUCTOR]: [],
  [InstitutionRole.REGISTRAR]: [PERMISSIONS.CREDENTIAL_ISSUE],
};

export function isInstitutionRole(value: string): value is InstitutionRole {
  return Object.values(InstitutionRole).includes(value as InstitutionRole);
}

export function roleLevel(role: InstitutionRole): number {
  return ROLE_LEVELS[role] ?? 0;
}

/** Whether `role` holds at least the authority of `requiredRole`. */
export function hasRoleLevel(
  role: InstitutionRole,
  requiredRole: InstitutionRole,
): boolean {
  return roleLevel(role) >= roleLevel(requiredRole);
}

/** Whether `role` has a specific institution-scoped permission. */
export function hasPermission(
  role: InstitutionRole,
  permission: InstitutionPermission,
): boolean {
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

/**
 * Escalation guard: an actor may only assign a target role strictly *below*
 * their own. This prevents an admin from granting another admin or an owner,
 * while still letting an owner grant admin and everyone below it.
 */
export function canAssignRole(
  actorRole: InstitutionRole,
  targetRole: InstitutionRole,
): boolean {
  return roleLevel(actorRole) > roleLevel(targetRole);
}
