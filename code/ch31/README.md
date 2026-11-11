# Chapter 31: Cloud, managed services, and vendor lock-in

Lab for chapter 31 of *Software Architecture in Practice*.

Morada's infrastructure (one S3 bucket, two SQS queues, and one DynamoDB table, in the `us-east-1` region) is created by the AWS SDK for JavaScript, version 3, on LocalStack 4.14.0, an emulator of the AWS APIs that runs in a container. No AWS account is needed. The use case (publish the financial report and notify the residents) knows only three ports, and it runs the same with the AWS adapters and with the in-memory ones. The `cost` version measures what the abstraction cost.

| Version | What it does |
|---|---|
| `provision` | Creates the resources through the SDK, runs again to show that nothing changes, and checks the configuration by reading it back from the cloud |
| `flow` | Runs the same core with the in-memory adapters and with the AWS ones, compares them, and counts the calls |
| `abandon` | A worker receives the task and crashes before the ack: on AWS the task comes back, in the in-memory adapter it is lost |
| `cost` | Compares the version with ports and the direct version, without ports: lines, files that import the SDK, and calls |

## Prerequisite

Docker with Docker Compose. This lab has only the TypeScript version. LocalStack 4.14.0 is the last version that runs without an account; from 2026.03 on, the image requires a token (see the chapter).

## Walkthrough

```bash
docker compose run --rm app provision
docker compose run --rm tools verify provision
docker compose run --rm app flow
docker compose run --rm tools verify flow
docker compose run --rm app cost
docker compose run --rm tools verify cost
docker compose run --rm app abandon
docker compose run --rm tools verify abandon
docker compose run --rm app tests
docker compose down -v
```

## Try it

- Write the abandon test in `contract.test.ts` and watch it fail on the in-memory adapter; then give `InMemoryTasks` a visibility timeout with a clock the test controls.
- Add a temporary link (`@aws-sdk/s3-request-presigner`) to the `Files` port and run the `cost` version again.
- Fix the order of the steps in `publishReport` so that a crash between registering the document and publishing the task does not lose the notice.
