// The core (microkernel): it knows how to issue the batch of charges, but knows no
// bank. Each bank is a plugin that fulfills the contract below, discovered in a folder.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export interface Charge {
  unit: string;
  amountCents: number;
  bank: string;
}

// The contract: everything the core knows about a plugin
export interface BankPlugin {
  name: string;
  register(charge: Charge): string;
}

export function dollars(cents: number): string {
  const whole = String(Math.floor(cents / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `$${whole}.${String(cents % 100).padStart(2, "0")}`;
}

export class Core {
  readonly #plugins = new Map<string, BankPlugin>();

  install(plugin: BankPlugin) {
    if (typeof plugin?.name !== "string" || typeof plugin.register !== "function") {
      throw new Error("plugin does not fulfill the contract");
    }
    this.#plugins.set(plugin.name, plugin);
  }

  // Discovery: each file in the folder is a plugin; no fixed list in the code
  async load(folder: string) {
    const files = fs.readdirSync(folder).filter((f) => f.endsWith(".ts"));
    for (const file of files.sort()) {
      const module = await import(pathToFileURL(path.join(folder, file)).href);
      this.install(module.default);
    }
  }

  names(): string[] {
    return [...this.#plugins.keys()].sort();
  }

  // A missing or faulty plugin does not bring down the whole batch
  issue(charge: Charge): string {
    const plugin = this.#plugins.get(charge.bank);
    let result: string;
    if (!plugin) {
      result = `no plugin for bank ${charge.bank}`;
    } else {
      try {
        result = plugin.register(charge);
      } catch (error) {
        result = `plugin ${plugin.name} failed: ${(error as Error).message}`;
      }
    }
    const amount = dollars(charge.amountCents);
    return `${charge.unit};${amount};${charge.bank};${result}`;
  }
}
