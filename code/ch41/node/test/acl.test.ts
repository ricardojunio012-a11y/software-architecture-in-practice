// The anticorruption layer and the parallel-run comparator, with no database and no
// network.
import { describe, expect, it } from "vitest";
import { cents, isoDate, translate, RULES_V1, type Legacy } from "../src/acl/beta.ts";
import { compare, routeOf } from "../src/proxy.ts";

const legacy: Legacy = {
  properties: [
    { code: "P0101", name: "ACACIA GROVE TOWER A", ein: "12-3456789" },
    { code: "P0102", name: "ACACIA GROVE TOWER B", ein: "12-3456789" },
  ],
  apts: [
    {
      property: "P0101",
      apt: "0101",
      type: "A",
      share: "0.500000",
      link: "",
      notes: "BOARD PRES",
    },
    {
      property: "P0102",
      apt: "0101",
      type: "A",
      share: "0.400000",
      link: "",
      notes: "",
    },
    {
      property: "P0101",
      apt: "G-01",
      type: "G",
      share: "0.100000",
      link: "P0102/0101",
      notes: "",
    },
  ],
  budgets: [{ period: "10/2026", amount: "1,000.00" }],
  assessments: [
    {
      property: "P0102",
      apt: "0101",
      period: "10/2026",
      due: "10/10/2026",
      amount: "1,048.72",
      paid: "Y",
      pay_date: "05/10/2026",
    },
  ],
};

describe("legacy formats", () => {
  it("reads the legacy's amounts and day-first dates and refuses the rest", () => {
    expect(cents("1,048.72")).toBe(104872);
    expect(cents("0.07")).toBe(7);
    expect(() => cents("1048.72")).toThrow();
    expect(isoDate("05/10/2026")).toBe("2026-10-05");
    expect(() => isoDate("2026-10-05")).toThrow();
  });
});

describe("translation", () => {
  it("joins the towers into one community with buildings and links the space", () => {
    const t = translate(legacy, RULES_V1);
    expect(t.community.id).toBe("c12345678");
    expect(t.units.map((u) => u.id)).toEqual(["c12345678-A-0101", "c12345678-B-0101"]);
    expect(t.spaces).toEqual([
      { id: "c12345678-G-01", unit_id: "c12345678-B-0101", share: "0.100000" },
    ]);
    expect(t.charges[0]).toMatchObject({
      amount_cents: 104872,
      paid_on: "2026-10-05",
    });
  });

  it("quarantines the parking space with no link, instead of guessing", () => {
    const noLink = structuredClone(legacy);
    noLink.apts[2].link = "";
    const t = translate(noLink, RULES_V1);
    expect(t.spaces).toEqual([]);
    expect(t.quarantine).toEqual([
      { legacy_key: "P0101/G-01", reason: "parking space with no unit" },
    ]);
    const decided = { ...RULES_V1, links: { "P0101/G-01": "P0101/0101" } };
    expect(translate(noLink, decided).spaces[0].unit_id).toBe("c12345678-A-0101");
  });

  it("marks the board president's exemption only with the version 2 rule", () => {
    expect(translate(legacy, RULES_V1).units[0].exempt).toBe(false);
    const v2 = { ...RULES_V1, exemptionFromNotes: true };
    expect(translate(legacy, v2).units[0].exempt).toBe(true);
  });
});

describe("parallel-run comparator", () => {
  const item = (apt: string, amount: string) => ({ apt, period: "11/2026", amount });

  it("separates accepted rounding, a difference, and a missing item", () => {
    const old = [
      item("0101", "0.00"),
      item("0102", "1,258.48"),
      item("G-09", "104.88"),
    ];
    const fresh = [item("0101", "1,048.73"), item("0102", "1,258.49")];
    expect(compare(old, fresh)).toEqual([
      { key: "0101 11/2026", kind: "different" },
      { key: "0102 11/2026", kind: "rounding (accepted)" },
      { key: "G-09 11/2026", kind: "missing in Morada" },
    ]);
  });

  it("identifies the route of the old contract", () => {
    const path = "/properties/P0101/assessments?period=10/2026";
    expect(routeOf("GET", path)).toBe("GET assessments");
    expect(routeOf("POST", "/properties/P0101/assessments/0101/pay")).toBe("POST pay");
    expect(routeOf("GET", "/reports/form1099?year=2025")).toBe("GET form1099");
  });
});
