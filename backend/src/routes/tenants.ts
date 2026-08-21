/**
 * @openapi
 * tags:
 *   - name: Tenants
 *     description: Multi-tenant institution workspaces, membership, and scoped credential issuance
 */

import express, { NextFunction, Request, Response } from "express";
import {
  requireMemberContext,
  requireTenantContext,
  requireTenantPermission,
} from "../middleware/tenant";
import { PERMISSIONS, InstitutionRole, tenantService } from "../services/tenants";

const router: express.Router = express.Router();

/**
 * @openapi
 * /api/tenants:
 *   post:
 *     tags: [Tenants]
 *     summary: Provision a new institution workspace
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, slug, ownerEmail]
 *             properties:
 *               name: { type: string, example: "Riverstone University" }
 *               slug: { type: string, example: "riverstone" }
 *               ownerEmail: { type: string, format: email, example: "dean@riverstone.edu" }
 *     responses:
 *       '201':
 *         description: Workspace provisioned
 */
router.post("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workspace, owner } = await tenantService.provisionWorkspace({
      name: req.body.name,
      slug: req.body.slug,
      ownerEmail: req.body.ownerEmail,
      credentialAuthority: req.body.credentialAuthority,
    });
    res.status(201).json({ success: true, data: { workspace, owner } });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /api/tenants/{orgId}:
 *   get:
 *     tags: [Tenants]
 *     summary: Get a workspace by id
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Workspace returned
 */
router.get(
  "/:orgId",
  requireTenantContext,
  (req: Request, res: Response) => {
    res.json({ success: true, data: req.organization });
  },
);

/**
 * @openapi
 * /api/tenants/{orgId}/members:
 *   get:
 *     tags: [Tenants]
 *     summary: List members of a workspace
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Members listed (scoped to the workspace)
 */
router.get(
  "/:orgId/members",
  requireTenantContext,
  requireMemberContext,
  requireTenantPermission(PERMISSIONS.MEMBER_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const members = await tenantService.listMembers(req.organization!.id);
      res.json({ success: true, data: { members, count: members.length } });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/tenants/{orgId}/invitations:
 *   post:
 *     tags: [Tenants]
 *     summary: Invite a member to a workspace
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '201':
 *         description: Invitation created
 */
router.post(
  "/:orgId/invitations",
  requireTenantContext,
  requireMemberContext,
  requireTenantPermission(PERMISSIONS.MEMBER_INVITE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invitation = await tenantService.inviteMember(
        req.organization!.id,
        req.member!.email,
        {
          email: req.body.email,
          role: req.body.role as InstitutionRole,
        },
      );
      res.status(201).json({ success: true, data: invitation });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/tenants/{orgId}/invitations/{token}/accept:
 *   post:
 *     tags: [Tenants]
 *     summary: Accept an invitation and join a workspace
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Invitation accepted
 */
router.post(
  "/:orgId/invitations/:token/accept",
  requireTenantContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const member = await tenantService.acceptInvitation(
        req.params.token,
        req.body.email,
      );
      res.json({ success: true, data: member });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/tenants/{orgId}/members/{memberId}/role:
 *   patch:
 *     tags: [Tenants]
 *     summary: Assign a new role to a workspace member
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Role assigned
 */
router.patch(
  "/:orgId/members/:memberId/role",
  requireTenantContext,
  requireMemberContext,
  requireTenantPermission(PERMISSIONS.MEMBER_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const member = await tenantService.assignRole(
        req.organization!.id,
        req.member!.email,
        req.params.memberId,
        req.body.role as InstitutionRole,
      );
      res.json({ success: true, data: member });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/tenants/{orgId}/members/{memberId}:
 *   delete:
 *     tags: [Tenants]
 *     summary: Remove a member from a workspace
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Member removed
 */
router.delete(
  "/:orgId/members/:memberId",
  requireTenantContext,
  requireMemberContext,
  requireTenantPermission(PERMISSIONS.MEMBER_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await tenantService.removeMember(
        req.organization!.id,
        req.member!.email,
        req.params.memberId,
      );
      res.json({ success: true, message: "Member removed" });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/tenants/{orgId}/credentials:
 *   post:
 *     tags: [Tenants]
 *     summary: Issue a credential scoped to the workspace's authority
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '201':
 *         description: Credential issued
 */
router.post(
  "/:orgId/credentials",
  requireTenantContext,
  requireMemberContext,
  requireTenantPermission(PERMISSIONS.CREDENTIAL_ISSUE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const credential = await tenantService.issueCredential(
        req.organization!.id,
        req.member!.email,
        req.body.recipientId,
        req.body.type,
      );
      res.status(201).json({ success: true, data: credential });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/tenants/{orgId}/credentials:
 *   get:
 *     tags: [Tenants]
 *     summary: List credentials issued by a workspace
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Credentials listed (scoped to the workspace)
 */
router.get(
  "/:orgId/credentials",
  requireTenantContext,
  requireMemberContext,
  requireTenantPermission(PERMISSIONS.MEMBER_MANAGE),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const credentials = await tenantService.listCredentials(req.organization!.id);
      res.json({ success: true, data: { credentials, count: credentials.length } });
    } catch (error) {
      next(error);
    }
  },
);

/**
 * @openapi
 * /api/tenants/{orgId}/credential-authority:
 *   patch:
 *     tags: [Tenants]
 *     summary: Update the workspace's credential authority
 *     parameters:
 *       - in: path
 *         name: orgId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       '200':
 *         description: Credential authority updated
 */
router.patch(
  "/:orgId/credential-authority",
  requireTenantContext,
  requireMemberContext,
  requireTenantPermission(PERMISSIONS.CREDENTIAL_AUTHORITY),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspace = await tenantService.updateCredentialAuthority(
        req.organization!.id,
        req.member!.email,
        req.body,
      );
      res.json({ success: true, data: workspace });
    } catch (error) {
      next(error);
    }
  },
);

export default router;
