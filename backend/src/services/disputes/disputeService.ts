import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import { Dispute, DisputeStatus, IDispute } from '../../models/Dispute';
import { AuditAction } from '../../models/AuditLog';
import { auditService } from '../auditService';

export interface DisputeActor { id: string; role?: string; }

const isAdmin = (actor: DisputeActor) => actor.role === 'admin' || actor.role === 'ADMIN';

export class DisputeService {
  async open(actor: DisputeActor, input: { listingId: string; escrowId?: string; sellerId?: string; reason: string }, requestMeta: { ipAddress?: string; userAgent?: string } = {}): Promise<IDispute> {
    if (!input.listingId || !input.reason?.trim()) throw new ValidationError('listingId and reason are required');
    if (input.reason.length > 2000) throw new ValidationError('reason must not exceed 2000 characters');
    const existing = await Dispute.findOne({ listingId: input.listingId, buyerId: actor.id, status: { $in: ['open', 'under_review'] } });
    if (existing) throw new ConflictError('An active dispute already exists for this listing');
    const dispute = await Dispute.create({ ...input, buyerId: actor.id, reason: input.reason.trim() });
    await auditService.create(actor.id, AuditAction.DATA_ACCESS, 'marketplace.dispute', { resourceId: String(dispute._id), details: { event: 'opened', listingId: input.listingId }, ...requestMeta });
    return dispute;
  }

  async get(actor: DisputeActor, id: string): Promise<IDispute> {
    const dispute = await Dispute.findById(id);
    if (!dispute) throw new NotFoundError('Dispute not found');
    if (!isAdmin(actor) && dispute.buyerId !== actor.id && dispute.sellerId !== actor.id && dispute.mediatorId !== actor.id) throw new ForbiddenError('You cannot access this dispute');
    return dispute;
  }

  async addEvidence(actor: DisputeActor, id: string, content: string, requestMeta: { ipAddress?: string; userAgent?: string } = {}): Promise<IDispute> {
    if (!content?.trim() || content.length > 4096) throw new ValidationError('Evidence must be between 1 and 4096 characters');
    const dispute = await this.get(actor, id);
    if (!['open', 'under_review'].includes(dispute.status)) throw new ConflictError('Dispute is no longer accepting evidence');
    dispute.evidence.push({ authorId: actor.id, content: content.trim(), createdAt: new Date() });
    if (dispute.status === 'open') dispute.status = 'under_review';
    await dispute.save();
    await auditService.create(actor.id, AuditAction.DATA_ACCESS, 'marketplace.dispute', { resourceId: id, details: { event: 'evidence_added' }, ...requestMeta });
    return dispute;
  }

  async list(actor: DisputeActor, status?: DisputeStatus): Promise<IDispute[]> {
    const query: Record<string, unknown> = isAdmin(actor) ? {} : { $or: [{ buyerId: actor.id }, { sellerId: actor.id }, { mediatorId: actor.id }] };
    if (status) query.status = status;
    return Dispute.find(query).sort({ createdAt: -1 });
  }

  async resolve(actor: DisputeActor, id: string, resolution: 'refund' | 'release', requestMeta: { ipAddress?: string; userAgent?: string } = {}): Promise<IDispute> {
    if (resolution !== 'refund' && resolution !== 'release') throw new ValidationError('resolution must be refund or release');
    if (!isAdmin(actor)) throw new ForbiddenError('Only an administrator or mediator can resolve disputes');
    const dispute = await Dispute.findById(id);
    if (!dispute) throw new NotFoundError('Dispute not found');
    if (!['open', 'under_review'].includes(dispute.status)) throw new ConflictError('Dispute is already resolved');
    dispute.status = resolution === 'refund' ? 'resolved_refund' : 'resolved_release';
    dispute.resolution = resolution;
    dispute.mediatorId = actor.id;
    dispute.resolvedAt = new Date();
    await dispute.save();
    await auditService.create(actor.id, AuditAction.PAYMENT_REFUND, 'marketplace.dispute', { resourceId: id, details: { event: 'resolved', resolution }, ...requestMeta });
    return dispute;
  }
}

export const disputeService = new DisputeService();
