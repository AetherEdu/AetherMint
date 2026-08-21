/**
 * Tenant Service
 *
 * Core logic for multi-tenant institution workspaces (issue #399).
 *
 * Responsibilities:
 *  - Provision isolated institution workspaces and their owner membership.
 *  - Enforce the institution role hierarchy (owner > admin > instructor >
 *    registrar) for membership management and role assignment.
 *  - Drive the member invitation flow (invite → accept).
 *  - Scope credential issuance to the institution's configured authority.
 *  - Guarantee cross-tenant data isolation: every read is keyed by workspace
 *    id and never leaks another workspace's members or credentials.
 *
 * State is held in memory as the reference implementation. The Mongoose
 * schema in `models/Organization` is the persistence shape the database-backed
 * path writes through; swapping this store for the model keeps the public API
 * unchanged.
 */

import { randomUUID } from "crypto";
import {
  CredentialAuthority,
  OrganizationStatus,
} from "../../models/Organization";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../utils/errors";
import logger from "../../utils/logger";
import {
  canAssignRole,
  hasPermission,
  InstitutionRole,
  isInstitutionRole,
  PERMISSIONS,
} from "./roles";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  credentialAuthority: CredentialAuthority;
  createdAt: Date;
  updatedAt: Date;
}

export type MemberStatus = "active" | "suspended";

export interface WorkspaceMember {
  id: string;
  orgId: string;
  email: string;
  role: InstitutionRole;
  status: MemberStatus;
  joinedAt: Date;
}

export interface MembershipInvitation {
  token: string;
  orgId: string;
  email: string;
  role: InstitutionRole;
  invitedBy: string;
  status: "pending" | "accepted" | "revoked";
  expiresAt: Date;
  createdAt: Date;
}

export interface IssuedCredential {
  id: string;
  orgId: string;
  recipientId: string;
  recipientEmail: string;
  type: string;
  issuedBy: string;
  issuedAt: Date;
}

export interface ProvisionWorkspaceInput {
  name: string;
  slug: string;
  ownerEmail: string;
  credentialAuthority?: Partial<CredentialAuthority>;
}

export interface InviteMemberInput {
  email: string;
  role: InstitutionRole;
}

const DEFAULT_CREDENTIAL_AUTHORITY: CredentialAuthority = {
  issuingEnabled: true,
  allowedCredentialTypes: [],
};

export class TenantService {
  private workspaces = new Map<string, Workspace>();
  private membersById = new Map<string, WorkspaceMember>();
  private memberIdsByOrg = new Map<string, Set<string>>();
  private invitations = new Map<string, MembershipInvitation>();
  private credentials = new Map<string, IssuedCredential>();
  private credentialIdsByOrg = new Map<string, Set<string>>();
  private idCounter = 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Workspace provisioning
  // ─────────────────────────────────────────────────────────────────────────

  /** Provision a new isolated workspace and its first member (the owner). */
  async provisionWorkspace(
    input: ProvisionWorkspaceInput,
  ): Promise<{ workspace: Workspace; owner: WorkspaceMember }> {
    const name = this.requireText(input.name, "name");
    const slug = this.normalizeSlug(input.slug);
    const ownerEmail = this.normalizeEmail(input.ownerEmail);

    if (this.workspaceBySlug(slug)) {
      throw new ConflictError(`Workspace slug "${slug}" is already taken`);
    }

    const now = new Date();
    const workspace: Workspace = {
      id: this.nextId("org"),
      name,
      slug,
      status: OrganizationStatus.ACTIVE,
      credentialAuthority: {
        ...DEFAULT_CREDENTIAL_AUTHORITY,
        ...(input.credentialAuthority ?? {}),
        allowedCredentialTypes: [
          ...new Set(input.credentialAuthority?.allowedCredentialTypes ?? []),
        ],
      },
      createdAt: now,
      updatedAt: now,
    };

    this.workspaces.set(workspace.id, workspace);

    const owner = this.createMember(
      workspace.id,
      ownerEmail,
      InstitutionRole.OWNER,
    );

    logger.info(
      `Workspace "${slug}" provisioned with owner ${ownerEmail}`,
    );
    return { workspace: { ...workspace }, owner: { ...owner } };
  }

  async getWorkspace(orgId: string): Promise<Workspace | null> {
    const workspace = this.workspaces.get(orgId);
    return workspace ? { ...workspace } : null;
  }

  async listWorkspaces(): Promise<Workspace[]> {
    return [...this.workspaces.values()]
      .map((workspace) => ({ ...workspace }))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Membership (scoped to a workspace)
  // ─────────────────────────────────────────────────────────────────────────

  /** List members of a single workspace — never leaks other workspaces. */
  async listMembers(orgId: string): Promise<WorkspaceMember[]> {
    this.requireWorkspace(orgId);
    const ids = this.memberIdsByOrg.get(orgId);
    if (!ids) return [];
    return [...ids]
      .map((id) => this.membersById.get(id))
      .filter((member): member is WorkspaceMember => Boolean(member))
      .map((member) => ({ ...member }))
      .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime());
  }

  /** Resolve a member within a workspace by email address. */
  async getMember(orgId: string, email: string): Promise<WorkspaceMember | null> {
    const normalized = this.normalizeEmail(email);
    const member = this.findMemberByEmail(orgId, normalized);
    return member ? { ...member } : null;
  }

  /**
   * Invite a new member. The inviter must hold the `member:invite` permission
   * and may only invite into a role strictly below their own.
   */
  async inviteMember(
    orgId: string,
    inviterEmail: string,
    input: InviteMemberInput,
  ): Promise<MembershipInvitation> {
    const workspace = this.requireActiveWorkspace(orgId);
    const inviter = this.requireMember(orgId, inviterEmail);
    this.requirePermission(inviter, PERMISSIONS.MEMBER_INVITE);

    if (!isInstitutionRole(input.role)) {
      throw new ValidationError(`Invalid institution role "${input.role}"`);
    }
    if (!canAssignRole(inviter.role, input.role)) {
      throw new ForbiddenError(
        `Cannot invite a member with role "${input.role}" (must be below your own)`,
      );
    }

    const email = this.normalizeEmail(input.email);
    if (this.findMemberByEmail(orgId, email)) {
      throw new ConflictError(`"${email}" is already a member of this workspace`);
    }

    const existing = this.findPendingInvitation(orgId, email);
    if (existing) {
      return { ...existing };
    }

    const now = new Date();
    const invitation: MembershipInvitation = {
      token: randomUUID(),
      orgId,
      email,
      role: input.role,
      invitedBy: inviter.email,
      status: "pending",
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      createdAt: now,
    };
    this.invitations.set(invitation.token, invitation);
    logger.info(
      `Member ${email} invited to workspace ${workspace.slug} as ${input.role}`,
    );
    return { ...invitation };
  }

  /** Accept a pending invitation, creating an active membership. */
  async acceptInvitation(
    token: string,
    email: string,
  ): Promise<WorkspaceMember> {
    const invitation = this.invitations.get(token);
    if (!invitation) {
      throw new NotFoundError("Invitation not found");
    }
    if (invitation.status !== "pending") {
      throw new ConflictError("Invitation is no longer pending");
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      invitation.status = "revoked";
      throw new ForbiddenError("Invitation has expired");
    }

    const normalized = this.normalizeEmail(email);
    if (invitation.email !== normalized) {
      throw new ForbiddenError("Invitation was issued to a different email address");
    }

    const member = this.createMember(invitation.orgId, normalized, invitation.role);
    invitation.status = "accepted";
    logger.info(
      `Member ${normalized} accepted invitation to workspace ${invitation.orgId}`,
    );
    return { ...member };
  }

  /**
   * Assign a new role to a member. The actor must hold `member:manage` and may
   * only target a role — and a member — strictly below their own authority.
   */
  async assignRole(
    orgId: string,
    actorEmail: string,
    targetMemberId: string,
    newRole: InstitutionRole,
  ): Promise<WorkspaceMember> {
    this.requireActiveWorkspace(orgId);
    const actor = this.requireMember(orgId, actorEmail);
    this.requirePermission(actor, PERMISSIONS.MEMBER_MANAGE);

    const target = this.membersById.get(targetMemberId);
    if (!target || target.orgId !== orgId) {
      throw new NotFoundError("Member not found in this workspace");
    }

    if (!isInstitutionRole(newRole)) {
      throw new ValidationError(`Invalid institution role "${newRole}"`);
    }
    if (!canAssignRole(actor.role, newRole)) {
      throw new ForbiddenError(
        `Cannot assign role "${newRole}" (must be below your own)`,
      );
    }
    if (!canAssignRole(actor.role, target.role)) {
      throw new ForbiddenError(
        `Cannot modify a member holding role "${target.role}"`,
      );
    }

    target.role = newRole;
    this.membersById.set(target.id, target);
    logger.info(
      `Member ${target.email} role changed to ${newRole} by ${actor.email}`,
    );
    return { ...target };
  }

  /** Remove a member. Owners cannot be removed, and lower roles cannot act on peers/superiors. */
  async removeMember(
    orgId: string,
    actorEmail: string,
    targetMemberId: string,
  ): Promise<void> {
    this.requireActiveWorkspace(orgId);
    const actor = this.requireMember(orgId, actorEmail);
    this.requirePermission(actor, PERMISSIONS.MEMBER_MANAGE);

    const target = this.membersById.get(targetMemberId);
    if (!target || target.orgId !== orgId) {
      throw new NotFoundError("Member not found in this workspace");
    }
    if (target.role === InstitutionRole.OWNER) {
      throw new ForbiddenError("The workspace owner cannot be removed");
    }
    if (!canAssignRole(actor.role, target.role)) {
      throw new ForbiddenError(
        `Cannot remove a member holding role "${target.role}"`,
      );
    }

    this.membersById.delete(target.id);
    this.memberIdsByOrg.get(orgId)?.delete(target.id);
    logger.info(`Member ${target.email} removed from workspace by ${actor.email}`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Credential issuance (scoped to the institution's authority)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Issue a credential to a workspace member. Issuance is refused unless the
   * actor holds `credential:issue`, the institution has issuing enabled, and
   * the requested type is within the institution's configured authority.
   */
  async issueCredential(
    orgId: string,
    actorEmail: string,
    recipientMemberId: string,
    type: string,
  ): Promise<IssuedCredential> {
    const workspace = this.requireActiveWorkspace(orgId);
    const actor = this.requireMember(orgId, actorEmail);
    this.requirePermission(actor, PERMISSIONS.CREDENTIAL_ISSUE);

    const recipient = this.membersById.get(recipientMemberId);
    if (!recipient || recipient.orgId !== orgId) {
      throw new NotFoundError("Recipient is not a member of this workspace");
    }

    const authority = workspace.credentialAuthority;
    if (!authority.issuingEnabled) {
      throw new ForbiddenError("Credential issuance is disabled for this workspace");
    }
    if (!authority.allowedCredentialTypes.includes(type)) {
      throw new ForbiddenError(
        `Workspace is not authorised to issue "${type}" credentials`,
      );
    }

    if (authority.maxIssuancePerMember !== undefined) {
      const issued = this.countCredentialsForRecipient(orgId, recipientMemberId, type);
      if (issued >= authority.maxIssuancePerMember) {
        throw new ForbiddenError(
          `Recipient has reached the issuance cap for "${type}" credentials`,
        );
      }
    }

    const credential: IssuedCredential = {
      id: this.nextId("cred"),
      orgId,
      recipientId: recipient.id,
      recipientEmail: recipient.email,
      type,
      issuedBy: actor.email,
      issuedAt: new Date(),
    };
    this.credentials.set(credential.id, credential);
    if (!this.credentialIdsByOrg.has(orgId)) {
      this.credentialIdsByOrg.set(orgId, new Set());
    }
    this.credentialIdsByOrg.get(orgId)?.add(credential.id);
    logger.info(
      `Credential "${type}" issued to ${recipient.email} by ${actor.email}`,
    );
    return { ...credential };
  }

  /** List credentials issued by a workspace — never leaks other workspaces. */
  async listCredentials(orgId: string): Promise<IssuedCredential[]> {
    this.requireWorkspace(orgId);
    const ids = this.credentialIdsByOrg.get(orgId);
    if (!ids) return [];
    return [...ids]
      .map((id) => this.credentials.get(id))
      .filter((credential): credential is IssuedCredential => Boolean(credential))
      .map((credential) => ({ ...credential }))
      .sort((a, b) => a.issuedAt.getTime() - b.issuedAt.getTime());
  }

  /** Whether a role may issue credentials at all (authority-agnostic). */
  canIssueCredential(role: InstitutionRole): boolean {
    return hasPermission(role, PERMISSIONS.CREDENTIAL_ISSUE);
  }

  /** Update the credential authority of a workspace (owner/admin only). */
  async updateCredentialAuthority(
    orgId: string,
    actorEmail: string,
    authority: Partial<CredentialAuthority>,
  ): Promise<Workspace> {
    const workspace = this.requireActiveWorkspace(orgId);
    const actor = this.requireMember(orgId, actorEmail);
    this.requirePermission(actor, PERMISSIONS.CREDENTIAL_AUTHORITY);

    const next: CredentialAuthority = {
      issuingEnabled:
        authority.issuingEnabled ?? workspace.credentialAuthority.issuingEnabled,
      allowedCredentialTypes: [
        ...new Set(
          authority.allowedCredentialTypes ??
            workspace.credentialAuthority.allowedCredentialTypes,
        ),
      ],
      maxIssuancePerMember:
        authority.maxIssuancePerMember !== undefined
          ? authority.maxIssuancePerMember
          : workspace.credentialAuthority.maxIssuancePerMember,
    };
    workspace.credentialAuthority = next;
    workspace.updatedAt = new Date();
    this.workspaces.set(workspace.id, workspace);
    return { ...workspace };
  }

  /** Clear all state (primarily for tests). */
  reset(): void {
    this.workspaces.clear();
    this.membersById.clear();
    this.memberIdsByOrg.clear();
    this.invitations.clear();
    this.credentials.clear();
    this.credentialIdsByOrg.clear();
    this.idCounter = 0;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Internal helpers
  // ─────────────────────────────────────────────────────────────────────────

  private createMember(
    orgId: string,
    email: string,
    role: InstitutionRole,
  ): WorkspaceMember {
    const member: WorkspaceMember = {
      id: this.nextId("mbr"),
      orgId,
      email,
      role,
      status: "active",
      joinedAt: new Date(),
    };
    this.membersById.set(member.id, member);
    if (!this.memberIdsByOrg.has(orgId)) {
      this.memberIdsByOrg.set(orgId, new Set());
    }
    this.memberIdsByOrg.get(orgId)?.add(member.id);
    return member;
  }

  private requireWorkspace(orgId: string): Workspace {
    const workspace = this.workspaces.get(orgId);
    if (!workspace) {
      throw new NotFoundError("Workspace not found");
    }
    return workspace;
  }

  private requireActiveWorkspace(orgId: string): Workspace {
    const workspace = this.requireWorkspace(orgId);
    if (workspace.status !== OrganizationStatus.ACTIVE) {
      throw new ForbiddenError("Workspace is not active");
    }
    return workspace;
  }

  private requireMember(orgId: string, email: string): WorkspaceMember {
    const member = this.findMemberByEmail(orgId, this.normalizeEmail(email));
    if (!member) {
      throw new ForbiddenError("Actor is not a member of this workspace");
    }
    return member;
  }

  private requirePermission(
    member: WorkspaceMember,
    permission: (typeof PERMISSIONS)[keyof typeof PERMISSIONS],
  ): void {
    if (!hasPermission(member.role, permission)) {
      throw new ForbiddenError(
        `Role "${member.role}" lacks permission "${permission}"`,
      );
    }
  }

  private findMemberByEmail(orgId: string, email: string): WorkspaceMember | undefined {
    const ids = this.memberIdsByOrg.get(orgId);
    if (!ids) return undefined;
    for (const id of ids) {
      const member = this.membersById.get(id);
      if (member && member.email === email) return member;
    }
    return undefined;
  }

  private findPendingInvitation(
    orgId: string,
    email: string,
  ): MembershipInvitation | undefined {
    for (const invitation of this.invitations.values()) {
      if (
        invitation.orgId === orgId &&
        invitation.email === email &&
        invitation.status === "pending" &&
        invitation.expiresAt.getTime() >= Date.now()
      ) {
        return invitation;
      }
    }
    return undefined;
  }

  private countCredentialsForRecipient(
    orgId: string,
    recipientId: string,
    type: string,
  ): number {
    let count = 0;
    for (const id of this.credentialIdsByOrg.get(orgId) ?? []) {
      const credential = this.credentials.get(id);
      if (credential && credential.recipientId === recipientId && credential.type === type) {
        count += 1;
      }
    }
    return count;
  }

  private workspaceBySlug(slug: string): Workspace | undefined {
    for (const workspace of this.workspaces.values()) {
      if (workspace.slug === slug) return workspace;
    }
    return undefined;
  }

  private requireText(value: unknown, field: string): string {
    if (typeof value !== "string" || value.trim().length === 0) {
      throw new ValidationError(`"${field}" is required`);
    }
    return value.trim();
  }

  private normalizeSlug(value: unknown): string {
    const slug = this.requireText(value, "slug").toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slug)) {
      throw new ValidationError(
        `"slug" must contain only lowercase letters, numbers and hyphens`,
      );
    }
    return slug;
  }

  private normalizeEmail(value: unknown): string {
    const email = this.requireText(value, "email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError(`"${email}" is not a valid email address`);
    }
    return email;
  }

  private nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}_${Date.now()}_${this.idCounter}`;
  }
}

export const tenantService = new TenantService();
