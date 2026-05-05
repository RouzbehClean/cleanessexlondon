// Commission calculation engine
export type CommissionType = "recurring" | "bonus" | "profit";
export type ProfitTier = "identified" | "created";

export interface RecurringTier { min: number; max: number | null; rate: number }
export interface BonusTier { min: number; max: number | null; amount: number }

export interface CommissionRules {
  recurring_tiers: RecurringTier[];
  bonus_tiers: BonusTier[];
  profit_rate_identified: number;
  profit_rate_created: number;
  profit_min_payout: number;
  profit_max_payout: number;
}

export interface CalcInput {
  type: CommissionType;
  hours?: number | null;
  contract_hours?: number | null;
  profit_amount?: number | null;
  profit_tier?: ProfitTier | null;
  is_new_contract?: boolean | null;
  hours_paid_confirmed?: boolean | null;
}

export interface CalcResult {
  amount: number;
  breakdown: string;
  warnings: string[];
}

export function calculate(input: CalcInput, rules: CommissionRules): CalcResult {
  const warnings: string[] = [];

  if (input.type === "recurring") {
    const h = Number(input.hours ?? 0);
    if (!input.hours_paid_confirmed) warnings.push("Hours not yet confirmed as invoiced & paid");
    const tier = rules.recurring_tiers.find(t => h >= t.min && (t.max == null || h <= t.max));
    if (!tier) {
      return { amount: 0, breakdown: `${h} hrs — below minimum (10 hrs)`, warnings };
    }
    const amt = +(h * tier.rate).toFixed(2);
    return { amount: amt, breakdown: `${h} hrs × £${tier.rate.toFixed(2)} = £${amt.toFixed(2)}`, warnings };
  }

  if (input.type === "bonus") {
    if (!input.is_new_contract) warnings.push("Bonus only applies to NEW contracts");
    const h = Number(input.contract_hours ?? 0);
    const tier = rules.bonus_tiers.find(t => h >= t.min && (t.max == null || h < t.max));
    if (!tier) return { amount: 0, breakdown: "No matching bonus tier", warnings };
    return { amount: tier.amount, breakdown: `${h} hr contract → £${tier.amount} bonus`, warnings };
  }

  if (input.type === "profit") {
    const p = Number(input.profit_amount ?? 0);
    const rate = input.profit_tier === "created" ? rules.profit_rate_created : rules.profit_rate_identified;
    const raw = p * rate;
    let amt = Math.min(raw, rules.profit_max_payout);
    if (raw < rules.profit_min_payout && p > 0) {
      amt = rules.profit_min_payout;
      warnings.push(`Calc £${raw.toFixed(2)} below minimum, rounded up to £${rules.profit_min_payout}`);
    }
    if (raw > rules.profit_max_payout) warnings.push(`Capped at £${rules.profit_max_payout}`);
    amt = +amt.toFixed(2);
    const tierLabel = input.profit_tier === "created" ? "created" : "identified";
    return { amount: amt, breakdown: `£${p.toFixed(2)} profit × ${(rate*100).toFixed(0)}% (${tierLabel}) = £${amt.toFixed(2)}`, warnings };
  }

  return { amount: 0, breakdown: "", warnings: [] };
}

export const TYPE_LABEL: Record<CommissionType, string> = {
  recurring: "Recurring (Hours)",
  bonus: "New Contract Bonus",
  profit: "Specialist (Profit)",
};

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  sent_to_accounts: "Sent to accounts",
  paid: "Paid",
  clawed_back: "Clawed back",
};

export const STATUS_VARIANT: Record<string, "default"|"secondary"|"outline"|"destructive"> = {
  draft: "outline",
  submitted: "secondary",
  approved: "default",
  rejected: "destructive",
  sent_to_accounts: "secondary",
  paid: "default",
  clawed_back: "destructive",
};
