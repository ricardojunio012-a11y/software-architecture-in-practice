// Beta Bank plugin: another number format, same contract.
import type { Charge, BankPlugin } from "../src/plugins/core.ts";

let last = 0;

const beta: BankPlugin = {
  name: "beta",
  register(_charge: Charge) {
    last += 1;
    return `BETA/${String(last).padStart(4, "0")}`;
  },
};

export default beta;
