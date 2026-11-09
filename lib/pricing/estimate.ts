/**
 * Quote estimate from a pricing rule. Pure and shared, so the public estimator
 * and any future server-side quote use exactly the same arithmetic.
 *
 *   subtotal = baseFare + perKm × km + perM3 × m³
 *   express  = subtotal × expressSurcharge%   (only when requested)
 *   total    = max(minQuote, subtotal + express)
 *
 * All amounts are TND rounded to the millime (3 decimals).
 */
export interface EstimateRule {
  baseFare: number;
  perKm: number;
  perM3: number;
  expressSurcharge: number;
  minQuote: number;
}

export interface EstimateInput {
  distanceKm: number;
  volumeM3: number;
  express: boolean;
}

export interface EstimateBreakdown {
  base: number;
  distance: number;
  volume: number;
  subtotal: number;
  express: number;
  total: number;
  /** True when the minimum quote replaced the computed amount. */
  minimumApplied: boolean;
}

const millimes = (value: number) => Math.round(value * 1000) / 1000;

export function estimateQuote(rule: EstimateRule, input: EstimateInput): EstimateBreakdown {
  const km = Math.max(0, input.distanceKm);
  const m3 = Math.max(0, input.volumeM3);
  const base = millimes(rule.baseFare);
  const distance = millimes(rule.perKm * km);
  const volume = millimes(rule.perM3 * m3);
  const subtotal = millimes(base + distance + volume);
  const express = input.express ? millimes((subtotal * rule.expressSurcharge) / 100) : 0;
  const computed = millimes(subtotal + express);
  const minimumApplied = computed < rule.minQuote;
  return {
    base,
    distance,
    volume,
    subtotal,
    express,
    total: minimumApplied ? millimes(rule.minQuote) : computed,
    minimumApplied,
  };
}
