import type { PricingRuleDoc } from '../../shared/database/models/pricing-rule.model';
import type { PricingStatus } from '../../shared/database/enums';

export interface PricingRuleResponse {
  id: string;
  name: string;
  status: PricingStatus;
  currency: string;
  baseFare: number;
  perKm: number;
  perM3: number;
  expressSurcharge: number;
  minQuote: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function serializePricingRule(
  doc: Pick<
    PricingRuleDoc,
    | '_id'
    | 'name'
    | 'status'
    | 'currency'
    | 'baseFare'
    | 'perKm'
    | 'perM3'
    | 'expressSurcharge'
    | 'minQuote'
    | 'effectiveFrom'
    | 'effectiveTo'
    | 'version'
    | 'createdAt'
    | 'updatedAt'
  >,
): PricingRuleResponse {
  return {
    id: String(doc._id),
    name: doc.name,
    status: doc.status,
    currency: doc.currency,
    baseFare: doc.baseFare,
    perKm: doc.perKm,
    perM3: doc.perM3,
    expressSurcharge: doc.expressSurcharge,
    minQuote: doc.minQuote,
    effectiveFrom: doc.effectiveFrom.toISOString(),
    effectiveTo: doc.effectiveTo ? doc.effectiveTo.toISOString() : null,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}
