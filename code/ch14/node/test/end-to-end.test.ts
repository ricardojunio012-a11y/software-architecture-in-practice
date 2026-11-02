// End-to-end test: the monolith's client, the real API and PostgreSQL together.
// Few, slow and valuable: they prove the pieces were wired correctly.
import { describe, expect, it } from "vitest";
import { createApi, start } from "../src/communications/api.ts";
import { Communications } from "../src/communications/domain.ts";
import { PostgresNotices } from "../src/communications/postgres.ts";
import { CommunicationsClient } from "../src/monolith/client.ts";

const url = process.env.DATABASE_URL;

describe.skipIf(!url)("end to end: monolith, service and database", () => {
  it("sends the notice once and recognizes the resend", async () => {
    const { notices, close } = await PostgresNotices.connect(url!);
    const api = createApi(new Communications(notices));
    const client = new CommunicationsClient(await start(api));
    expect(await client.send("E-1", "payment received")).toEqual({
      ok: true,
      duplicate: false,
    });
    expect(await client.send("E-1", "payment received")).toEqual({
      ok: true,
      duplicate: true,
    });
    api.close();
    await close();
  });
});
