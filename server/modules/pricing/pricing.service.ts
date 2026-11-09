import { PricingRepository } from './pricing.repository';
import { AlreadyExistsError, NotFoundError, ValidationError } from '../../shared/database/errors';
import type { PageDto } from '../../shared/database/pagination';
import type { PricingRuleResponse } from './pricing.serializer';
import type { PricingRuleCreateInput, PricingRuleUpdateInput } from './pricing.schema';

/** Pricing business logic — orchestration only; no HTTP, no queries here. */
export class PricingService {
  private get repository(): PricingRepository {
    return new PricingRepository();
  }

  async list(searchParams: URLSearchParams): Promise<PageDto<PricingRuleResponse>> {
    return this.repository.findPaginated(searchParams);
  }

  /** Public read for the landing estimator — never throws; null means "no live rule". */
  async findActivePublic(): Promise<PricingRuleResponse | null> {
    try {
      return await this.repository.findActive();
    } catch {
      return null;
    }
  }

  async findOneById(id: string): Promise<PricingRuleResponse> {
    const rule = await this.repository.findOneById(id);
    if (!rule) throw new NotFoundError('Pricing rule');
    return rule;
  }

  /** Creates a rule; ACTIVE creation takes over exclusivity automatically. */
  async create(input: PricingRuleCreateInput): Promise<PricingRuleResponse> {
    if (await this.repository.findAnyByName(input.name)) {
      throw new AlreadyExistsError('Pricing rule', 'name');
    }
    const rule = await this.repository.create({
      ...input,
      effectiveTo: input.effectiveTo ?? null,
    });
    if (rule.status === 'ACTIVE') await this.repository.retireAllExcept(rule.id);
    return rule;
  }

  async update(id: string, input: PricingRuleUpdateInput): Promise<PricingRuleResponse> {
    const existing = await this.repository.findOneById(id);
    if (!existing) throw new NotFoundError('Pricing rule');
    if (input.name && input.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      if (await this.repository.findAnyByName(input.name)) {
        throw new AlreadyExistsError('Pricing rule', 'name');
      }
    }

    const merged = { ...existing, ...input };
    if (merged.effectiveTo && new Date(merged.effectiveTo) <= new Date(merged.effectiveFrom)) {
      throw new ValidationError('The effective window must end after it starts', {
        fieldErrors: { effectiveTo: ['The window must end after it starts'] },
      });
    }

    if (input.status === 'ACTIVE' && existing.status !== 'ACTIVE') {
      // Taking over: retire every other ACTIVE rule first (one ACTIVE rule at a time).
      await this.repository.retireAllExcept(id);
    }

    return this.repository.update(id, {
      ...input,
      ...(input.effectiveTo !== undefined ? { effectiveTo: input.effectiveTo ?? null } : {}),
    });
  }

  async delete(id: string): Promise<PricingRuleResponse> {
    const existing = await this.repository.findOneById(id);
    if (!existing) throw new NotFoundError('Pricing rule');
    return this.repository.delete(id);
  }
}
