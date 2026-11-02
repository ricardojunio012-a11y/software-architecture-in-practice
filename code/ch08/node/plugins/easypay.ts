// EasyPay plugin: creates a card payment identified by the unit.
import type { Charge, BankPlugin } from "../src/plugins/core.ts";

const easypay: BankPlugin = {
  name: "easypay",
  register(charge: Charge) {
    return `CARD-${charge.unit.replace("-", "")}`;
  },
};

export default easypay;
