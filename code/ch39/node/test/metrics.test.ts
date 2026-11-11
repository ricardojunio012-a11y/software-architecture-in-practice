import { describe, expect, it } from "vitest";
import { interest, options, type Assumptions } from "../src/business-case.ts";
import { parseLog, type Change } from "../src/git.ts";
import { plan } from "../src/history.ts";
import {
  changeCoupling,
  complexity,
  dropLarge,
  hotspots,
  imports,
} from "../src/metrics.ts";

const c = (
  files: string[],
  hours = 1,
  subject = "feat: x",
  author = "Anna",
): Change => ({
  author,
  date: "2026-01-02",
  subject,
  hours,
  files,
});

describe("reading the log", () => {
  it("splits commits, hours and files", () => {
    const log =
      "@@\tAnna Lee\t2026-01-05\tfeat(x): y\t7\n\n3\t1\tsrc/a.ts\n-\t-\tlogo.png\n";
    expect(parseLog(log)).toEqual([
      {
        author: "Anna Lee",
        date: "2026-01-05",
        subject: "feat(x): y",
        hours: 7,
        files: ["src/a.ts", "logo.png"],
      },
    ]);
  });
  it("accepts a commit without the hours trailer", () => {
    expect(parseLog("@@\tAnna\t2026-01-05\tfix: z\t\n1\t0\ta.ts\n")[0].hours).toBe(
      null,
    );
  });
});

describe("metrics", () => {
  it("measures complexity from indentation", () => {
    expect(complexity("a\n  b\n    c\n\n  d\n")).toBe(4);
  });
  it("ignores large commits", () => {
    const large = c(Array.from({ length: 11 }, (_, i) => `f${i}.ts`));
    expect(dropLarge([large, c(["a.ts"])])).toHaveLength(1);
  });
  it("prioritizes what changes a lot and is complex", () => {
    const current = new Map([
      ["hot.ts", "a\n    b\n    c\n"],
      ["ugly.ts", "a\n        b\n        c\n"],
      ["simple.ts", "a\n  b\n"],
    ]);
    const hist = [
      ...Array.from({ length: 10 }, () => c(["hot.ts"])),
      c(["ugly.ts"]),
      ...Array.from({ length: 10 }, () => c(["simple.ts"])),
    ];
    const list = hotspots(hist, current);
    expect(list.map((h) => h.file)).toEqual(["hot.ts", "simple.ts", "ugly.ts"]);
    expect(list[0].priority).toBe(50);
  });
  it("computes the degree of change coupling", () => {
    const hist = [
      ...Array.from({ length: 6 }, () => c(["a.ts", "b.ts"])),
      ...Array.from({ length: 4 }, () => c(["a.ts"])),
      c(["c.ts", "a.ts"]),
    ];
    const pairs = changeCoupling(hist);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ a: "a.ts", b: "b.ts", together: 6 });
    expect(pairs[0].degree).toBeCloseTo(6 / ((11 + 6) / 2));
  });
  it("recognizes an import between the files", () => {
    const text = 'import { issueInvoice } from "./invoices.ts";\n';
    expect(imports(text, "src/billing/invoices.ts")).toBe(true);
    expect(imports(text, "src/billing/cards.ts")).toBe(false);
  });
});

describe("business case", () => {
  const assumptions: Assumptions = {
    hourlyRate: 150,
    personDayRate: 1200,
    paydown: { personDays: 30, people: 2, interestReduction: 0.5 },
    payAlong: { personDays: 15, interestReduction: 0.35 },
    feature: {
      name: "x",
      communities: 3000,
      adoption: 0.1,
      monthlyPrice: 40,
      weeksToday: 6,
      weeksAfter: 4,
    },
  };
  it("compares the file's hours with the rest", () => {
    const hist = [
      c(["q.ts"], 10, "fix: a"),
      c(["q.ts"], 6),
      c(["r.ts"], 2),
      c(["s.ts"], 4),
    ];
    const i = interest(hist, "q.ts", 1, 150);
    expect(i.hoursInFile).toBe(8);
    expect(i.hoursElsewhere).toBe(3);
    expect(i.extraHoursPerQuarter).toBe(10);
    expect(i.interestPerQuarter).toBe(1500);
    expect(i.fixesInFile).toBe(0.5);
  });
  it("charges the feature delay to the options that arrive later", () => {
    const i = interest([c(["q.ts"], 10), c(["r.ts"], 2)], "q.ts", 1, 150);
    const [dontPay, first, along] = options(i, assumptions);
    expect(along.weeksToFeature).toBe(5.5);
    expect(along.featureDelay).toBe(0);
    expect(dontPay.featureDelay).toBeCloseTo((0.5 * 12000 * 12) / 52);
    expect(first.weeksToFeature).toBe(7);
    expect(first.featureDelay).toBeCloseTo((1.5 * 12000 * 12) / 52);
    expect(first.paydownCost).toBe(36000);
    expect(first.total24).toBe(36000 + 2 * first.interestPerYear + first.featureDelay);
  });
});

describe("simulated history", () => {
  it("is the same on every run", () => {
    const a = plan().map((x) => [x.when, x.subject, [...x.changes.keys()]]);
    const b = plan().map((x) => [x.when, x.subject, [...x.changes.keys()]]);
    expect(a).toEqual(b);
  });
});
