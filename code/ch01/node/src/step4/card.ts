// New payment method: added without touching the calculation or the invoice.
import type { Charge } from "./calculation.ts";
import type { BillingPeriod } from "./period.ts";
import type { PaymentMethod } from "./payment.ts";

// Made-up code: in a real system, it would come from the card payment processor
export class Card implements PaymentMethod {
  readonly name = "Card payment";

  generateCode(communityId: string, period: BillingPeriod, charge: Charge): string {
    const { unit, total } = charge;
    return `CARD-${communityId}-${period.code}-${unit.id}-${total}`;
  }
}
