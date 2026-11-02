// How the resident pays. The calculation does not know which method it is.
import type { Charge } from "./calculation.ts";
import type { BillingPeriod } from "./period.ts";

export interface PaymentMethod {
  readonly name: string;
  generateCode(communityId: string, period: BillingPeriod, charge: Charge): string;
}

// Made-up code: in a real system, it would come from the payment processor
export class Invoice implements PaymentMethod {
  readonly name = "Invoice";

  generateCode(communityId: string, period: BillingPeriod, charge: Charge): string {
    const { unit, total } = charge;
    return `INV-${communityId}-${period.code}-${unit.id}-${total}`;
  }
}
