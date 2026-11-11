// The lab's input: three communities publish the October financial report,
// and 102 publishes twice (the board president clicked again).
export const PUBLICATIONS: [string, string][] = [
  ["101", "2026-10"],
  ["102", "2026-10"],
  ["102", "2026-10"],
  ["103", "2026-10"],
];

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

// A fake "PDF", with a predictable size, so the output is always the same
export function fakePdf(community: string, month: string): Uint8Array {
  const lines = [`%PDF-1.7`, `% Financial report ${community} ${month}`];
  for (let i = 1; i <= 10 + (Number(community) % 5); i++) {
    lines.push(`entry ${i}: ${usd.format(i * 137.5)}`);
  }
  return new TextEncoder().encode(lines.join("\n") + "\n%%EOF\n");
}
