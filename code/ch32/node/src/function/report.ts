// The financial report function: receives one community's entries for the month,
// generates the PDF, and stores it in the bucket. The same file runs in the tests, in
// the simulation and, without the types, as a function on LocalStack. That is why it
// imports no other .ts files.
import { createHash } from "node:crypto";

export type Entry = { date: string; description: string; cents: number };
export type FinancialReport = {
  community: string;
  period: string; // "2026-10"
  entries: Entry[];
};

const dollars = (c: number) => {
  const s = (Math.abs(c) / 100).toFixed(2);
  return (c < 0 ? "-" : "") + s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};
// PDF text: parentheses and backslash need escaping
const text = (s: string) => s.replace(/[\\()]/g, (x) => "\\" + x);

// A minimal one-page PDF, with the Courier font, which every PDF reader has.
// The WinAnsi (latin1) encoding covers the accented letters of Western languages.
export function generatePdf(p: FinancialReport): Buffer {
  const lines = [
    `Financial report - ${p.community} - ${p.period}`,
    "",
    ...p.entries.map(
      (l) => `${l.date}  ${l.description.padEnd(34)} ${dollars(l.cents).padStart(14)}`,
    ),
    "",
    `Balance for the month: $${dollars(p.entries.reduce((a, l) => a + l.cents, 0))}`,
  ];
  const content = ["BT", "/F1 10 Tf", "14 TL", "50 790 Td"]
    .concat(lines.map((l) => `(${text(l)}) '`))
    .concat("ET")
    .join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier " +
      "/Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "latin1")} >>\n` +
      `stream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((n) => `${String(n).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, "latin1");
}

// Outside the handler: runs once per execution environment (on the cold start) and
// is reused by the following calls in the same environment
let s3: { send(c: unknown): Promise<unknown> } | undefined;

export async function handler(event: FinancialReport) {
  const pdf = generatePdf(event);
  const key = `financial-reports/${event.community}/${event.period}.pdf`;
  const bucket = process.env.BUCKET;
  if (bucket) {
    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
    s3 ??= new S3Client({ forcePathStyle: true });
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: pdf,
        ContentType: "application/pdf",
      }),
    );
  }
  // Returns only the key: the PDF stays in the bucket (the response is capped at 6 MB)
  const sha256 = createHash("sha256").update(pdf).digest("hex");
  return { key, bytes: pdf.length, sha256 };
}
