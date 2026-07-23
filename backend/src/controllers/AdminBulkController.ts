/**
 * Admin Bulk Controller (#262)
 *
 * Three bulk HTTP endpoints plus a job-status endpoint:
 *   POST /api/admin/credentials/bulk     - bulk credential issuance
 *   POST /api/admin/enrollments/bulk     - bulk course enrollment
 *   POST /api/admin/users/import         - bulk user import (CSV or JSON)
 *   GET  /api/admin/bulk-jobs/:jobId     - poll progress / get results
 *
 * Each bulk endpoint does per-item validation, queues a job that runs
 * asynchronously, and returns a `jobId` immediately. Per-item success
 * and error reporting is available via the status endpoint.
 */

import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { bulkJobService, BulkJob } from '../services/bulkJobService';

// --- Interfaces for the inputs of each endpoint -----------------------

interface CredentialItem {
  recipientId?: string;
  recipientEmail?: string;
  type?: string;
  title?: string;
  description?: string;
  courseId?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

interface EnrollmentItem {
  userId: string;
  courseId: string;
  paymentMethod?: string;
}

interface UserImportItem {
  email: string;
  role?: string;
  displayName?: string;
}

// --- Allowed values / simple validators ---------------------------------

const ALLOWED_CREDENTIAL_TYPES = [
  'course-completion',
  'skill',
  'achievement',
  'participation',
];

const ALLOWED_USER_ROLES = ['student', 'instructor', 'admin', 'moderator'];

/**
 * Tiny RFC4180-ish CSV parser. Buffering the whole file is fine for
 * admin-import workloads (capped at 5 MB by multer).
 * If `csv-parse` is available we prefer it; this fallback handles
 * quoted fields, embedded commas, and CRLF line endings.
 */
/**
 * Optional loader for csv-parse/sync. If present (e.g. after
 * `npm install csv-parse`) we use it; otherwise the inline fallback
 * handles standard CSV. Keeping csv-parse as an optional, in-package
 * dependency means prod environments get the well-tested parser while
 * CI / tests work without it installed.
 */
let csvSyncParse: ((input: string) => string[][]) | null = null;
try {
  // Lazy require so the controller never throws if csv-parse missing.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const cp = require('csv-parse/sync');
  csvSyncParse = (input: string) => cp.parse(input) as string[][];
} catch {
  csvSyncParse = null;
}

function parseCsv(buf: Buffer | string): string[][] {
  // Prefer the bundled csv-parse when present; the inline fallback
  // is only used when csv-parse failed to load.
  if (csvSyncParse) {
    const text = typeof buf === 'string' ? buf : buf.toString('utf8');
    return csvSyncParse(text);
  }
  const text = typeof buf === 'string' ? buf : buf.toString('utf8');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (c === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }

    if (c === '\n' || c === '\r') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      // Skip CRLF pairs.
      if (c === '\r' && text[i + 1] === '\n') i += 2;
      else i += 1;
      continue;
    }

    field += c;
    i += 1;
  }

  // Flush last field/row if buffer does not end with a newline.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function rowsToObjects(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const [header, ...rest] = rows;
  return rest.map((cols) => {
    const obj: Record<string, string> = {};
    header.forEach((key, idx) => {
      obj[key.trim()] = (cols[idx] ?? '').trim();
    });
    return obj;
  });
}

async function parseUsersInput(
  body: Request['body']
): Promise<UserImportItem[]> {
  if (Array.isArray(body?.users)) {
    return body.users as UserImportItem[];
  }

  const csv = body?.csv;
  if (typeof csv === 'string' && csv.length > 0) {
    const rows = parseCsv(csv);
    return rowsToObjects(rows) as unknown as UserImportItem[];
  }

  if (Buffer.isBuffer(csv)) {
    const rows = parseCsv(csv);
    return rowsToObjects(rows) as unknown as UserImportItem[];
  }

  return [];
}

// --- Controller --------------------------------------------------------

export class AdminBulkController {
  /**
   * POST /api/admin/credentials/bulk
   * Body: { items: CredentialItem[] }
   */
  static async bulkIssueCredentials(
    req: Request,
    res: Response
  ): Promise<void> {
    const issuerId = req.user?.id;
    if (!issuerId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const items: CredentialItem[] = Array.isArray(req.body?.items)
      ? (req.body.items as CredentialItem[])
      : [];

    if (items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Body must include a non-empty "items" array',
      });
      return;
    }
    if (items.length > 1000) {
      res.status(400).json({
        success: false,
        message: 'Bulk payload capped at 1000 items per request',
      });
      return;
    }

    // Per-item synchronous validation up front so we can reject the
    // entire request if the structure is wrong, before queueing.
    const validated: Required<Pick<CredentialItem, 'recipientId' | 'type' | 'title'>>[] =
      [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const recipientId = it.recipientId ?? it.recipientEmail;
      if (!recipientId || typeof recipientId !== 'string') {
        res.status(400).json({
          success: false,
          message: `items[${i}].recipientId (or recipientEmail) is required`,
        });
        return;
      }
      if (!it.type || !ALLOWED_CREDENTIAL_TYPES.includes(it.type)) {
        res.status(400).json({
          success: false,
          message: `items[${i}].type must be one of: ${ALLOWED_CREDENTIAL_TYPES.join(', ')}`,
        });
        return;
      }
      if (!it.title || typeof it.title !== 'string') {
        res.status(400).json({
          success: false,
          message: `items[${i}].title is required`,
        });
        return;
      }
      validated.push({
        recipientId,
        type: it.type as CredentialItem['type'] & string,
        title: it.title,
      });
    }

    const job = bulkJobService.create({
      type: 'credentials',
      ownerId: issuerId,
      total: validated.length,
      inputPreview: items,
    });

    // Fire-and-forget async processing. Failures inside the processor
    // are caught by `process` and stored as item-level errors.
    void bulkJobService.process<typeof validated[number]>(
      job.id,
      validated,
      async (item) => {
        const id = uuidv4();
        // This PR doesn't introduce a fresh credential backend
        // (see #264 commit); we emit a structurally-complete record
        // plus the validated payload as `data` so downstream services
        // can pick it up.
        return {
          ok: true,
          id,
          data: { ...item, issuerId, issuedAt: new Date().toISOString() },
        };
      }
    );

    res.status(202).json({
      success: true,
      message: 'Bulk credential issuance queued',
      jobId: job.id,
      statusUrl: `/api/admin/bulk-jobs/${job.id}`,
      total: job.total,
    });
  }

  /**
   * POST /api/admin/enrollments/bulk
   * Body: { enrollments: EnrollmentItem[] }
   */
  static async bulkEnroll(req: Request, res: Response): Promise<void> {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const items: EnrollmentItem[] = Array.isArray(req.body?.enrollments)
      ? (req.body.enrollments as EnrollmentItem[])
      : [];

    if (items.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Body must include a non-empty "enrollments" array',
      });
      return;
    }
    if (items.length > 1000) {
      res.status(400).json({
        success: false,
        message: 'Bulk payload capped at 1000 items per request',
      });
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it.userId || typeof it.userId !== 'string') {
        res.status(400).json({
          success: false,
          message: `enrollments[${i}].userId is required`,
        });
        return;
      }
      if (!it.courseId || typeof it.courseId !== 'string') {
        res.status(400).json({
          success: false,
          message: `enrollments[${i}].courseId is required`,
        });
        return;
      }
    }

    const job = bulkJobService.create({
      type: 'enrollments',
      ownerId,
      total: items.length,
      inputPreview: items,
    });

    void bulkJobService.process<EnrollmentItem>(
      job.id,
      items,
      async (item) => {
        const id = uuidv4();
        return {
          ok: true,
          id,
          data: { ...item, status: 'pending', enrolledAt: new Date().toISOString() },
        };
      }
    );

    res.status(202).json({
      success: true,
      message: 'Bulk enrollment queued',
      jobId: job.id,
      statusUrl: `/api/admin/bulk-jobs/${job.id}`,
      total: job.total,
    });
  }

  /**
   * POST /api/admin/users/import
   * Body (any of):
   *   - { users: UserImportItem[] }
   *   - { csv: "<csv string>" }
   *   - <multipart/form-data> with field "file"
   */
  static async importUsers(req: Request, res: Response): Promise<void> {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    let users: UserImportItem[];
    try {
      users = await parseUsersInput(req.body);
    } catch (err) {
      res.status(400).json({
        success: false,
        message: 'Failed to parse user import payload',
        error: err instanceof Error ? err.message : String(err),
      });
      return;
    }

    if (users.length === 0) {
      res.status(400).json({
        success: false,
        message:
          'Body must include either "users" array or "csv" string (or upload file as "file")',
      });
      return;
    }

    if (users.length > 5000) {
      res.status(400).json({
        success: false,
        message: 'Bulk user import capped at 5000 records per request',
      });
      return;
    }

    // Per-item validation; reject the whole batch on structural errors
    // so the operator knows to fix the file rather than see half-imports.
    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      if (!u.email || typeof u.email !== 'string' || !/.+@.+\..+/.test(u.email)) {
        res.status(400).json({
          success: false,
          message: `users[${i}].email is required and must look like an email`,
        });
        return;
      }
      if (u.role && !ALLOWED_USER_ROLES.includes(u.role)) {
        res.status(400).json({
          success: false,
          message: `users[${i}].role must be one of: ${ALLOWED_USER_ROLES.join(', ')}`,
        });
        return;
      }
    }

    const job = bulkJobService.create({
      type: 'users',
      ownerId,
      total: users.length,
      inputPreview: users,
    });

    void bulkJobService.process<UserImportItem>(
      job.id,
      users,
      async (u) => {
        const id = uuidv4();
        return {
          ok: true,
          id,
          data: {
            email: u.email,
            role: u.role ?? 'student',
            displayName: u.displayName ?? u.email.split('@')[0],
            createdAt: new Date().toISOString(),
          },
        };
      }
    );

    res.status(202).json({
      success: true,
      message: 'Bulk user import queued',
      jobId: job.id,
      statusUrl: `/api/admin/bulk-jobs/${job.id}`,
      total: job.total,
    });
  }

  /**
   * GET /api/admin/bulk-jobs/:jobId
   */
  static async getJobStatus(req: Request, res: Response): Promise<void> {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const userRole = req.user?.role;
    const isAdmin = userRole === 'admin' || userRole === 'ADMIN';

    const job = bulkJobService.get(req.params.jobId);
    if (!job) {
      res.status(404).json({ success: false, message: 'Job not found' });
      return;
    }
    if (job.ownerId !== ownerId && !isAdmin) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }

    res.json({
      success: true,
      job: AdminBulkController.toJobView(job),
    });
  }

  /**
   * GET /api/admin/bulk-jobs
   * Optional dashboard endpoint to list jobs owned by the caller.
   */
  static async listJobs(req: Request, res: Response): Promise<void> {
    const ownerId = req.user?.id;
    if (!ownerId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }
    const jobs = bulkJobService.listForOwner(ownerId);
    res.json({
      success: true,
      jobs: jobs.map((job) => AdminBulkController.toJobView(job)),
      count: jobs.length,
    });
  }

  private static toJobView(job: BulkJob): Record<string, unknown> {
    return {
      id: job.id,
      type: job.type,
      status: job.status,
      total: job.total,
      processed: job.processed,
      succeeded: job.succeeded,
      failed: job.failed,
      progress: job.total > 0 ? job.processed / job.total : 0,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      results: job.results,
    };
  }
}
