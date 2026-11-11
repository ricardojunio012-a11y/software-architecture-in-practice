// Authorization in two layers: the role (RBAC), which comes in the token, and the
// relation to the object (ReBAC), which comes from Morada's data.
import type { Invoice } from "./data.ts";

export interface User {
  id: string; // the token's "sub", or "client:<client_id>" for a service account
  roles: string[];
}

// RBAC: which roles may use the "read invoices" function, in any community
const ROLES_THAT_READ_INVOICES = ["resident", "board_president", "management_company"];

export function roleAllows(user: User): boolean {
  return user.roles.some((r) => ROLES_THAT_READ_INVOICES.includes(r));
}

// ReBAC: a mini-Zanzibar. "has" answers whether the user has the relation to the
// object, directly or through a set (object#relation) that contains the user.
export class Relations {
  private readonly byObject = new Map<string, string[]>();

  constructor(tuples: string[]) {
    for (const t of tuples) {
      const [objectRelation, subject] = t.split("@");
      const list = this.byObject.get(objectRelation) ?? [];
      list.push(subject);
      this.byObject.set(objectRelation, list);
    }
  }

  has(object: string, relation: string, user: string, depth = 0): boolean {
    if (depth > 5) return false; // a limit against cycles in the relations
    for (const subject of this.byObject.get(`${object}#${relation}`) ?? []) {
      if (subject === user) return true;
      if (subject.includes("#")) {
        const [obj, rel] = subject.split("#");
        if (this.has(obj, rel, user, depth + 1)) return true;
      }
    }
    return false;
  }

  // The rule for the "invoice" object: whoever lives in the unit, the community's
  // board president, and the members of the community's management company
  canReadInvoice(user: User, inv: Invoice): boolean {
    const u = user.id;
    return (
      this.has(`unit:${inv.unit}`, "resident", u) ||
      this.has(`community:${inv.community}`, "board_president", u) ||
      this.has(`community:${inv.community}`, "manager", u)
    );
  }
}
