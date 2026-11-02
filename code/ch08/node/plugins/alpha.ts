// Alpha Bank plugin: numbers the invoices in sequence, with five digits.
import type { Charge, BankPlugin } from "../src/plugins/core.ts";

let last = 0;

const alpha: BankPlugin = {
  name: "alpha",
  register(_charge: Charge) {
    last += 1;
    return `ALPHA-${String(last).padStart(5, "0")}`;
  },
};

export default alpha;
