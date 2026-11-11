// The core: publish the month's financial report and notify the residents.
// It knows only the ports; it does not know which cloud it runs on.
import type { Cloud } from "./ports.ts";

export const reportPath = (community: string, month: string) =>
  `reports/${community}/${month}.pdf`;

export async function publishReport(
  cloud: Cloud,
  community: string,
  month: string,
  pdf: Uint8Array,
): Promise<"published" | "duplicate"> {
  const path = reportPath(community, month);
  await cloud.files.store(path, pdf, "application/pdf");
  const document = { community, month, path, bytes: pdf.length };
  if (!(await cloud.documents.registerIfNew(document))) return "duplicate";
  await cloud.tasks.publish({ type: "notify-residents", community, month });
  return "published";
}

// The worker: receives the tasks, checks the file, notifies, and only then acks
export async function notifyResidents(cloud: Cloud): Promise<string[]> {
  const notices: string[] = [];
  for (;;) {
    const batch = await cloud.tasks.receive(10);
    if (batch.length === 0) return notices.sort();
    for (const received of batch) {
      const { community, month } = received.task;
      const pdf = await cloud.files.read(reportPath(community, month));
      const status = pdf ? `${pdf.length} bytes` : "file not found";
      notices.push(`${community} ${month}: notice sent, PDF with ${status}`);
      await cloud.tasks.ack(received);
    }
  }
}
