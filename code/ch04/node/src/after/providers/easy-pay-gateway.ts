// Adapter: translates the Morada charge into the EasyPay API (card payment).
import type { EasyPayApi } from "../../external/easy-pay.ts";
import type { Charge } from "../billing/charge.ts";
import type { Deadlines, PaymentGateway, Registration } from "../issuing/gateway.ts";

export class EasyPayGateway implements PaymentGateway {
  readonly name = "EasyPay";
  readonly #api: EasyPayApi;

  constructor(api: EasyPayApi) {
    this.#api = api;
  }

  register(charge: Charge, deadlines: Deadlines): Registration {
    // One reference per month and unit: MORADA202603A101
    const month = deadlines.dueDate.slice(0, 7).replace("-", "");
    const { reference } = this.#api.createPayment({
      reference: "MORADA" + month + charge.unit.replace("-", ""),
      amountCents: charge.total,
      expiresOn: deadlines.dueDate,
      ...(charge.discount > 0 && {
        discountCents: charge.discount,
        discountUntil: deadlines.discountUntil,
      }),
    });
    return { unit: charge.unit, identifier: `card ${reference}` };
  }
}
