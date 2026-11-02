// Amounts in cents and half-up rounding.
export function shareOf(cents: number, millionths: number): number {
  return Math.floor((cents * millionths + 500000) / 1000000);
}

export function percentOf(cents: number, percent: number): number {
  return Math.floor((cents * percent + 50) / 100);
}

// 1,352.18 (US format, with a sign when negative)
export function dollars(c: number): string {
  const a = Math.abs(c);
  const whole = Math.floor(a / 100).toLocaleString("en-US");
  return (c < 0 ? "-" : "") + whole + "." + String(a % 100).padStart(2, "0");
}

// 1352.18 (the format the Alpha Bank API asks for)
export function plainDollars(c: number): string {
  return Math.floor(c / 100) + "." + String(c % 100).padStart(2, "0");
}
