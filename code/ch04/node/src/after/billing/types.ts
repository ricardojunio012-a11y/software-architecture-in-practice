// The types the calculator depends on. None of them knows a concrete rule.
export interface Unit {
  id: string;
  shareMillionths: number;
  resident: { name: string };
  boardPresident?: boolean;
  pastDue: { amountCents: number; dueDate: string } | null;
}

// One item of the charge. Conditional: it applies only to payment by the discount date.
export interface Entry {
  readonly code: string;
  readonly description: string;
  readonly amount: number;
  readonly conditional: boolean;
}

// Each rule looks at the unit and at what was already posted, and returns what it adds.
export interface Rule {
  apply(unit: Unit, posted: readonly Entry[]): Entry[];
}

export function entry(
  code: string,
  description: string,
  amount: number,
  conditional = false,
): Entry {
  return { code, description, amount, conditional };
}

export function amountOf(posted: readonly Entry[], code: string): number {
  return posted.filter((e) => e.code === code).reduce((s, e) => s + e.amount, 0);
}
