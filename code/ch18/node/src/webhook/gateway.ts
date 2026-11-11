// The simulated payment gateway: builds each delivery as it would arrive over the
// network, signed, and reproduces the faults described in the scenario.
import { sign } from "./signature.ts";
import type { Delivery, GatewayEvent } from "./types.ts";

export interface Dispatch {
  id: string;
  secondsAgo: number;
  fault?: "resend" | "forged-signature" | "old-message";
  event: GatewayEvent;
}

const ATTACKER_SECRET = "whsec_" + Buffer.from("any-guess").toString("base64");

export function deliver(secret: string, now: number, dispatch: Dispatch): Delivery {
  const ts = now - dispatch.secondsAgo;
  const body = JSON.stringify(dispatch.event);
  // Whoever does not know the secret can only sign with another one
  const key = dispatch.fault === "forged-signature" ? ATTACKER_SECRET : secret;
  return {
    headers: {
      "webhook-id": dispatch.id,
      "webhook-timestamp": String(ts),
      "webhook-signature": sign(key, dispatch.id, ts, body),
    },
    body,
  };
}
