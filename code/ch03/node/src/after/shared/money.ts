// Amounts in cents, rounded half up. Depends on no other module.
export function shareOf(cents: number, millionths: number): number {
  return Math.floor((cents * millionths + 500000) / 1000000);
}

export function percentOf(cents: number, percent: number): number {
  return Math.floor((cents * percent + 50) / 100);
}

export function dollars(c: number): string {
  return (
    Math.floor(c / 100).toLocaleString("en-US") + "." + String(c % 100).padStart(2, "0")
  );
}
