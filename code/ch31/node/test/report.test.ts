// The core tested with the in-memory adapters only: no network, no cloud.
import { describe, expect, it } from "vitest";
import { fakePdf } from "../src/input.ts";
import { inMemoryCloud } from "../src/memory.ts";
import { notifyResidents, publishReport } from "../src/report.ts";

describe("publishing the financial report", () => {
  it("publishing twice produces a single notice", async () => {
    const cloud = inMemoryCloud();
    const pdf = fakePdf("102", "2026-10");
    expect(await publishReport(cloud, "102", "2026-10", pdf)).toBe("published");
    expect(await publishReport(cloud, "102", "2026-10", pdf)).toBe("duplicate");
    const notices = await notifyResidents(cloud);
    expect(notices).toHaveLength(1);
    expect(notices[0]).toContain(`${pdf.length} bytes`);
  });
});
