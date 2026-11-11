import { describe, expect, it } from "vitest";
import { generatePdf, handler } from "../src/function/report.ts";
import { execute, FUNCTION } from "../src/platform.ts";
import { sampleReport } from "../src/reports.ts";

describe("the financial report function", () => {
  it("generates a valid PDF, with the xref table pointing to each object", () => {
    const pdf = generatePdf(sampleReport(0, 100));
    const s = pdf.toString("latin1");
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    const xref = Number(s.match(/startxref\n(\d+)/)![1]);
    expect(s.slice(xref, xref + 4)).toBe("xref");
    const offsets = [...s.matchAll(/^(\d{10}) 00000 n $/gm)].map((m) => Number(m[1]));
    offsets.forEach((p, i) =>
      expect(s.slice(p).startsWith(`${i + 1} 0 obj`)).toBe(true),
    );
  });

  it("always generates the same PDF for the same entries", () => {
    expect(generatePdf(sampleReport(1, 80))).toEqual(generatePdf(sampleReport(1, 80)));
  });

  it("without a bucket, the handler returns only the key and the digest", async () => {
    delete process.env.BUCKET;
    const r = await handler(sampleReport(0, 100));
    expect(r.key).toBe("financial-reports/community-0001/2026-10.pdf");
    expect(r.sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("the simulated function platform", () => {
  it("reuses the warm environment and bills the cold start only once", () => {
    const e = execute([
      { arrival: 0, duration: 100 },
      { arrival: 1000, duration: 100 },
    ]);
    expect(e.map((x) => x.cold)).toEqual([true, false]);
    expect(e[0].billed).toBe(100 + FUNCTION.init);
  });

  it("discards the environment idle for longer than the idle timeout", () => {
    const late = FUNCTION.idleTimeout + 1000;
    const e = execute([
      { arrival: 0, duration: 100 },
      { arrival: late, duration: 100 },
    ]);
    expect(e.map((x) => x.cold)).toEqual([true, true]);
  });

  it("with a concurrency limit, the call waits for a free environment", () => {
    const e = execute(
      [
        { arrival: 0, duration: 1000 },
        { arrival: 0, duration: 1000 },
      ],
      1,
    );
    expect(e.map((x) => [x.cold, x.end])).toEqual([
      [true, 1500],
      [false, 2500],
    ]);
  });
});
