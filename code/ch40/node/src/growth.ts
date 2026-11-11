// The "growth" version: Morada with 10 times more communities in three
// architectures, line by line, and the cost per community along the way.
import { v } from "./inputs.ts";
import { dollars, number, save } from "./format.ts";
import { ARCHITECTURES, installations, monthlyCost, total } from "./model.ts";

const today = v("communities");
const later = 10 * today;
const out = [`10x GROWTH: ${number(today)} to ${number(later)} communities`];

for (const [arch, description] of ARCHITECTURES) {
  const before = monthlyCost(arch, today);
  const after = monthlyCost(arch, later);
  const count = (n: number) => installations(arch, n).length;
  out.push(
    "",
    `${arch}: ${description} (${count(today)} and ${count(later)} installations)`,
    `  ${"line".padEnd(26)}${"grows".padEnd(9)}${number(today).padStart(11)}` +
      `${number(later).padStart(13)}${"times".padStart(7)}`,
  );
  for (let i = 0; i < before.length; i++) {
    const [b, a] = [before[i], after[i]];
    out.push(
      `  ${b.name.padEnd(26)}${b.behavior.padEnd(9)}` +
        `${dollars(b.value).padStart(11)}${dollars(a.value).padStart(13)}` +
        `${number(a.value / b.value, 1).padStart(7)}`,
    );
  }
  const [tb, ta] = [total(before), total(after)];
  out.push(
    `  ${"total".padEnd(34)}${dollars(tb).padStart(12)}${dollars(ta).padStart(13)}` +
      `${number(ta / tb, 1).padStart(7)}`,
    `  per community: ${dollars(tb / today, 2)} -> ${dollars(ta / later, 2)}`,
  );
}

out.push("", "COST PER COMMUNITY ALONG THE WAY");
out.push(
  `  ${"communities".padEnd(14)}` + ARCHITECTURES.map(([a]) => a.padStart(10)).join(""),
);
for (let k = 1; k <= 10; k++) {
  const n = k * today;
  const columns = ARCHITECTURES.map(([a]) => dollars(total(monthlyCost(a, n)) / n, 2));
  out.push(`  ${number(n).padEnd(14)}` + columns.map((c) => c.padStart(10)).join(""));
}

save("growth", out);
