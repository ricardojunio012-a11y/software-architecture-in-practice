// Backpressure: with the semaphore, 30 concurrent calls to a processor that accepts 8
// all go through, with no rejections; without it, there are rejections.
import { describe, expect, it } from "vitest";
import { PaymentProcessor, Semaphore } from "../src/processor.ts";

describe("backpressure", () => {
  it("without a semaphore, the processor rejects the excess", async () => {
    const processor = new PaymentProcessor(8);
    await Promise.allSettled(
      Array.from({ length: 30 }, () => processor.createInvoice()),
    );
    expect(processor.rejections).toBe(22);
  });

  it("with a semaphore, all go through and none is rejected", async () => {
    const processor = new PaymentProcessor(8);
    const semaphore = new Semaphore(8);
    await Promise.all(
      Array.from({ length: 30 }, () => semaphore.use(() => processor.createInvoice())),
    );
    expect(processor.calls).toBe(30);
    expect(processor.rejections).toBe(0);
  });
});
