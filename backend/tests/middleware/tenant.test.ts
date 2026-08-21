/**
 * Tenant Isolation Middleware Tests — closes issue #399.
 *
 * Verifies that the middleware resolves the workspace and the caller's
 * membership, enforces the institution role hierarchy, and refuses access
 * across workspace boundaries.
 */

import express from "express";
import request from "supertest";
import {
  requireCredentialAuthority,
  requireMemberContext,
  requireTenantContext,
  requireTenantPermission,
  requireTenantRole,
} from "../../src/middleware/tenant";
import {
  InstitutionRole,
  PERMISSIONS,
  tenantService,
  Workspace,
  WorkspaceMember,
} from "../../src/services/tenants";

const errorHandler = (
  err: any,
  _req: express.Request,
  res: express.Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: express.NextFunction,
) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message,
    status: err.statusCode || 500,
  });
};

async function provision(slug: string): Promise<{
  workspace: Workspace;
  owner: WorkspaceMember;
}> {
  return tenantService.provisionWorkspace({
    name: `${slug} University`,
    slug,
    ownerEmail: `dean@${slug}.edu`,
    credentialAuthority: {
      issuingEnabled: true,
      allowedCredentialTypes: ["degree"],
    },
  });
}

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

function buildApp(middleware: express.RequestHandler[]) {
  const app = express();
  app.use(express.json());
  app.get("/:orgId/members", middleware, (_req, res) => {
    res.json({ success: true, data: { members: [] } });
  });
  app.post("/:orgId/credentials", middleware, (req, res) => {
    res.json({ success: true, type: req.body.type });
  });
  app.use(errorHandler);
  return app;
}

describe("tenant isolation middleware", () => {
  beforeEach(() => {
    tenantService.reset();
  });

  it("resolves the workspace and membership for a valid member", async () => {
    const { workspace, owner } = await provision("alpha");
    const app = buildApp([
      requireTenantContext,
      requireMemberContext,
      requireTenantPermission(PERMISSIONS.MEMBER_MANAGE),
    ]);

    const res = await request(app)
      .get(`/${workspace.id}/members`)
      .set("x-member-email", owner.email);

    expect(res.status).toBe(200);
    expect(res.headers["x-organization-id"]).toBe(workspace.id);
  });

  it("returns 404 for an unknown workspace", async () => {
    const app = buildApp([requireTenantContext]);

    const res = await request(app).get("/does-not-exist/members");

    expect(res.status).toBe(404);
  });

  it("returns 401 when membership is required but no identity is supplied", async () => {
    const { workspace } = await provision("alpha");
    const app = buildApp([requireTenantContext, requireMemberContext]);

    const res = await request(app).get(`/${workspace.id}/members`);

    expect(res.status).toBe(401);
  });

  it("blocks a member from accessing another workspace (cross-tenant isolation)", async () => {
    const a = await provision("alpha");
    const b = await provision("beta");
    const app = buildApp([
      requireTenantContext,
      requireMemberContext,
      requireTenantPermission(PERMISSIONS.MEMBER_MANAGE),
    ]);

    // The owner of workspace A must not be treated as a member of workspace B.
    const res = await request(app)
      .get(`/${b.workspace.id}/members`)
      .set("x-member-email", a.owner.email);

    expect(res.status).toBe(403);
  });

  it("denies a member who lacks the required permission", async () => {
    const { workspace, owner } = await provision("alpha");
    const registrar = await addMember(
      workspace,
      owner,
      "reg@alpha.edu",
      InstitutionRole.REGISTRAR,
    );
    const app = buildApp([
      requireTenantContext,
      requireMemberContext,
      requireTenantPermission(PERMISSIONS.MEMBER_MANAGE),
    ]);

    const res = await request(app)
      .get(`/${workspace.id}/members`)
      .set("x-member-email", registrar.email);

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/lacks permission/i);
  });

  it("requireTenantRole enforces an explicit role allow-list", async () => {
    const { workspace, owner } = await provision("alpha");
    const admin = await addMember(
      workspace,
      owner,
      "admin@alpha.edu",
      InstitutionRole.ADMIN,
    );
    const registrar = await addMember(
      workspace,
      owner,
      "reg@alpha.edu",
      InstitutionRole.REGISTRAR,
    );
    const app = buildApp([
      requireTenantContext,
      requireMemberContext,
      requireTenantRole(InstitutionRole.OWNER, InstitutionRole.ADMIN),
    ]);

    const allowed = await request(app)
      .get(`/${workspace.id}/members`)
      .set("x-member-email", admin.email);
    const denied = await request(app)
      .get(`/${workspace.id}/members`)
      .set("x-member-email", registrar.email);

    expect(allowed.status).toBe(200);
    expect(denied.status).toBe(403);
  });

  it("requireCredentialAuthority gates issuance by the configured authority", async () => {
    const { workspace, owner } = await provision("alpha");
    const registrar = await addMember(
      workspace,
      owner,
      "reg@alpha.edu",
      InstitutionRole.REGISTRAR,
    );
    const app = buildApp([
      requireTenantContext,
      requireMemberContext,
      requireTenantPermission(PERMISSIONS.CREDENTIAL_ISSUE),
      requireCredentialAuthority("degree"),
    ]);

    const allowed = await request(app)
      .post(`/${workspace.id}/credentials`)
      .set("x-member-email", registrar.email)
      .send({ type: "degree" });

    expect(allowed.status).toBe(200);
  });

  it("requireCredentialAuthority refuses a type outside the authority", async () => {
    const { workspace, owner } = await provision("alpha");
    const registrar = await addMember(
      workspace,
      owner,
      "reg@alpha.edu",
      InstitutionRole.REGISTRAR,
    );
    const app = buildApp([
      requireTenantContext,
      requireMemberContext,
      requireTenantPermission(PERMISSIONS.CREDENTIAL_ISSUE),
      requireCredentialAuthority("transcript"),
    ]);

    const res = await request(app)
      .post(`/${workspace.id}/credentials`)
      .set("x-member-email", registrar.email)
      .send({ type: "transcript" });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/not authorised/i);
  });
});
