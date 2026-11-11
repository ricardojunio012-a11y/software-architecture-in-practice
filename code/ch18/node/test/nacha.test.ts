// The anticorruption layer: translates the settlement into the domain and rejects a
// file whose trailer does not match.
import { describe, expect, it } from "vitest";
import { translateReturn } from "../src/nacha/alpha-bank-return.ts";

const line = (text: string) => text.padEnd(80);
const detail = line("999306MORADA0000C-301     11042026000000000045000000000000000250");

describe("Alpha Bank return file", () => {
  it("translates a settlement into PaymentReceived", () => {
    const trailer = line("9999000001000000000045000");
    const { payments } = translateReturn([detail, trailer].join("\n"));
    expect(payments).toEqual([
      {
        charge: "C-301",
        paidOn: "2026-11-04",
        amountPaidCents: 45000,
        feeCents: 250,
      },
    ]);
  });

  it("rejects the file when the trailer does not match", () => {
    const trailer = line("9999000002000000000090000");
    expect(() => translateReturn([detail, trailer].join("\n"))).toThrow(
      /does not match/,
    );
  });
});
