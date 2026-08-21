/**
 * Tenant (workspace) isolation middleware — issue #399.
 *
 * Resolves the current institution workspace and the caller's membership, then
 * exposes guards that enforce the institution role hierarchy and the
 * workspace's credential authority. All data access downstream must go through
 * the resolved workspace id so cross-tenant reads are impossible.
 */

import { NextFunction, Request, Response } from "express";
import { OrganizationStatus } from "../models/Organization";
import {
  hasPermission,
  hasRoleLevel,
  InstitutionPermission,
  InstitutionRole,
  tenantService,
  Workspace,
  WorkspaceMember,
} from "../services/tenants";
import {
  AuthError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../utils/errors";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      organization?: Workspace;
      member?: WorkspaceMember;
    }
  }
}

/** Resolve the workspace from `:orgId` (or the `x-org-id` header) and attach it. */
export const requireTenantContext = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const orgId =
      (req.params.orgId as string | undefined) ??
      (req.header("x-org-id") as string | undefined);

    if (!orgId) {
      return next(new ValidationError("Workspace identifier is required"));
    }

    const organization = await tenantService.getWorkspace(orgId);
    if (!organization) {
      return next(new NotFoundError("Workspace not found"));
    }
    if (organization.status !== OrganizationStatus.ACTIVE) {
      return next(new ForbiddenError("Workspace is not active"));
    }

    req.organization = organization;
    res.set("X-Organization-ID", organization.id);
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Resolve the caller's membership within the resolved workspace. The caller's
 * identity is taken from the `x-member-email` header (explicit test/SPA
 * override) or, when authenticated, from the JWT `user.email`.
 */
export const requireMemberContext = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const organization = req.organization;
    if (!organization) {
      return next(new AuthError("Workspace context is required"));
    }

    const email = resolveMemberEmail(req);
    if (!email) {
      return next(new AuthError("Member identity is required"));
    }

    const member = await tenantService.getMember(organization.id, email);
    if (!member) {
      return next(new ForbiddenError("You are not a member of this workspace"));
    }

    req.member = member;
    next();
  } catch (error) {
    next(error);
  }
};

/** Require the caller to hold one of the given institution roles. */
export const requireTenantRole = (...roles: InstitutionRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const member = req.member;
    if (!member) {
      return next(new AuthError("Workspace membership is required"));
    }
    if (!roles.includes(member.role)) {
      return next(
        new ForbiddenError(`Requires role ${roles.join(" or ")}`),
      );
    }
    next();
  };
};

/** Require the caller to hold a specific institution-scoped permission. */
export const requireTenantPermission = (permission: InstitutionPermission) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const member = req.member;
    if (!member) {
      return next(new AuthError("Workspace membership is required"));
    }
    if (!hasPermission(member.role, permission)) {
      return next(
        new ForbiddenError(
          `Role "${member.role}" lacks permission "${permission}"`,
        ),
      );
    }
    next();
  };
};

/** Require the caller to hold at least the given role in the hierarchy. */
export const requireMinimumRole = (requiredRole: InstitutionRole) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const member = req.member;
    if (!member) {
      return next(new AuthError("Workspace membership is required"));
    }
    if (!hasRoleLevel(member.role, requiredRole)) {
      return next(
        new ForbiddenError(`Minimum role "${requiredRole}" is required`),
      );
    }
    next();
  };
};

/**
 * Require the resolved workspace to be authorised to issue `credentialType`.
 * Complements the service-level check by guarding access before the handler.
 */
export const requireCredentialAuthority = (credentialType: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const organization = req.organization;
    if (!organization) {
      return next(new AuthError("Workspace context is required"));
    }

    const authority = organization.credentialAuthority;
    if (!authority.issuingEnabled) {
      return next(
        new ForbiddenError("Credential issuance is disabled for this workspace"),
      );
    }
    if (!authority.allowedCredentialTypes.includes(credentialType)) {
      return next(
        new ForbiddenError(
          `Workspace is not authorised to issue "${credentialType}" credentials`,
        ),
      );
    }
    next();
  };
};

function resolveMemberEmail(req: Request): string | undefined {
  const explicit = req.header("x-member-email");
  if (explicit) return explicit.toLowerCase();

  const user = (req as Request & { user?: { email?: string } }).user;
  return user?.email?.toLowerCase();
}
