import { describe, it, expect, afterEach } from "vitest";
import { runAndRecordCheck } from "../src/checker.js";
import { getEntry } from "../src/store.js";
import { getOnChainAttestation } from "../src/contract.js";
import { startMockAnchor, tomlFor, NATIVE, USD, type MockAnchor } from "./fixtures/mock-anchor.js";

let anchor: MockAnchor | undefined;

afterEach(async () => {
  await anchor?.close();
  anchor = undefined;
});

describe("runAndRecordCheck", () => {
  it("records a failing check without touching the chain", async () => {
    anchor = await startMockAnchor({ toml: "" }); // no ANCHOR_QUOTE_SERVER declared -> fails immediately

    const entry = await runAndRecordCheck(anchor.url);

    expect(entry.passed).toBe(false);
    expect(entry.txHash).toBe("");
    expect(await getEntry(anchor.url)).toEqual(entry);
  });

  // Slow, genuinely real test: a spec-conformant mock anchor should cause
  // a real attestation write to Stellar testnet, then read back directly
  // from the contract (not the local store) to prove it actually landed.
  it("publishes an on-chain attestation for a fully passing check", async () => {
    const opts = {
      info: { assets: [{ asset: NATIVE }, { asset: USD }] },
      prices: { buy_assets: [{ asset: USD, price: "0.39", decimals: 4 }] },
      price: {
        total_price: "0.43",
        price: "0.39",
        sell_amount: "1",
        buy_amount: "2.31",
        fee: { total: "0.10", asset: NATIVE },
      },
    } as { toml?: string; info: unknown; prices: unknown; price: unknown };
    anchor = await startMockAnchor(opts);
    opts.toml = tomlFor(anchor.url);

    const entry = await runAndRecordCheck(anchor.url);

    expect(entry.passed).toBe(true);
    expect(entry.txHash).toMatch(/^[0-9a-f]{64}$/);

    const onChain = await getOnChainAttestation(anchor.url);
    expect(onChain?.passed).toBe(true);
    expect(Buffer.from(onChain!.result_hash).toString("hex")).toBe(entry.resultHash);
  });
});
