// The "cloud" version: deploys the financial report function to LocalStack, calls it
// four times, and checks the PDF stored in the bucket. The timings vary with the
// machine and go only to the terminal; the output file has what does not vary.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CreateFunctionCommand,
  DeleteFunctionCommand,
  InvokeCommand,
  LambdaClient,
  UpdateFunctionConfigurationCommand,
  waitUntilFunctionActiveV2,
  waitUntilFunctionUpdatedV2,
} from "@aws-sdk/client-lambda";
import { CreateBucketCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { generatePdf } from "./function/report.ts";
import { sampleReport } from "./reports.ts";

const data = process.argv[2] ?? "/data";
const FUNCTION = "morada-financial-report";
const BUCKET = "morada-financial-reports";
const lambda = new LambdaClient({});
const s3 = new S3Client({ forcePathStyle: true });
const waiter = { client: lambda, maxWaitTime: 120 };

await s3.send(new CreateBucketCommand({ Bucket: BUCKET })).catch(() => {});
await lambda
  .send(new DeleteFunctionCommand({ FunctionName: FUNCTION }))
  .catch(() => {});
await lambda.send(
  new CreateFunctionCommand({
    FunctionName: FUNCTION,
    Runtime: "nodejs22.x",
    Handler: "report.handler", // report.mjs, the function without the types
    Role: "arn:aws:iam::000000000000:role/morada-financial-report",
    Code: { ZipFile: readFileSync("/app/package/report.zip") },
    MemorySize: 1024,
    Timeout: 30,
    Environment: { Variables: { BUCKET } },
  }),
);
await waitUntilFunctionActiveV2(waiter, { FunctionName: FUNCTION });

const out = [`function ${FUNCTION} deployed (nodejs22.x, 1024 MB)`, ""];
const times: string[] = [];
async function call(i: number, label: string) {
  const event = sampleReport(i, 50 + 40 * i);
  const start = performance.now();
  const r = await lambda.send(
    new InvokeCommand({
      FunctionName: FUNCTION,
      Payload: Buffer.from(JSON.stringify(event)),
    }),
  );
  times.push(`${label.padEnd(8)} ${Math.round(performance.now() - start)} ms`);
  const response = JSON.parse(Buffer.from(r.Payload!).toString());
  const obj = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: response.key }),
  );
  const inBucket = createHash("sha256")
    .update(Buffer.from(await obj.Body!.transformToByteArray()))
    .digest("hex");
  const local = createHash("sha256").update(generatePdf(event)).digest("hex");
  const same = inBucket === response.sha256 && inBucket === local;
  out.push(
    `${label.padEnd(8)} ${r.StatusCode} ${response.key} ${response.bytes} bytes ` +
      `${same ? "matches" : "DIFFERENT"}`,
  );
}
await call(0, "cold");
await call(1, "warm");
await call(2, "warm");
// Changing the configuration discards the environments: the next call is cold again
await lambda.send(
  new UpdateFunctionConfigurationCommand({
    FunctionName: FUNCTION,
    Environment: { Variables: { BUCKET, VERSION: "2" } },
  }),
);
await waitUntilFunctionUpdatedV2(waiter, { FunctionName: FUNCTION });
await call(3, "cold");

const folder = join(data, "output", "cloud");
mkdirSync(folder, { recursive: true });
writeFileSync(join(folder, "result.txt"), out.join("\n") + "\n");
console.log(out.join("\n"));
console.log("\ntime of each call, measured here (varies on every run):");
console.log(times.join("\n"));
