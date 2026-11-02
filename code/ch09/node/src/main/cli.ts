// Usage: node cli.ts <command> [arguments]   (repository in PostgreSQL)
//        node cli.ts prepare-db              (drops and recreates the table)
// Each run is a new process: the state stays in the database between runs.
import { execute } from "../adapters/inbound/cli.ts";
import { assemble } from "./assemble.ts";

const args = process.argv.slice(2);
const prepare = args[0] === "prepare-db";
const { service, close } = await assemble("postgres", prepare);
const [text, code] = prepare ? ["database ready", 0] : await execute(service, args);
await close();
console.log(text);
process.exitCode = code;
