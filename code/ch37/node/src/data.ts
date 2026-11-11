// Fictitious data for Garden Court Condominiums. The SSNs start with 9, a range the
// Social Security Administration does not assign, so they belong to no one.
export type Resident = {
  consumer: number;
  unit: string;
  name: string;
  ssn: string;
  email: string;
};

export const residents: Resident[] = [
  { consumer: 1, unit: "101", name: "Anna Roberts", ssn: "931-41-5926" },
  { consumer: 2, unit: "102", name: "Brian Taylor", ssn: "927-18-2818" },
  { consumer: 3, unit: "302", name: "Charles Mitchell", ssn: "916-18-0339" },
  { consumer: 4, unit: "401", name: "Danielle Smith", ssn: "914-14-2135" },
].map((r) => ({
  ...r,
  email: r.name.toLowerCase().replace(" ", ".") + "@example.com",
}));

// The former resident who asks for deletion
export const FORMER_RESIDENT = 3;

// Events published to the other modules: a public part and a personal part
export type Event = {
  consumer: number;
  type: string;
  time: string;
  public: Record<string, string>;
  personal: Record<string, string>;
};

export function events(): Event[] {
  const list: Event[] = [];
  for (const r of residents) {
    list.push({
      consumer: r.consumer,
      type: "ResidentRegistered",
      time: `2026-09-01T09:0${r.consumer}`,
      public: { unit: r.unit },
      personal: { name: r.name, ssn: r.ssn, email: r.email },
    });
    list.push({
      consumer: r.consumer,
      type: "ChargePaid",
      time: `2026-10-05T10:0${r.consumer}`,
      public: { unit: r.unit, period: "2026-10", amount: "890.00" },
      personal: { payer: r.name },
    });
  }
  list.push({
    consumer: FORMER_RESIDENT,
    type: "PackageReceived",
    time: "2026-10-12T15:30",
    public: { unit: "302" },
    personal: { recipient: "Charles Mitchell" },
  });
  return list.sort((a, b) => a.time.localeCompare(b.time));
}
