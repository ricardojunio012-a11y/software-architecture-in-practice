// Lamport's clock preserves causality, even with physical clocks out of sync.
import { describe, expect, it } from "vitest";
import { LamportClock } from "../src/clock.ts";

describe("Lamport clock", () => {
  it("the reply has a larger timestamp than the request that caused it", () => {
    const frontDesk = new LamportClock();
    const server = new LamportClock();
    for (let i = 0; i < 5; i++) server.tick(); // the server has seen other events
    const request = frontDesk.tick(); // 1
    const received = server.receive(request); // 7
    const reply = server.tick(); // 8
    const arrival = frontDesk.receive(reply); // 9
    expect(request).toBeLessThan(received);
    expect(reply).toBeLessThan(arrival);
  });
});
