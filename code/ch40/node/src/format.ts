// Formatting in dollars, without depending on the locale installed in the image,
// and writing each version's result to output/<version>/result.txt.
import fs from "node:fs";
import path from "node:path";

const thousands = (whole: string) => whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function number(n: number, places = 0): string {
  const [whole, decimal] = Math.abs(n).toFixed(places).split(".");
  const sign = n < 0 && Number(n.toFixed(places)) !== 0 ? "-" : "";
  return sign + thousands(whole) + (decimal ? "." + decimal : "");
}

export function dollars(n: number, places = 0): string {
  const text = number(n, places);
  return text.startsWith("-") ? "-$" + text.slice(1) : "$" + text;
}

export const pct = (n: number) => number(n * 100, 1) + "%";

export function save(version: string, lines: string[]): void {
  const folder = path.join(process.argv[2] ?? ".", "output", version);
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(path.join(folder, "result.txt"), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
}
