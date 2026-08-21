/**
 * Organization Model
 *
 * Persistence model and shared types for the multi-tenant institution
 * workspaces feature (issue #399). An `Organization` is an isolated
 * institution workspace (university, training provider, ...) that owns its
 * members, their roles, and the credential types it is authorised to issue.
 *
 * The reference service (`services/tenants/TenantService`) keeps its state in
 * memory so it can run without a database; this schema is the persistence
 * shape the database-backed path writes through.
 */

import mongoose, { Document, Model, Schema } from "mongoose";

export enum OrganizationStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
}

/**
 * The credential types an institution is authorised to issue. Issuing a
 * credential is refused unless `issuingEnabled` is true and the requested
 * type is present in `allowedCredentialTypes`.
 */
export interface CredentialAuthority {
  issuingEnabled: boolean;
  allowedCredentialTypes: string[];
  /** Optional per-member cap on the number of credentials of a given type. */
  maxIssuancePerMember?: number;
}

export interface IOrganization extends Document {
  name: string;
  /** URL-friendly unique identifier used for the workspace and its routes. */
  slug: string;
  status: OrganizationStatus;
  credentialAuthority: CredentialAuthority;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: /^[a-z0-9-]+$/,
    },
    status: {
      type: String,
      enum: Object.values(OrganizationStatus),
      default: OrganizationStatus.ACTIVE,
      index: true,
    },
    credentialAuthority: {
      issuingEnabled: {
        type: Boolean,
        default: true,
      },
      allowedCredentialTypes: {
        type: [String],
        default: [],
      },
      maxIssuancePerMember: {
        type: Number,
      },
    },
  },
  {
    timestamps: true,
  },
);

export const Organization: Model<IOrganization> = mongoose.model<IOrganization>(
  "Organization",
  OrganizationSchema,
);
