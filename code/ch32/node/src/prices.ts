// Public AWS on-demand prices in N. Virginia (us-east-1), in dollars, checked
// against the official price lists (AWS Price List) on 10/29/2026:
//   AWSLambda   published 10/22/2026
//   AmazonEKS   published 10/27/2026
//   AmazonEC2   on-demand Linux price for us-east-1, same day
// Prices change: check them again before deciding with these numbers.
export const PRICES = {
  lambdaPerRequest: 0.0000002, // $0.20 per million
  lambdaPerGbSecond: 0.0000166667, // x86, first tier
  eksPerHour: 0.1, // cluster control plane, standard support
  nodePerHour: 0.0816, // m7g.large (2 vCPU, 8 GiB), Linux
};

// Premise of the lab
export const HOURS_PER_MONTH = 720; // the simulated month has 30 days

// 1234.5 -> "1,234.50", without depending on the image's locale data
export function num(v: number, decimals = 2): string {
  const [int, dec] = v.toFixed(decimals).split(".");
  const thousands = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return dec ? `${thousands}.${dec}` : thousands;
}
export const usd = (v: number) => `$${num(v)}`;
