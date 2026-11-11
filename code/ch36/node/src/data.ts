// The lab's data: three communities, twelve invoices, and the relations among
// people, units, communities, and management companies.

export interface Invoice {
  id: string;
  community: string;
  unit: string;
  dueDate: string;
  amountCents: number;
}

const units = [
  ["C-01", "101"],
  ["C-01", "102"],
  ["C-01", "103"],
  ["C-01", "104"],
  ["C-02", "201"],
  ["C-02", "202"],
  ["C-02", "203"],
  ["C-02", "204"],
  ["C-03", "301"],
  ["C-03", "302"],
  ["C-03", "303"],
  ["C-03", "304"],
];

// Sequential identifiers, as in many real systems: easy to guess
export const invoices: Invoice[] = units.map(([community, unit], i) => ({
  id: `INV-${1001 + i}`,
  community,
  unit: `${community}/${unit}`,
  dueDate: "2026-11-05",
  amountCents: 61_000 + i * 1_250,
}));

// The users come from Keycloak: the token's "sub". Service accounts come in
// as "client:<client_id>".
export const people = {
  anna: "0a000000-0000-4000-8000-000000000001",
  brian: "0a000000-0000-4000-8000-000000000002",
  carol: "0a000000-0000-4000-8000-000000000003",
  dora: "0a000000-0000-4000-8000-000000000004",
  ed: "0a000000-0000-4000-8000-000000000005",
};

// Zanzibar-style relations: object#relation@subject. The subject can be a user
// or a set of users (another object#relation).
export const tuples: string[] = [
  `unit:C-01/101#resident@${people.anna}`,
  `unit:C-01/102#resident@${people.brian}`,
  `unit:C-02/201#resident@${people.ed}`,
  `community:C-01#board_president@${people.brian}`,
  `community:C-01#front_desk@${people.carol}`,
  `company:MC-1#member@${people.dora}`,
  "company:MC-1#member@client:integration-mc1",
  "community:C-01#manager@company:MC-1#member",
  "community:C-03#manager@company:MC-1#member",
  "community:C-02#manager@company:MC-2#member",
];
