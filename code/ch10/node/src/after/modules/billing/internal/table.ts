// The Billing table: private data of the module. No other module should read it.
export type ChargeStatus = "open" | "paid" | "split";

export interface ChargeRow {
  charge: string;
  unit: string;
  amountCents: number;
  dueDate: string;
  status: ChargeStatus;
  installments: number;
}

export class ChargesTable {
  readonly rows: ChargeRow[] = [];

  find(charge: string): ChargeRow {
    const row = this.rows.find((r) => r.charge === charge);
    if (!row) throw new Error(`charge ${charge} not found`);
    return row;
  }
}
