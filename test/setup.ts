import "dotenv/config";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "sep38-backend-test-"));
process.env.STORE_PATH = join(dir, "registry.json");

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});
