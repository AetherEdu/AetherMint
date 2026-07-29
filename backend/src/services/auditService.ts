import { AuditLog, AuditAction, AuditResult, IAuditLog } from '../models/AuditLog';
import { auditLogger, AuditLogEntry } from '../utils/auditLogger';

export interface AuditQueryOptions {
  actor?: string;
  action?: AuditAction;
  resource?: string;
  result?: AuditResult;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export interface PaginatedAuditLog {
  entries: IAuditLog[];
  total: number;
  page: number;
  totalPages: number;
}

export class AuditService {
  private static instance: AuditService;

  private constructor() {}

  static getInstance(): AuditService {
    if (!AuditService.instance) {
      AuditService.instance = new AuditService();
    }
    return AuditService.instance;
  }

  async log(
    actor: string,
    action: AuditAction,
    resource: string,
    options: {
      resourceId?: string;
      details?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
      result?: AuditResult;
      errorMessage?: string;
    } = {}
  ): Promise<void> {
    const entry: Partial<IAuditLog> = {
      actor,
      action,
      resource,
      resourceId: options.resourceId,
      details: options.details || {},
      ipAddress: options.ipAddress || 'unknown',
      userAgent: options.userAgent,
      result: options.result || 'success',
      errorMessage: options.errorMessage,
    };

    try {
      const auditLog = new AuditLog(entry);
      await auditLog.save();
      auditLogger.write(actor, action, resource, options);
    } catch (error) {
      auditLogger.write(actor, action, resource, {
        ...options,
        result: 'failure',
        errorMessage: error instanceof Error ? error.message : 'Database write failed',
      });
    }
  }

  async create(
    actor: string,
    action: AuditAction,
    resource: string,
    options: {
      resourceId?: string;
      details?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
    } = {}
  ): Promise<void> {
    return this.log(actor, action, resource, { ...options, result: 'success' });
  }

  async createFailure(
    actor: string,
    action: AuditAction,
    resource: string,
    options: {
      resourceId?: string;
      details?: Record<string, unknown>;
      ipAddress?: string;
      userAgent?: string;
      errorMessage: string;
    }
  ): Promise<void> {
    return this.log(actor, action, resource, { ...options, result: 'failure' });
  }

  async query(options: AuditQueryOptions): Promise<PaginatedAuditLog> {
    const page = options.page && options.page > 0 ? options.page : 1;
    const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 50;
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = {};

    if (options.actor) {
      query.actor = options.actor;
    }

    if (options.action) {
      query.action = options.action;
    }

    if (options.resource) {
      query.resource = options.resource;
    }

    if (options.result) {
      query.result = options.result;
    }

    if (options.dateFrom || options.dateTo) {
      query.timestamp = {};
      if (options.dateFrom) {
        (query.timestamp as Record<string, Date>).$gte = options.dateFrom;
      }
      if (options.dateTo) {
        (query.timestamp as Record<string, Date>).$lte = options.dateTo;
      }
    }

    const [entries, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limit)
        .select('-__v')
        .lean(),
      AuditLog.countDocuments(query),
    ]);

    return {
      entries: entries as IAuditLog[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getById(id: string): Promise<IAuditLog | null> {
    return AuditLog.findById(id).select('-__v').lean();
  }

  async countByAction(action: AuditAction): Promise<number> {
    return AuditLog.countDocuments({ action });
  }

  async countByActor(actor: string): Promise<number> {
    return AuditLog.countDocuments({ actor });
  }

  async countByDateRange(start: Date, end: Date): Promise<number> {
    return AuditLog.countDocuments({
      timestamp: { $gte: start, $lte: end },
    });
  }

  async archiveOldLogs(archiveBeforeDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - archiveBeforeDays);

    const result = await AuditLog.deleteMany({
      timestamp: { $lt: cutoffDate },
    });

    return result.deletedCount || 0;
  }

  async getStatistics(dateFrom?: Date, dateTo?: Date): Promise<{
    totalEntries: number;
    successCount: number;
    failureCount: number;
    actionCounts: Record<string, number>;
    topActors: Array<{ actor: string; count: number }>;
  }> {
    const matchStage: Record<string, unknown> = {};
    
    if (dateFrom || dateTo) {
      matchStage.timestamp = {};
      if (dateFrom) {
        (matchStage.timestamp as Record<string, Date>).$gte = dateFrom;
      }
      if (dateTo) {
        (matchStage.timestamp as Record<string, Date>).$lte = dateTo;
      }
    }

    const actionCountsAgg = await AuditLog.aggregate([
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 },
        },
      },
    ] as any);

    const topActorsAgg = await AuditLog.aggregate([
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: '$actor',
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ] as any);

    const totalResult = await AuditLog.aggregate([
      ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          success: {
            $sum: { $cond: [{ $eq: ['$result', 'success'] }, 1, 0] },
          },
          failure: {
            $sum: { $cond: [{ $eq: ['$result', 'failure'] }, 1, 0] },
          },
        },
      },
    ] as any);

    return {
      totalEntries: totalResult[0]?.total || 0,
      successCount: totalResult[0]?.success || 0,
      failureCount: totalResult[0]?.failure || 0,
      actionCounts: actionCountsAgg.reduce((acc: Record<string, number>, cur: { _id: string; count: number }) => {
        acc[cur._id] = cur.count;
        return acc;
      }, {}),
      topActors: topActorsAgg.map((item: { _id: string; count: number }) => ({
        actor: item._id,
        count: item.count,
      })),
    };
  }
}

export const auditService = AuditService.getInstance();