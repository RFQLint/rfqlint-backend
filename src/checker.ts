import { createHash } from "node:crypto";
import { runConformanceSuite } from "rfqlint";
import { submitAttestation } from "./contract.js";
import { saveEntry, type RegistryEntry } from "./store.js";

/**
 * Runs the SEP-38 conformance suite for `domain`. If every check passes,
 * publishes an attestation to the on-chain registry. Either way, the
 * full result is persisted locally.
 */
export async function runAndRecordCheck(domain: string): Promise<RegistryEntry> {
  const report = await runConformanceSuite(domain);
  const passed = report.results.length > 0 && report.results.every((r) => r.status !== "fail");
  const resultHash = createHash("sha256").update(JSON.stringify(report)).digest();

  let txHash = "";
  if (passed) {
    const submitted = await submitAttestation(domain, true, resultHash);
    txHash = submitted.txHash;
  }

  const entry: RegistryEntry = {
    domain,
    passed,
    resultHash: resultHash.toString("hex"),
    checkedAt: new Date().toISOString(),
    txHash,
    report,
  };
  await saveEntry(entry);
  return entry;
}
