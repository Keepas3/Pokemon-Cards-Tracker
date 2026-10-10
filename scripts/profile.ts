// Sets a profile's password from the command line, e.g. on the machine that runs the app:
//
//   npm run profile:set -- "Sam" "a long password"
//
// If a profile with that name exists its password is replaced (this is the deliberate reset —
// BOOTSTRAP_PROFILES never overwrites one). If not, the first profile that has no password yet
// (the one your existing collection was moved onto) takes the name; otherwise a new one is created.

import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { applyBootstrap } from "../src/lib/auth/profiles";
import { cleanName } from "../src/lib/auth/bootstrap";
import { passwordProblem } from "../src/lib/auth/password";

async function main() {
  const [rawName, password] = process.argv.slice(2);
  const name = cleanName(rawName);
  if (!name || !password) {
    console.error('Usage: npm run profile:set -- "Name" "password"');
    process.exitCode = 1;
    return;
  }
  const problem = passwordProblem(password);
  if (problem) {
    console.error(`That password won't do: ${problem}.`);
    process.exitCode = 1;
    return;
  }
  for (const line of await applyBootstrap([{ name, password }], { overwrite: true })) console.log(line);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
