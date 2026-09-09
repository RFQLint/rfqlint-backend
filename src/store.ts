import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ConformanceReport } from "sep38-conformance";

export interface RegistryEntry {
  domain: string;
  passed: boolean;
  resultHash: string;
  checkedAt: string;
  txHash: string;
  report: ConformanceReport;
}

let writeQueue: Promise<unknown> = Promise.resolve();

function storePath(): string {
  return process.env.STORE_PATH ?? "./data/registry.json";
}

async function readAll(): Promise<Record<string, RegistryEntry>> {
  try {
    const text = await readFile(storePath(), "utf-8");
    return JSON.parse(text) as Record<string, RegistryEntry>;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw err;
  }
}

export async function listEntries(): Promise<RegistryEntry[]> {
  const all = await readAll();
  return Object.values(all).sort((a, b) => b.checkedAt.localeCompare(a.checkedAt));
}

export async function getEntry(domain: string): Promise<RegistryEntry | undefined> {
  const all = await readAll();
  return all[domain];
}

export async function saveEntry(entry: RegistryEntry): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    const all = await readAll();
    all[entry.domain] = entry;
    await mkdir(dirname(storePath()), { recursive: true });
    await writeFile(storePath(), JSON.stringify(all, null, 2));
  });
  await writeQueue;
}
