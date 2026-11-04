import { connectMongo } from '../../shared/database/mongoose';
import {
  PricingRuleModel,
  type PricingRuleDoc,
} from '../../shared/database/models/pricing-rule.model';
import { AbstractRepository } from '../../shared/database/repository';
import { compileSort, parseListQuery } from '../../shared/database/query-builder';
import { createPageDto, type PageDto } from '../../shared/database/pagination';
import { serializePricingRule, type PricingRuleResponse } from './pricing.serializer';

/** Pricing data access — the only place that knows about the `pricingrules` collection. */
export class PricingRepository extends AbstractRepository<PricingRuleResponse> {
  private async model() {
    await connectMongo();
    return PricingRuleModel;
  }

  async findOneById(id: string): Promise<PricingRuleResponse | null> {
    const doc = await (await this.model()).findOne({ _id: id, deletedAt: null }).lean();
    return doc ? serializePricingRule(doc as unknown as PricingRuleDoc) : null;
  }

  async findAnyByName(name: string): Promise<PricingRuleDoc | null> {
    const doc = await (
      await this.model()
    )
      .findOne({ name: { $regex: `^${escapeRegExp(name.trim())}$`, $options: 'i' } })
      .lean();
    return doc ?? null;
  }

  async findMany(): Promise<PricingRuleResponse[]> {
    const docs = await (
      await this.model()
    )
      .find({ deletedAt: null })
      .sort({ createdAt: -1 })
      .lean<PricingRuleDoc[]>();
    return docs.map((doc) => serializePricingRule(doc));
  }

  /** Standardized paginated list (query DSL) with an optional status filter. */
  async findPaginated(searchParams: URLSearchParams): Promise<PageDto<PricingRuleResponse>> {
    const query = parseListQuery(searchParams);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = { deletedAt: null };
    if (status === 'ACTIVE' || status === 'RETIRED') where.status = status;
    if (query.search) where.name = { $regex: escapeRegExp(query.search), $options: 'i' };
    const orderBy: Record<string, 'asc' | 'desc'> | Record<string, 1 | -1> = query.sort
      ? compileSort(query.sort, ['name', 'status', 'createdAt', 'baseFare'])
      : { createdAt: -1 };

    const M = await this.model();
    const [itemCount, docs] = await Promise.all([
      M.countDocuments(where),
      M.find(where)
        .sort(orderBy)
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean<PricingRuleDoc[]>(),
    ]);

    return createPageDto(
      docs.map((doc) => serializePricingRule(doc)),
      query.page,
      query.limit,
      itemCount,
    );
  }

  async count(where: Record<string, unknown> = {}): Promise<number> {
    return (await this.model()).countDocuments({ deletedAt: null, ...where });
  }

  async create(data: Record<string, unknown>): Promise<PricingRuleResponse> {
    const doc = await (await this.model()).create(data);
    return serializePricingRule(doc);
  }

  async update(id: string, data: Record<string, unknown>): Promise<PricingRuleResponse> {
    const doc = await PricingRuleModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: data, $inc: { version: 1 } },
      { returnDocument: 'after' },
    ).lean<PricingRuleDoc | null>();
    if (!doc) throw new Error('Pricing rule not found during update');
    return serializePricingRule(doc);
  }

  /** Retires every other ACTIVE rule — used when a rule takes over exclusivity. */
  async retireAllExcept(id: string): Promise<void> {
    await (
      await this.model()
    ).updateMany(
      { _id: { $ne: id }, status: 'ACTIVE', deletedAt: null },
      { $set: { status: 'RETIRED' }, $inc: { version: 1 } },
    );
  }

  async countDocuments(where: Record<string, unknown> = {}): Promise<number> {
    return this.count(where);
  }

  /** The live rule: ACTIVE, not deleted, and inside its effective window right now. */
  async findActive(now = new Date()): Promise<PricingRuleResponse | null> {
    const doc = await (
      await this.model()
    )
      .findOne({
        status: 'ACTIVE',
        deletedAt: null,
        effectiveFrom: { $lte: now },
        $or: [{ effectiveTo: null }, { effectiveTo: { $gt: now } }],
      })
      .sort({ updatedAt: -1 })
      .lean<PricingRuleDoc>();
    return doc ? serializePricingRule(doc) : null;
  }

  async activeCount(): Promise<number> {
    return this.count({ status: 'ACTIVE' });
  }

  async delete(id: string): Promise<PricingRuleResponse> {
    const doc = await PricingRuleModel.findOneAndUpdate(
      { _id: id, deletedAt: null },
      { $set: { deletedAt: new Date() } },
      { returnDocument: 'after' },
    ).lean<PricingRuleDoc | null>();
    if (!doc) throw new Error('Pricing rule not found during delete');
    return serializePricingRule(doc);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
