// Tests: the home screen in one call, the idempotent batch, and the detected conflict.
import { describe, expect, it } from "vitest";
import { Bookings, FrontDesk } from "../src/backend.ts";
import { StaffBff } from "../src/bff.ts";

function build() {
  const frontDesk = new FrontDesk([{ id: "P-1", unit: "A-1" }]);
  const bookings = new Bookings([
    { booking: "R-1", space: "party-room", names: ["Anna"] },
  ]);
  return new StaffBff(frontDesk, bookings);
}

const deliver = {
  id: "op-A1",
  type: "deliver" as const,
  packageId: "P-1",
  seenVersion: 1,
  time: "09:00",
};

describe("front-desk staff BFF", () => {
  it("builds the home screen with packages and visitors in one call", () => {
    const screen = build().home();
    expect(screen.pendingPackages).toEqual([{ id: "P-1", unit: "A-1", version: 1 }]);
    expect(screen.expectedVisitors.map((v) => v.name)).toEqual(["Anna"]);
  });

  it("does not mistake a visitor for another whose name contains theirs", () => {
    const frontDesk = new FrontDesk([]);
    const names = ["Anna", "Mary Anna"];
    const bff = new StaffBff(
      frontDesk,
      new Bookings([{ booking: "R-1", space: "party-room", names }]),
    );
    bff.sync("A", [
      {
        id: "op-A1",
        type: "registerVisitor",
        name: "Mary Anna",
        booking: "R-1",
        time: "09:00",
      },
    ]);
    expect(bff.home().expectedVisitors.map((v) => v.name)).toEqual(["Anna"]);
  });

  it("does not apply a resent batch twice", () => {
    const bff = build();
    bff.sync("A", [deliver]);
    const [[, result]] = bff.sync("A", [deliver]);
    expect(result).toBe("applied");
    expect(bff.repeated).toBe(1);
  });

  it("with persisted results, recognizes the batch after a restart", () => {
    const frontDesk = new FrontDesk([{ id: "P-1", unit: "A-1" }]);
    const bookings = new Bookings([]);
    const table = new Map<string, string>();
    new StaffBff(frontDesk, bookings, table).sync("A", [deliver]);
    const after = new StaffBff(frontDesk, bookings, table);
    const [[, result]] = after.sync("A", [deliver]);
    expect(result).toBe("applied");
    expect(after.repeated).toBe(1);
  });

  it("reports a conflict when the package changed after the tablet saw it", () => {
    const bff = build();
    bff.sync("B", [{ ...deliver, id: "op-B1", type: "return" }]);
    const [[, result]] = bff.sync("A", [deliver]);
    expect(result).toBe("conflict: P-1 already returned by tablet B at 09:00");
  });
});
