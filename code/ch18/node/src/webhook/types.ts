// What travels between the gateway and Morada.

export interface GatewayEvent {
  type: "charge.paid" | "charge.refunded";
  charge: string;
  amountCents: number;
  version: number;
}

// An HTTP delivery: the three Standard Webhooks headers and the raw body. The
// signature is valid for the body exactly as it arrived, byte for byte.
export interface Delivery {
  headers: {
    "webhook-id": string;
    "webhook-timestamp": string;
    "webhook-signature": string;
  };
  body: string;
}

export interface Charge {
  charge: string;
  status: "open" | "paid" | "refunded";
  version: number;
}

export interface Reply {
  status: number;
  reason: string;
}
