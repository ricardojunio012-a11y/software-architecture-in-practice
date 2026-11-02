// Simulates the API of a card payment processor. Another company, another format:
// amounts in cents, ISO dates and a reference chosen by whoever creates the payment.
export interface PaymentRequest {
  reference: string;
  amountCents: number;
  expiresOn: string;
  discountCents?: number;
  discountUntil?: string;
}

export class EasyPayApi {
  createPayment(payment: PaymentRequest): { reference: string; status: string } {
    if (payment.amountCents <= 0) throw new Error("invalid amount");
    return { reference: payment.reference, status: "ACTIVE" };
  }
}
