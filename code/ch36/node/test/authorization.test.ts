import { describe, expect, it } from "vitest";
import { roleAllows, Relations } from "../src/authorization.ts";
import { invoices, people, tuples } from "../src/data.ts";

const relations = new Relations(tuples);
const readable = (id: string, roles: string[]) =>
  invoices
    .filter((inv) => relations.canReadInvoice({ id, roles }, inv))
    .map((inv) => inv.id);

describe("authorization by relation (mini-Zanzibar)", () => {
  it("the resident reads only the invoice for her own unit", () => {
    expect(readable(people.anna, ["resident"])).toEqual(["INV-1001"]);
  });

  it("the board president reads the invoices of his own community", () => {
    expect(readable(people.brian, ["board_president"])).toEqual([
      "INV-1001",
      "INV-1002",
      "INV-1003",
      "INV-1004",
    ]);
  });

  it("the management company reads the communities it manages, as a member", () => {
    expect(readable(people.dora, ["management_company"])).toHaveLength(8);
    expect(readable("client:integration-mc1", ["management_company"])).toHaveLength(8);
  });

  it("the front-desk staff reads no invoices, neither by role nor by relation", () => {
    expect(roleAllows({ id: people.carol, roles: ["front_desk"] })).toBe(false);
    expect(readable(people.carol, ["front_desk"])).toEqual([]);
  });

  it("a cycle in the relations does not hang the check", () => {
    const cycle = new Relations([
      "group:a#member@group:b#member",
      "group:b#member@group:a#member",
    ]);
    expect(cycle.has("group:a", "member", "x")).toBe(false);
  });
});
