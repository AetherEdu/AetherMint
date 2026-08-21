/**
 * Tenant Service Unit Tests — closes issue #399.
 *
 * Verifies workspace provisioning, the institution role hierarchy, the member
 * invitation flow, credential-issuance scoping, and cross-tenant data
 * isolation. The service is in-memory, so no database fixture is required.
 */

import {
  InstitutionRole,
  tenantService,
  Workspace,
  WorkspaceMember,
} from "../../src/services/tenants";

describe("tenantService", () => {
  beforeEach(() => {
    tenantService.reset();
  });

  async function provision(
    slug = "riverstone",
    overrides: {
      ownerEmail?: string;
      credentialAuthority?: {
        issuingEnabled?: boolean;
        allowedCredentialTypes?: string[];
        maxIssuancePerMember?: number;
      };
    } = {},
  ): Promise<{ workspace: Workspace; owner: WorkspaceMember }> {
    return tenantService.provisionWorkspace({
      name: "Riverstone University",
      slug,
      ownerEmail: overrides.ownerEmail ?? "dean@riverstone.edu",
      credentialAuthority: overrides.credentialAuthority ?? {
        issuingEnabled: true,
        allowedCredentialTypes: ["degree", "certificate"],
      },
    });
  }

  /** Add a member with the given role and return the accepted member. */
  async function addMember(
    workspace: Workspace,
    owner: WorkspaceMember,
    email: string,
    role: InstitutionRole,
  ): Promise<WorkspaceMember> {
    const invitation = await tenantService.inviteMember(workspace.id, owner.email, {
      email,
      role,
    });
    return tenantService.acceptInvitation(invitation.token, email);
  }

  describe("provisionWorkspace", () => {
    it("creates a workspace and an owner member", async () => {
      const { workspace, owner } = await provision();

      expect(workspace.name).toBe("Riverstone University");
      expect(workspace.slug).toBe("riverstone");
      expect(workspace.status).toBe("active");
      expect(owner.role).toBe(InstitutionRole.OWNER);
      expect(owner.orgId).toBe(workspace.id);
    });

    it("rejects a duplicate slug", async () => {
      await provision("riverstone");
      await expect(provision("riverstone")).rejects.toThrow(/already taken/i);
    });

    it("normalises the slug and owner email", async () => {
      const { workspace, owner } = await provision("RiverStone", {
        ownerEmail: "Dean@Riverstone.EDU",
      });
      expect(workspace.slug).toBe("riverstone");
      expect(owner.email).toBe("dean@riverstone.edu");
    });

    it("rejects an invalid slug", async () => {
      await expect(provision("bad slug!")).rejects.toThrow(/slug/i);
    });

    it("rejects an invalid owner email", async () => {
      await expect(provision("acme", { ownerEmail: "not-an-email" })).rejects.toThrow(
        /email/i,
      );
    });
  });

  describe("role hierarchy and membership management", () => {
    it("lets an owner invite an admin", async () => {
      const { workspace, owner } = await provision();
      const invitation = await tenantService.inviteMember(
        workspace.id,
        owner.email,
        { email: "admin@riverstone.edu", role: InstitutionRole.ADMIN },
      );
      expect(invitation.role).toBe(InstitutionRole.ADMIN);
      expect(invitation.status).toBe("pending");
    });

    it("prevents an admin from inviting another admin (escalation)", async () => {
      const { workspace, owner } = await provision();
      await addMember(workspace, owner, "admin@riverstone.edu", InstitutionRole.ADMIN);

      await expect(
        tenantService.inviteMember(workspace.id, "admin@riverstone.edu", {
          email: "admin2@riverstone.edu",
          role: InstitutionRole.ADMIN,
        }),
      ).rejects.toThrow(/below your own/i);
    });

    it("prevents an instructor from inviting (missing permission)", async () => {
      const { workspace, owner } = await provision();
      await addMember(workspace, owner, "prof@riverstone.edu", InstitutionRole.INSTRUCTOR);

      await expect(
        tenantService.inviteMember(workspace.id, "prof@riverstone.edu", {
          email: "someone@riverstone.edu",
          role: InstitutionRole.REGISTRAR,
        }),
      ).rejects.toThrow(/lacks permission/i);
    });

    it("prevents assigning a role at or above the actor's own level", async () => {
      const { workspace, owner } = await provision();
      const admin = await addMember(
        workspace,
        owner,
        "admin@riverstone.edu",
        InstitutionRole.ADMIN,
      );
      const instructor = await addMember(
        workspace,
        owner,
        "prof@riverstone.edu",
        InstitutionRole.INSTRUCTOR,
      );

      // Admin can demote an instructor to registrar (below admin).
      const promoted = await tenantService.assignRole(
        workspace.id,
        admin.email,
        instructor.id,
        InstitutionRole.REGISTRAR,
      );
      expect(promoted.role).toBe(InstitutionRole.REGISTRAR);

      // Admin cannot promote anyone to admin (equal to their own level).
      await expect(
        tenantService.assignRole(
          workspace.id,
          admin.email,
          instructor.id,
          InstitutionRole.ADMIN,
        ),
      ).rejects.toThrow(/below your own/i);
    });

    it("prevents an admin from modifying the owner", async () => {
      const { workspace, owner } = await provision();
      const admin = await addMember(
        workspace,
        owner,
        "admin@riverstone.edu",
        InstitutionRole.ADMIN,
      );

      await expect(
        tenantService.assignRole(
          workspace.id,
          admin.email,
          owner.id,
          InstitutionRole.REGISTRAR,
        ),
      ).rejects.toThrow(/holding role/i);
    });

    it("refuses to remove the owner", async () => {
      const { workspace, owner } = await provision();
      await expect(
        tenantService.removeMember(workspace.id, owner.email, owner.id),
      ).rejects.toThrow(/owner cannot be removed/i);
    });
  });

  describe("member invitations", () => {
    it("accepts a pending invitation and creates an active member", async () => {
      const { workspace, owner } = await provision();
      const invitation = await tenantService.inviteMember(
        workspace.id,
        owner.email,
        { email: "reg@riverstone.edu", role: InstitutionRole.REGISTRAR },
      );

      const member = await tenantService.acceptInvitation(
        invitation.token,
        "reg@riverstone.edu",
      );
      expect(member.role).toBe(InstitutionRole.REGISTRAR);
      expect(member.status).toBe("active");

      const members = await tenantService.listMembers(workspace.id);
      expect(members.map((m) => m.email)).toContain("reg@riverstone.edu");
    });

    it("rejects acceptance with a different email", async () => {
      const { workspace, owner } = await provision();
      const invitation = await tenantService.inviteMember(
        workspace.id,
        owner.email,
        { email: "reg@riverstone.edu", role: InstitutionRole.REGISTRAR },
      );

      await expect(
        tenantService.acceptInvitation(invitation.token, "other@riverstone.edu"),
      ).rejects.toThrow(/different email/i);
    });

    it("rejects an unknown invitation token", async () => {
      await expect(
        tenantService.acceptInvitation("does-not-exist", "x@example.com"),
      ).rejects.toThrow(/not found/i);
    });

    it("rejects accepting an invitation twice", async () => {
      const { workspace, owner } = await provision();
      const invitation = await tenantService.inviteMember(
        workspace.id,
        owner.email,
        { email: "reg@riverstone.edu", role: InstitutionRole.REGISTRAR },
      );
      await tenantService.acceptInvitation(invitation.token, "reg@riverstone.edu");

      await expect(
        tenantService.acceptInvitation(invitation.token, "reg@riverstone.edu"),
      ).rejects.toThrow(/no longer pending/i);
    });
  });

  describe("credential issuance scoping", () => {
    it("lets a registrar issue an authorised credential type", async () => {
      const { workspace, owner } = await provision();
      const registrar = await addMember(
        workspace,
        owner,
        "reg@riverstone.edu",
        InstitutionRole.REGISTRAR,
      );
      const recipient = await addMember(
        workspace,
        owner,
        "student@riverstone.edu",
        InstitutionRole.REGISTRAR,
      );

      const credential = await tenantService.issueCredential(
        workspace.id,
        registrar.email,
        recipient.id,
        "degree",
      );
      expect(credential.type).toBe("degree");
      expect(credential.recipientEmail).toBe(recipient.email);
      expect(credential.orgId).toBe(workspace.id);
    });

    it("refuses a credential type outside the authority", async () => {
      const { workspace, owner } = await provision();
      const registrar = await addMember(
        workspace,
        owner,
        "reg@riverstone.edu",
        InstitutionRole.REGISTRAR,
      );

      await expect(
        tenantService.issueCredential(
          workspace.id,
          registrar.email,
          registrar.id,
          "transcript",
        ),
      ).rejects.toThrow(/not authorised/i);
    });

    it("refuses issuance when an instructor lacks the permission", async () => {
      const { workspace, owner } = await provision();
      const instructor = await addMember(
        workspace,
        owner,
        "prof@riverstone.edu",
        InstitutionRole.INSTRUCTOR,
      );

      await expect(
        tenantService.issueCredential(
          workspace.id,
          instructor.email,
          instructor.id,
          "degree",
        ),
      ).rejects.toThrow(/lacks permission/i);
    });

    it("refuses issuance when issuing is disabled", async () => {
      const { workspace, owner } = await provision();
      const registrar = await addMember(
        workspace,
        owner,
        "reg@riverstone.edu",
        InstitutionRole.REGISTRAR,
      );
      await tenantService.updateCredentialAuthority(workspace.id, owner.email, {
        issuingEnabled: false,
      });

      await expect(
        tenantService.issueCredential(
          workspace.id,
          registrar.email,
          registrar.id,
          "degree",
        ),
      ).rejects.toThrow(/issuance is disabled/i);
    });

    it("enforces the per-member issuance cap", async () => {
      const { workspace, owner } = await provision();
      const registrar = await addMember(
        workspace,
        owner,
        "reg@riverstone.edu",
        InstitutionRole.REGISTRAR,
      );
      const recipient = await addMember(
        workspace,
        owner,
        "student@riverstone.edu",
        InstitutionRole.REGISTRAR,
      );
      await tenantService.updateCredentialAuthority(workspace.id, owner.email, {
        maxIssuancePerMember: 1,
      });

      await tenantService.issueCredential(
        workspace.id,
        registrar.email,
        recipient.id,
        "degree",
      );
      await expect(
        tenantService.issueCredential(
          workspace.id,
          registrar.email,
          recipient.id,
          "degree",
        ),
      ).rejects.toThrow(/issuance cap/i);
    });
  });

  describe("cross-tenant data isolation", () => {
    it("does not leak members between workspaces", async () => {
      const a = await provision("alpha", { ownerEmail: "dean-a@example.com" });
      const b = await provision("beta", { ownerEmail: "dean-b@example.com" });

      const aMembers = await tenantService.listMembers(a.workspace.id);
      const bMembers = await tenantService.listMembers(b.workspace.id);

      expect(aMembers.map((m) => m.email)).toEqual(["dean-a@example.com"]);
      expect(bMembers.map((m) => m.email)).toEqual(["dean-b@example.com"]);

      // A member of workspace B is not resolvable in workspace A.
      const crossLookup = await tenantService.getMember(
        a.workspace.id,
        b.owner.email,
      );
      expect(crossLookup).toBeNull();
    });

    it("does not leak credentials between workspaces", async () => {
      const a = await provision("alpha", { ownerEmail: "dean-a@example.com" });
      const b = await provision("beta", { ownerEmail: "dean-b@example.com" });

      const registrarA = await addMember(
        a.workspace,
        a.owner,
        "reg-a@example.com",
        InstitutionRole.REGISTRAR,
      );
      const studentA = await addMember(
        a.workspace,
        a.owner,
        "stu-a@example.com",
        InstitutionRole.REGISTRAR,
      );

      await tenantService.issueCredential(
        a.workspace.id,
        registrarA.email,
        studentA.id,
        "degree",
      );

      const credentialsA = await tenantService.listCredentials(a.workspace.id);
      const credentialsB = await tenantService.listCredentials(b.workspace.id);

      expect(credentialsA).toHaveLength(1);
      expect(credentialsB).toHaveLength(0);
    });

    it("refuses to issue a credential to a member of another workspace", async () => {
      const a = await provision("alpha", { ownerEmail: "dean-a@example.com" });
      const b = await provision("beta", { ownerEmail: "dean-b@example.com" });

      const registrarA = await addMember(
        a.workspace,
        a.owner,
        "reg-a@example.com",
        InstitutionRole.REGISTRAR,
      );

      await expect(
        tenantService.issueCredential(
          a.workspace.id,
          registrarA.email,
          b.owner.id,
          "degree",
        ),
      ).rejects.toThrow(/not a member/i);
    });
  });
});
