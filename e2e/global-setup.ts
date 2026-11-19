import { execSync } from "node:child_process";

/** Resets the local JSON store so the smoke test starts from the seed, not a previous run. */
export default function globalSetup() {
  execSync("npm run seed -- --reset", { stdio: "inherit", env: { ...process.env } });
}
