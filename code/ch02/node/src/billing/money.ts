// Amounts always in cents (integers), so no precision is lost.
// Rounding: half a cent rounds up.

export function shareOf(cents: number, millionths: number): number {
  return Math.floor((cents * millionths + 500000) / 1000000);
}

export function percentOf(cents: number, percent: number): number {
  return Math.floor((cents * percent + 50) / 100);
}

// 123456 -> "1,234.56"
export function dollars(cents: number): string {
  const whole = Math.floor(cents / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return whole + "." + String(cents % 100).padStart(2, "0");
}
