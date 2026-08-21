/**
 * Tenants service module (issue #399).
 *
 * Re-exports the institution workspace service and the role hierarchy so
 * callers can import from `services/tenants` rather than reaching into files.
 */

export { TenantService, tenantService } from "./TenantService";
export type {
  Workspace,
  WorkspaceMember,
  MembershipInvitation,
  IssuedCredential,
  ProvisionWorkspaceInput,
  InviteMemberInput,
} from "./TenantService";
export {
  InstitutionRole,
  ROLE_LEVELS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasRoleLevel,
  hasPermission,
  canAssignRole,
  isInstitutionRole,
} from "./roles";
export type { InstitutionPermission } from "./roles";
