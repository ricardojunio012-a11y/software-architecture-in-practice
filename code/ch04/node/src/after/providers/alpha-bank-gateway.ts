// Adapter: translates the Morada charge into the Alpha Bank API (ACH invoice).
import { usDate } from "../../shared/dates.ts";
import { plainDollars } from "../../shared/money.ts";
import type { AlphaBankClient } from "../../external/alpha-bank.ts";
import type { Charge } from "../billing/charge.ts";
import type { Deadlines, PaymentGateway, Registration } from "../issuing/gateway.ts";

export class AlphaBankGateway implements PaymentGateway {
  readonly name = "Alpha Bank";
  readonly #client: AlphaBankClient;

  constructor(client: AlphaBankClient) {
    this.#client = client;
  }

  register(charge: Charge, deadlines: Deadlines): Registration {
    const { invoiceNumber } = this.#client.createInvoice({
      payer: charge.resident,
      amount: plainDollars(charge.total),
      dueDate: usDate(deadlines.dueDate),
      ...(charge.discount > 0 && {
        discount: {
          amount: plainDollars(charge.discount),
          until: usDate(deadlines.discountUntil),
        },
      }),
    });
    return { unit: charge.unit, identifier: `invoice ${invoiceNumber}` };
  }
}
